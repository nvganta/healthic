import { NextRequest, NextResponse } from 'next/server';
import { InMemoryRunner, getFunctionCalls } from '@google/adk';
import { createUserContent } from '@google/genai';
import { healthAgent } from '@/agent/health-agent';
import { opik } from '@/lib/opik';

const APP_NAME = 'healthic';
const runner = new InMemoryRunner({ agent: healthAgent, appName: APP_NAME });

export async function POST(request: NextRequest) {
  // Start Opik trace for this chat request
  const trace = opik.trace({
    name: 'chat_request',
    input: {},
    metadata: {
      endpoint: '/api/chat',
    },
  });

  try {
    const { message, userId = 'default_user', sessionId } = await request.json();

    // Update trace with input
    trace.update({
      input: { message, userId, sessionId },
    });

    if (!message) {
      trace.update({ output: { error: 'Message is required' } });
      trace.end();
      await opik.flush();
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Create or get session
    let session;
    if (sessionId) {
      session = await runner.sessionService.getSession({
        appName: APP_NAME,
        userId,
        sessionId,
      });
    }

    if (!session) {
      session = await runner.sessionService.createSession({
        appName: APP_NAME,
        userId,
      });
    }

    // Create user content
    const userContent = createUserContent(message);

    // Create span for agent execution
    const agentSpan = trace.span({
      name: 'agent_execution',
      type: 'llm',
      input: { message, sessionId: session.id },
      metadata: {
        agent: 'healthic',
        model: 'gemini-2.0-flash',
      },
    });

    // Run the agent and collect response
    const events = runner.runAsync({
      userId,
      sessionId: session.id,
      newMessage: userContent,
    });

    let responseText = '';
    const toolCalls: Array<{ name: string | undefined; args: unknown }> = [];

    for await (const event of events) {
      // Check for API errors
      if ('errorCode' in event && event.errorCode) {
        console.error('API Error:', event.errorCode, event.errorMessage);

        agentSpan.update({
          output: { error: event.errorMessage },
          metadata: { errorCode: event.errorCode },
        });
        agentSpan.end();

        trace.update({
          output: { error: event.errorMessage },
          metadata: { status: 'error', errorCode: event.errorCode },
        });
        trace.end();
        await opik.flush();

        return NextResponse.json(
          { error: 'API error', code: event.errorCode, details: event.errorMessage },
          { status: 429 }
        );
      }

      // Track tool calls for observability
      const calls = getFunctionCalls(event);
      for (const call of calls) {
        if (call.name) {
          toolCalls.push({
            name: call.name,
            args: call.args,
          });

          // Create a span for each tool call
          const toolSpan = trace.span({
            name: `tool_call_${call.name}`,
            type: 'tool',
            input: { args: call.args },
            metadata: { toolName: call.name },
          });
          toolSpan.end();
        }
      }

      // Try to extract text from any event with content
      if (event.content?.parts) {
        for (const part of event.content.parts) {
          if ('text' in part && part.text) {
            responseText += part.text;
          }
        }
      }
    }

    // End agent span with response
    agentSpan.update({
      output: { response: responseText, toolCalls },
    });
    agentSpan.end();

    // End trace with final output
    trace.update({
      output: {
        response: responseText,
        sessionId: session.id,
        toolCallsCount: toolCalls.length,
      },
      metadata: {
        status: 'success',
        hasToolCalls: toolCalls.length > 0,
      },
    });
    trace.end();

    // Flush traces to Opik (don't await to not block response)
    opik.flush().catch(console.error);

    return NextResponse.json({
      response: responseText,
      sessionId: session.id,
      toolCalls,
    });
  } catch (error) {
    console.error('Chat error:', error);

    trace.update({
      output: { error: String(error) },
      metadata: { status: 'error' },
    });
    trace.end();
    await opik.flush();

    return NextResponse.json(
      { error: 'Failed to process message', details: String(error) },
      { status: 500 }
    );
  }
}
