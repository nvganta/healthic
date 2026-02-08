import { sql } from '@/lib/db';

/**
 * Get or create a conversation for a user.
 * Conversations persist chat history across sessions.
 */
export async function getOrCreateConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    const existing = await sql`SELECT * FROM conversations WHERE id = ${conversationId}::uuid AND user_id = ${userId}::uuid`;
    if (existing.length > 0) {
      // Update last_message_at timestamp
      await sql`UPDATE conversations SET last_message_at = NOW() WHERE id = ${conversationId}::uuid AND user_id = ${userId}::uuid`;
      return existing[0];
    }
  }
  
  // Create new conversation
  const newConversation = await sql`
    INSERT INTO conversations (user_id, channel)
    VALUES (${userId}::uuid, 'web')
    RETURNING *
  `;
  return newConversation[0];
}

/**
 * Save a message to the database for persistence.
 */
export async function saveMessage(
  conversationId: string, 
  role: 'user' | 'assistant', 
  content: string, 
  metadata?: Record<string, unknown>
) {
  const result = await sql`
    INSERT INTO messages (conversation_id, role, content, metadata)
    VALUES (${conversationId}::uuid, ${role}, ${content}, ${JSON.stringify(metadata || {})})
    RETURNING *
  `;
  return result[0];
}

/**
 * Get conversation history for context.
 */
export async function getConversationHistory(conversationId: string, limit: number = 20) {
  const messages = await sql`
    SELECT role, content, created_at 
    FROM messages 
    WHERE conversation_id = ${conversationId}::uuid
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return messages;
}

/**
 * Count user messages in a conversation (for exchange tracking).
 */
export async function countUserMessages(conversationId: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM messages
    WHERE conversation_id = ${conversationId}::uuid AND role = 'user'
  `;
  return parseInt(result[0]?.count || '0', 10);
}

/**
 * Get all conversations for a user.
 */
export async function getUserConversations(userId: string, limit: number = 10) {
  const conversations = await sql`
    SELECT c.*, 
           (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM conversations c
    WHERE c.user_id = ${userId}::uuid
    ORDER BY c.last_message_at DESC
    LIMIT ${limit}
  `;
  return conversations;
}
