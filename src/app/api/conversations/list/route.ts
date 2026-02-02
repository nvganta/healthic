import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/agent/tools/user-helper';
import { getUserConversations } from '@/agent/tools/conversation-helpers';

/**
 * GET /api/conversations/list
 * Returns all conversations for the current user.
 */
export async function GET() {
  try {
    const user = await getOrCreateUser();
    const conversations = await getUserConversations(user.id, 20);

    return NextResponse.json({
      conversations: conversations.map((c: Record<string, unknown>) => ({
        id: c.id,
        startedAt: c.started_at,
        lastMessageAt: c.last_message_at,
        lastMessage: (c.last_message as string) || 'No messages',
      })),
    });
  } catch (error) {
    console.error('Error fetching conversation list:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}
