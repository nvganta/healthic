import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

/**
 * Generate embeddings using Google's text-embedding model.
 * Using text-embedding-004 for better quality.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GOOGLE_GENAI_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text }]
        },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 768, // Smaller dimension for efficiency
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${error}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Store an embedding in the database.
 */
async function storeEmbedding(
  userId: string,
  contentType: 'message' | 'log' | 'pattern' | 'goal' | 'insight',
  contentId: string,
  contentText: string
): Promise<void> {
  try {
    const embedding = await generateEmbedding(contentText);
    
    // Convert embedding array to pgvector format
    const embeddingStr = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO embeddings (user_id, content_type, content_id, content_text, embedding)
      VALUES (${userId}::uuid, ${contentType}, ${contentId}::uuid, ${contentText}, ${embeddingStr}::vector)
      ON CONFLICT (content_id) DO UPDATE SET
        content_text = ${contentText},
        embedding = ${embeddingStr}::vector
    `;
  } catch (error) {
    console.error('Error storing embedding:', error);
    // Don't throw - embedding storage is non-critical
  }
}

/**
 * Search for similar content using vector similarity.
 */
async function searchSimilar(
  userId: string,
  queryText: string,
  contentTypes: string[],
  limit: number = 5
): Promise<Array<{ content_type: string; content_text: string; similarity: number }>> {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Use cosine similarity for search
    const results = await sql`
      SELECT 
        content_type,
        content_text,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM embeddings
      WHERE user_id = ${userId}::uuid
        AND content_type = ANY(${contentTypes})
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `;

    return results.map(r => ({
      content_type: r.content_type,
      content_text: r.content_text,
      similarity: r.similarity
    }));
  } catch (error) {
    console.error('Error searching similar:', error);
    return [];
  }
}

/**
 * Tool to store important insights for future retrieval.
 */
export const storeInsightTool = new FunctionTool({
  name: 'store_insight',
  description: `Store an important insight about the user for future retrieval.
Use this to remember:
- Key information the user shared about themselves
- What worked or didn't work for them
- Their preferences, constraints, or challenges
- Successful strategies they've used
- Important context that should inform future advice

These insights become searchable and help personalize future interactions.`,
  parameters: z.object({
    insight: z.string().describe('The insight to store - be specific and include context'),
    category: z.enum(['preference', 'constraint', 'success', 'failure', 'challenge', 'strategy', 'context'])
      .describe('Category of insight'),
    relatedGoalId: z.string().optional().describe('Related goal ID if applicable'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      // Store in patterns table with embedding
      const result = await sql`
        INSERT INTO patterns (user_id, pattern_type, description, confidence)
        VALUES (${user.id}::uuid, ${params.category}, ${params.insight}, 1.0)
        RETURNING id
      `;

      // Create embedding for semantic search
      const insightWithContext = `[${params.category}] ${params.insight}`;
      await storeEmbedding(user.id, 'insight', result[0].id, insightWithContext);

      return {
        success: true,
        insightId: result[0].id,
        message: `Insight stored: "${params.insight.substring(0, 50)}..." I'll remember this for future conversations.`
      };
    } catch (error) {
      console.error('Error storing insight:', error);
      return { success: false, message: 'Failed to store insight.' };
    }
  },
});

/**
 * Tool to search for relevant past context.
 */
export const searchContextTool = new FunctionTool({
  name: 'search_context',
  description: `Search for relevant past context to personalize advice.
Use this before giving advice to:
- Find what worked or didn't work before in similar situations
- Recall user's stated preferences and constraints
- Remember past challenges and how they were addressed
- Find successful strategies the user has used

Returns semantically similar past insights and patterns.`,
  parameters: z.object({
    query: z.string().describe('What to search for - describe the situation or topic'),
    includeTypes: z.array(z.enum(['insight', 'pattern', 'message', 'log', 'goal']))
      .default(['insight', 'pattern'])
      .describe('Types of content to search'),
    limit: z.number().default(5).describe('Maximum results to return'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      const results = await searchSimilar(
        user.id,
        params.query,
        params.includeTypes,
        params.limit
      );

      if (results.length === 0) {
        // Fall back to pattern search without embeddings
        const patterns = await sql`
          SELECT pattern_type, description, confidence
          FROM patterns
          WHERE user_id = ${user.id}::uuid
          ORDER BY created_at DESC
          LIMIT ${params.limit}
        `;

        return {
          success: true,
          results: patterns.map(p => ({
            type: p.pattern_type,
            content: p.description,
            confidence: p.confidence
          })),
          usedEmbeddings: false,
          message: `Found ${patterns.length} relevant pattern(s) from history.`
        };
      }

      return {
        success: true,
        results: results.map(r => ({
          type: r.content_type,
          content: r.content_text,
          relevance: Math.round(r.similarity * 100)
        })),
        usedEmbeddings: true,
        message: `Found ${results.length} relevant item(s) using semantic search.`
      };
    } catch (error) {
      console.error('Error searching context:', error);
      return { success: false, results: [], message: 'Search failed, but you can still help based on current conversation.' };
    }
  },
});

/**
 * Tool to index conversation messages for future retrieval.
 */
export const indexConversationTool = new FunctionTool({
  name: 'index_conversation',
  description: `Index important parts of the conversation for future retrieval.
Use this when:
- User shares important personal information
- A significant insight emerges from the conversation
- User describes a breakthrough or setback
- Important context that should inform future sessions

This makes the information searchable in future conversations.`,
  parameters: z.object({
    content: z.string().describe('The content to index - include relevant context'),
    conversationId: z.string().describe('The conversation ID'),
    importance: z.enum(['high', 'medium', 'low']).default('medium').describe('How important is this for future reference'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      // Create a unique ID for this indexed content
      const result = await sql`
        INSERT INTO messages (conversation_id, role, content, metadata)
        VALUES (${params.conversationId}::uuid, 'system', ${params.content}, ${JSON.stringify({ indexed: true, importance: params.importance })})
        RETURNING id
      `;

      // Store embedding
      await storeEmbedding(user.id, 'message', result[0].id, params.content);

      return {
        success: true,
        message: `Indexed for future reference: "${params.content.substring(0, 50)}..."`
      };
    } catch (error) {
      console.error('Error indexing conversation:', error);
      return { success: false, message: 'Failed to index conversation.' };
    }
  },
});

/**
 * Tool to find similar past situations.
 */
export const findSimilarSituationsTool = new FunctionTool({
  name: 'find_similar_situations',
  description: `Find similar situations from the user's history.
Use this when:
- User describes a problem and you want to see if they've faced it before
- Looking for patterns in their behavior
- Wanting to reference past successes or challenges

Helps give advice based on what has actually worked for THIS user.`,
  parameters: z.object({
    situation: z.string().describe('Describe the current situation to find similar past experiences'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      // Search across all content types
      const results = await searchSimilar(
        user.id,
        params.situation,
        ['insight', 'pattern', 'message', 'log'],
        8
      );

      // Also get recent patterns from the patterns table
      const patterns = await sql`
        SELECT pattern_type, description, evidence, confidence
        FROM patterns
        WHERE user_id = ${user.id}::uuid
        ORDER BY updated_at DESC
        LIMIT 5
      `;

      // Combine and deduplicate
      const allContext = [
        ...results.map(r => ({ source: 'semantic_search', type: r.content_type, content: r.content_text, relevance: r.similarity })),
        ...patterns.map(p => ({ source: 'patterns', type: p.pattern_type, content: p.description, relevance: p.confidence }))
      ];

      // Filter by relevance
      const relevant = allContext.filter(c => c.relevance > 0.5);

      if (relevant.length === 0) {
        return {
          success: true,
          found: false,
          message: "I don't have records of similar situations yet. This will be helpful to remember for the future though!"
        };
      }

      return {
        success: true,
        found: true,
        situations: relevant.slice(0, 5),
        message: `Found ${relevant.length} similar past situation(s) that might help inform my advice.`
      };
    } catch (error) {
      console.error('Error finding similar situations:', error);
      return { success: false, found: false, message: 'Could not search past situations.' };
    }
  },
});
