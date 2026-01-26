import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

interface UserPortrait {
  summary: string;
  isDefault?: boolean;
  personality: {
    motivationStyle: string;
    communicationPreference: string;
    decisionMakingStyle: string;
  };
  healthProfile: {
    primaryGoals: string[];
    knownChallenges: string[];
    successPatterns: string[];
    triggerPatterns: string[];
  };
  relationship: {
    trustLevel: 'new' | 'building' | 'established';
    responseToToughLove: string;
    responseToEncouragement: string;
  };
  recommendations: string[];
}

/**
 * Generate a comprehensive user portrait using all available data.
 */
async function generateUserPortrait(userId: string): Promise<UserPortrait> {
  // Gather all user data
  const user = await sql`SELECT * FROM users WHERE id = ${userId}::uuid`;
  const goals = await sql`SELECT * FROM goals WHERE user_id = ${userId}::uuid ORDER BY created_at DESC LIMIT 10`;
  const patterns = await sql`SELECT * FROM patterns WHERE user_id = ${userId}::uuid ORDER BY confidence DESC LIMIT 20`;
  const checkIns = await sql`SELECT tone_used, outcome FROM check_ins WHERE user_id = ${userId}::uuid AND outcome IS NOT NULL`;
  const recentLogs = await sql`
    SELECT log_type, data, notes, log_date 
    FROM daily_logs 
    WHERE user_id = ${userId}::uuid 
    ORDER BY created_at DESC 
    LIMIT 50
  `;

  // Build context for LLM
  const userData = user[0] || {};
  const preferences = userData.preferences || {};
  
  const goalsContext = goals.map(g => `${g.title} (${g.status})`).join(', ');
  const patternsContext = patterns.map(p => p.description).join('; ');
  
  // Analyze check-in effectiveness
  const toneEffectiveness: Record<string, { positive: number; total: number }> = {};
  checkIns.forEach(ci => {
    const tone = ci.tone_used || 'balanced';
    if (!toneEffectiveness[tone]) toneEffectiveness[tone] = { positive: 0, total: 0 };
    toneEffectiveness[tone].total++;
    if (ci.outcome === 'positive') toneEffectiveness[tone].positive++;
  });

  const prompt = `Create a comprehensive "user portrait" for a health coaching AI based on this data:

USER PROFILE:
- Name: ${userData.name || 'Unknown'}
- Tone preference: ${userData.tone_preference || 'balanced'}
- Preferences: ${JSON.stringify(preferences)}

GOALS: ${goalsContext || 'No goals yet'}

DETECTED PATTERNS: ${patternsContext || 'No patterns detected yet'}

CHECK-IN EFFECTIVENESS:
${Object.entries(toneEffectiveness).map(([tone, stats]) => 
  `- ${tone}: ${stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0}% positive response rate (${stats.total} check-ins)`
).join('\n')}

RECENT ACTIVITY SUMMARY:
- Exercise logs: ${recentLogs.filter(l => l.log_type === 'exercise').length}
- Mood logs: ${recentLogs.filter(l => l.log_type === 'mood').length}
- Sleep logs: ${recentLogs.filter(l => l.log_type === 'sleep').length}

Create a portrait that helps the AI coach this person better. Respond in JSON:
{
  "summary": "2-3 sentence summary of who this person is as a health seeker",
  "personality": {
    "motivationStyle": "what motivates them (achievement, fear of failure, social accountability, self-improvement, etc.)",
    "communicationPreference": "how they like to communicate (brief/detailed, formal/casual, data-driven/emotional)",
    "decisionMakingStyle": "how they make decisions (analytical, intuitive, needs validation, independent)"
  },
  "healthProfile": {
    "primaryGoals": ["their main health objectives"],
    "knownChallenges": ["obstacles they face"],
    "successPatterns": ["what has worked for them"],
    "triggerPatterns": ["what causes them to fall off track"]
  },
  "relationship": {
    "trustLevel": "new|building|established based on interaction history",
    "responseToToughLove": "how they respond to direct feedback",
    "responseToEncouragement": "how they respond to gentle encouragement"
  },
  "recommendations": ["3-5 specific recommendations for how to coach this person effectively"]
}`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GOOGLE_GENAI_API_KEY || '',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error('Error parsing portrait JSON:', parseError, 'Raw text:', text);
      throw new Error('Failed to parse LLM response as JSON');
    }
  } catch (error) {
    console.error('Error generating portrait:', error);
    // Return default portrait with clear indication it's a fallback
    return {
      summary: 'New user - still learning about them.',
      isDefault: true,
      personality: {
        motivationStyle: 'Unknown',
        communicationPreference: 'Unknown',
        decisionMakingStyle: 'Unknown'
      },
      healthProfile: {
        primaryGoals: [],
        knownChallenges: [],
        successPatterns: [],
        triggerPatterns: []
      },
      relationship: {
        trustLevel: 'new',
        responseToToughLove: 'Unknown',
        responseToEncouragement: 'Unknown'
      },
      recommendations: ['Get to know them better through conversation']
    };
  }
}

/**
 * Get cross-session continuity context.
 */
async function getCrossSessionContext(userId: string): Promise<{
  lastTopics: string[];
  pendingFollowUps: string[];
  unresolvedIssues: string[];
  recentWins: string[];
}> {
  // Get recent conversations
  const recentMessages = await sql`
    SELECT m.content, m.role, m.created_at, m.metadata
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = ${userId}::uuid
    ORDER BY m.created_at DESC
    LIMIT 30
  `;

  // Get insights marked as important
  const importantInsights = await sql`
    SELECT description, pattern_type
    FROM patterns
    WHERE user_id = ${userId}::uuid
    ORDER BY updated_at DESC
    LIMIT 10
  `;

  // Get recent goal progress
  const recentProgress = await sql`
    SELECT g.title, wt.target_value, wt.actual_value, wt.week_start
    FROM weekly_targets wt
    JOIN goals g ON wt.goal_id = g.id
    WHERE g.user_id = ${userId}::uuid
    ORDER BY wt.week_start DESC
    LIMIT 5
  `;

  // Extract topics from recent messages
  const userMessages = recentMessages
    .filter(m => m.role === 'user')
    .slice(0, 10)
    .map(m => m.content);

  // Find wins (completed targets)
  const wins = recentProgress
    .filter(p => p.actual_value && p.target_value && (p.actual_value / p.target_value) >= 1)
    .map(p => `Completed ${p.title} target for week of ${p.week_start}`);

  // Extract pending follow-ups from metadata
  const pendingFollowUps = recentMessages
    .filter(m => m.metadata?.followUp)
    .map(m => m.metadata.followUp as string);

  return {
    lastTopics: userMessages.slice(0, 3),
    pendingFollowUps: pendingFollowUps.slice(0, 3),
    unresolvedIssues: importantInsights
      .filter(i => i.pattern_type === 'challenge' || i.pattern_type === 'failure')
      .map(i => i.description)
      .slice(0, 3),
    recentWins: wins.slice(0, 3)
  };
}

/**
 * Tool to get comprehensive user portrait.
 */
export const getUserPortraitTool = new FunctionTool({
  name: 'get_user_portrait',
  description: `Get a comprehensive understanding of who this user is.
Use this to:
- Understand their personality and motivation style
- Know their challenges and what has worked
- Get specific recommendations for coaching them
- Personalize your entire approach

This synthesizes ALL data about the user into actionable insights.`,
  parameters: z.object({
    regenerate: z.boolean().default(false).describe('Force regeneration even if recent portrait exists'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      
      // Check if we have a recent portrait (stored in patterns as 'portrait' type)
      if (!params.regenerate) {
        const existingPortrait = await sql`
          SELECT description, updated_at
          FROM patterns
          WHERE user_id = ${user.id}::uuid AND pattern_type = 'portrait'
          ORDER BY updated_at DESC
          LIMIT 1
        `;

        if (existingPortrait.length > 0) {
          const hoursSinceUpdate = (Date.now() - new Date(existingPortrait[0].updated_at).getTime()) / (1000 * 60 * 60);
          
          // Use cached portrait if less than 24 hours old
          if (hoursSinceUpdate < 24) {
            try {
              const portrait = JSON.parse(existingPortrait[0].description);
              return {
                success: true,
                cached: true,
                portrait,
                message: 'Retrieved cached user portrait.'
              };
            } catch {
              // If parsing fails, regenerate
            }
          }
        }
      }

      // Generate new portrait
      const portrait = await generateUserPortrait(user.id);
      
      // Cache it - use upsert pattern with subquery since patterns table doesn't have (user_id, pattern_type) unique constraint
      const existingPortrait = await sql`
        SELECT id FROM patterns 
        WHERE user_id = ${user.id}::uuid AND pattern_type = 'portrait'
        LIMIT 1
      `;
      
      if (existingPortrait.length > 0) {
        await sql`
          UPDATE patterns 
          SET description = ${JSON.stringify(portrait)}, updated_at = NOW()
          WHERE id = ${existingPortrait[0].id}::uuid
        `;
      } else {
        await sql`
          INSERT INTO patterns (user_id, pattern_type, description, confidence)
          VALUES (${user.id}::uuid, 'portrait', ${JSON.stringify(portrait)}, 1.0)
        `;
      }

      return {
        success: true,
        cached: false,
        portrait,
        message: 'Generated fresh user portrait based on all available data.'
      };
    } catch (error) {
      console.error('Error getting user portrait:', error);
      return { success: false, message: 'Could not generate user portrait.' };
    }
  },
});

/**
 * Tool for cross-session continuity.
 */
export const getCrossSessionContinuityTool = new FunctionTool({
  name: 'get_cross_session_continuity',
  description: `Get context for natural conversation continuity across sessions.
Use this at the START of conversations to:
- Know what you talked about last time
- Find pending follow-ups to ask about
- Reference recent wins
- Address unresolved issues

Makes the conversation feel continuous, not like starting fresh each time.`,
  parameters: z.object({}),
  execute: async () => {
    try {
      const user = await getOrCreateUser();
      const context = await getCrossSessionContext(user.id);

      // Generate natural follow-up suggestions
      const followUpSuggestions: string[] = [];
      
      if (context.recentWins.length > 0) {
        followUpSuggestions.push(`Celebrate: "${context.recentWins[0]}" - ask how they feel about it`);
      }
      
      if (context.pendingFollowUps.length > 0) {
        followUpSuggestions.push(`Follow up: ${context.pendingFollowUps[0]}`);
      }
      
      if (context.unresolvedIssues.length > 0) {
        followUpSuggestions.push(`Check in on: ${context.unresolvedIssues[0]}`);
      }

      return {
        success: true,
        ...context,
        followUpSuggestions,
        naturalOpeners: [
          context.recentWins.length > 0 
            ? `Last time you mentioned ${context.lastTopics[0]?.substring(0, 50)}... How did that go?`
            : null,
          context.pendingFollowUps.length > 0
            ? `I wanted to follow up on ${context.pendingFollowUps[0]}`
            : null,
          'How have things been since we last talked?'
        ].filter(Boolean)
      };
    } catch (error) {
      console.error('Error getting cross-session context:', error);
      return { success: false, message: 'Could not retrieve session context.' };
    }
  },
});

/**
 * Tool to mark something for follow-up in next session.
 */
export const markForFollowUpTool = new FunctionTool({
  name: 'mark_for_follow_up',
  description: `Mark something to follow up on in the next conversation.
Use this when:
- User mentions trying something new
- You give advice and want to check if it worked
- User shares a challenge to revisit later
- Something important comes up that deserves follow-up

This ensures continuity across sessions.`,
  parameters: z.object({
    topic: z.string().describe('What to follow up on'),
    context: z.string().optional().describe('Additional context about why'),
    priority: z.enum(['high', 'medium', 'low']).default('medium').describe('How important is this follow-up'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      // Store as a pattern with follow_up type
      await sql`
        INSERT INTO patterns (user_id, pattern_type, description, confidence, evidence)
        VALUES (
          ${user.id}::uuid, 
          'follow_up', 
          ${params.topic}, 
          ${params.priority === 'high' ? 1.0 : params.priority === 'medium' ? 0.7 : 0.4},
          ${JSON.stringify({ context: params.context, createdAt: new Date().toISOString() })}
        )
      `;

      return {
        success: true,
        message: `Noted! I'll remember to ask about "${params.topic}" next time.`,
        priority: params.priority
      };
    } catch (error) {
      console.error('Error marking follow-up:', error);
      return { success: false, message: 'Could not save follow-up reminder.' };
    }
  },
});

/**
 * Tool to update the user portrait with new insights.
 */
export const updateUserPortraitTool = new FunctionTool({
  name: 'update_user_portrait',
  description: `Update the user portrait with a new significant insight.
Use this when you learn something important about:
- What motivates them
- A new challenge or success pattern
- Their communication preferences
- What coaching approaches work/don't work

This keeps the portrait fresh and accurate.`,
  parameters: z.object({
    insightType: z.enum([
      'motivation',
      'challenge', 
      'success_pattern',
      'trigger_pattern',
      'communication_preference',
      'coaching_effectiveness'
    ]).describe('What type of insight this is'),
    insight: z.string().describe('The specific insight learned'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      // Store as a pattern
      await sql`
        INSERT INTO patterns (user_id, pattern_type, description, confidence)
        VALUES (${user.id}::uuid, ${params.insightType}, ${params.insight}, 0.8)
      `;

      // Mark portrait for regeneration by deleting old one
      await sql`
        DELETE FROM patterns 
        WHERE user_id = ${user.id}::uuid AND pattern_type = 'portrait'
      `;

      return {
        success: true,
        message: `Insight recorded: "${params.insight}". User portrait will be updated.`,
        insightType: params.insightType
      };
    } catch (error) {
      console.error('Error updating portrait:', error);
      return { success: false, message: 'Could not record insight.' };
    }
  },
});
