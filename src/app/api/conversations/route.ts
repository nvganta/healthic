import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';

/**
 * GET /api/conversations
 * Returns a conversation with its messages.
 * - ?id=<uuid> loads a specific conversation
 * - No param loads the most recent conversation
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const { searchParams } = new URL(request.url);
    const specificId = searchParams.get('id');

    let conversation;

    if (specificId) {
      const conversations = await sql`
        SELECT id, started_at, last_message_at
        FROM conversations
        WHERE id = ${specificId}::uuid AND user_id = ${user.id}
        LIMIT 1
      `;
      if (conversations.length === 0) {
        return NextResponse.json({ conversation: null, messages: [] });
      }
      conversation = conversations[0];
    } else {
      const conversations = await sql`
        SELECT id, started_at, last_message_at
        FROM conversations
        WHERE user_id = ${user.id} AND channel = 'web'
        ORDER BY last_message_at DESC
        LIMIT 1
      `;
      if (conversations.length === 0) {
        return NextResponse.json({ conversation: null, messages: [] });
      }
      conversation = conversations[0];
    }

    // Get messages for this conversation
    const messages = await sql`
      SELECT id, role, content, metadata, created_at
      FROM messages
      WHERE conversation_id = ${conversation.id}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        startedAt: conversation.started_at,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.metadata?.toolCalls || [],
      })),
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

/**
 * POST /api/conversations
 * Save a message to a conversation. Creates conversation if needed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, role, content, toolCalls } = body;

    const user = await getOrCreateUser();

    let convId = conversationId;

    // Create conversation if needed
    if (!convId) {
      const result = await sql`
        INSERT INTO conversations (user_id, channel)
        VALUES (${user.id}, 'web')
        RETURNING id
      `;
      convId = result[0].id;
    }

    // Save the message
    await sql`
      INSERT INTO messages (conversation_id, role, content, metadata)
      VALUES (${convId}, ${role}, ${content}, ${JSON.stringify({ toolCalls: toolCalls || [] })}::jsonb)
    `;

    // Update conversation timestamp
    await sql`
      UPDATE conversations
      SET last_message_at = NOW()
      WHERE id = ${convId}
    `;

    return NextResponse.json({ conversationId: convId });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
