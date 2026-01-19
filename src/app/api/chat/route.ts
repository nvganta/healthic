import { NextRequest, NextResponse } from 'next/server';
import { InMemoryRunner, isFinalResponse, getFunctionCalls, stringifyContent } from '@google/adk';
import { createUserContent } from '@google/genai';
import { healthAgent } from '@/agent/health-agent';

const APP_NAME = 'healthic';
const runner = new InMemoryRunner({ agent: healthAgent, appName: APP_NAME });

export async function POST(request: NextRequest) {
  try {
    const { message, userId = 'default_user', sessionId } = await request.json();

    if (!message) {
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

    // Run the agent and collect response
    const events = runner.runAsync({
      userId,
      sessionId: session.id,
      newMessage: userContent,
    });

    let responseText = '';
    const toolCalls: Array<{ name: string | undefined; args: unknown }> = [];

    for await (const event of events) {
      // Track tool calls for observability
      const calls = getFunctionCalls(event);
      for (const call of calls) {
        if (call.name) {
          toolCalls.push({
            name: call.name,
            args: call.args,
          });
        }
      }

      if (isFinalResponse(event)) {
        // Extract text from the final response
        responseText = stringifyContent(event);
      }
    }

    return NextResponse.json({
      response: responseText,
      sessionId: session.id,
      toolCalls,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', details: String(error) },
      { status: 500 }
    );
  }
}
