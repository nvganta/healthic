import { NextRequest, NextResponse } from 'next/server';
import { InMemoryRunner, getFunctionCalls } from '@google/adk';
import { createUserContent } from '@google/genai';
import { z } from 'zod';
import { healthAgent } from '@/agent/health-agent';
import { opik } from '@/lib/opik';
import { evaluateActionability } from '@/lib/evals/actionability';
import { evaluateSafety } from '@/lib/evals/safety';
import { evaluatePersonalization } from '@/lib/evals/personalization';
import { extractAndSavePreferences, getUserPreferences } from '@/lib/extract-preferences';
import { getOrCreateConversation, saveMessage } from '@/agent/tools/conversation-helpers';
import { getOrCreateUser } from '@/agent/tools/user-helper';

const APP_NAME = 'healthic';
const runner = new InMemoryRunner({ agent: healthAgent, appName: APP_NAME });

/**
 * Run evaluations asynchronously on agent responses.
 * This function runs in the background and doesn't block the response.
 */
async function runEvaluationsAsync(userMessage: string, agentResponse: string) {
  try {
    // Get user preferences for personalization eval
    const preferences = await getUserPreferences();
    const contextStr = Object.entries(preferences)
      .filter(([, v]) => Array.isArray(v) && v.length > 0)
      .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
      .join('; ');

    // Run all three evals in parallel
    const [actionabilityResult, safetyResult, personalizationResult] = await Promise.all([
      evaluateActionability({ input: userMessage, output: agentResponse }),
      evaluateSafety({ input: userMessage, output: agentResponse }),
      evaluatePersonalization({ context: contextStr || 'No preferences stored yet', input: userMessage, output: agentResponse }),
    ]);

    // Log evaluation results for monitoring
    console.log('📊 Eval Results:', {
      actionability: actionabilityResult.score,
      safety: safetyResult.score,
      personalization: personalizationResult.score,
    });

    // Alert on low safety scores
    if (safetyResult.score < 0.5) {
      console.warn('⚠️ Low safety score detected:', {
        score: safetyResult.score,
        reason: safetyResult.reason,
        concerns: safetyResult.concerns,
        userMessage,
        agentResponse: agentResponse.substring(0, 200),
      });
    }
  } catch (error) {
    console.error('Error running async evaluations:', error);
  }
}

// Input validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000, 'Message too long'),
  userId: z.string().min(1).max(100).optional().nullable(),
  sessionId: z.string().uuid().optional().nullable(),
  conversationId: z.string().uuid().optional().nullable(),
});

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
    // Parse and validate request body
    const body = await request.json();
    const parseResult = chatRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((e) => e.message).join(', ');
      trace.update({ output: { error: errorMessage } });
      trace.end();
      await opik.flush();
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { message, userId: requestUserId, sessionId, conversationId } = parseResult.data;

    // Get or create user - use provided userId or default
    const user = await getOrCreateUser(requestUserId ?? undefined);
    const userId = user.id;

    // Get or create conversation for message persistence
    const conversation = await getOrCreateConversation(userId, conversationId ?? undefined);

    // Save user message to database for persistence (history is maintained by ADK session)
    // Note: We persist to DB for long-term storage, but don't inject into message
    // since InMemoryRunner already maintains session conversation state
    await saveMessage(conversation.id, 'user', message);

    // Update trace with validated input
    trace.update({
      input: { message, userId, sessionId, conversationId: conversation.id },
    });

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

    // Create user content - ADK session maintains conversation history, no need to inject
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

    // Save assistant response to database for persistence
    await saveMessage(conversation.id, 'assistant', responseText);

    // End trace with final output
    trace.update({
      output: {
        response: responseText,
        sessionId: session.id,
        conversationId: conversation.id,
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

    // Run evaluations asynchronously (don't block response)
    runEvaluationsAsync(message, responseText).catch(console.error);

    // Extract and save user preferences in background (don't block response)
    extractAndSavePreferences(message, userId).catch(console.error);

    // Extract choicesData if agent used present_choices tool
    const choicesCall = toolCalls.find((tc) => tc.name === 'present_choices');
    const choicesData = choicesCall
      ? {
          title: (choicesCall.args as Record<string, unknown>).title as string,
          questions: ((choicesCall.args as Record<string, unknown>).questions as Array<{
            id: string;
            question: string;
            options: string[];
          }>).map((q) => ({
            ...q,
            options: [...q.options, 'Other'],
          })),
        }
      : undefined;

    return NextResponse.json({
      response: responseText,
      sessionId: session.id,
      conversationId: conversation.id,
      toolCalls,
      choicesData,
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
