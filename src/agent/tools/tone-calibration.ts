import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

interface ToneAnalysis {
  suggestedTone: 'tough_love' | 'gentle' | 'balanced';
  confidence: number;
  reasoning: string;
  recentResponses: Array<{
    tone: string;
    outcome: string;
  }>;
}

/**
 * Analyzes user interaction history to determine the best tone.
 */
async function analyzeToneEffectiveness(userId: string): Promise<ToneAnalysis> {
  // Get check-in history with outcomes
  const checkIns = await sql`
    SELECT tone_used, outcome, trigger_reason
    FROM check_ins
    WHERE user_id = ${userId}::uuid
      AND outcome IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 20
  `;

  // Get user's stated preference
  const user = await sql`
    SELECT tone_preference, preferences FROM users WHERE id = ${userId}::uuid
  `;
  const statedPreference = user[0]?.tone_preference || 'balanced';

  // Analyze what has worked
  const toneOutcomes: Record<string, { positive: number; negative: number; neutral: number }> = {
    tough_love: { positive: 0, negative: 0, neutral: 0 },
    gentle: { positive: 0, negative: 0, neutral: 0 },
    balanced: { positive: 0, negative: 0, neutral: 0 }
  };

  checkIns.forEach(ci => {
    const tone = ci.tone_used || 'balanced';
    const outcome = ci.outcome || 'neutral';
    if (toneOutcomes[tone]) {
      if (outcome === 'positive') toneOutcomes[tone].positive++;
      else if (outcome === 'negative') toneOutcomes[tone].negative++;
      else toneOutcomes[tone].neutral++;
    }
  });

  // Calculate effectiveness scores
  const effectivenessScores: Record<string, number> = {};
  for (const [tone, outcomes] of Object.entries(toneOutcomes)) {
    const total = outcomes.positive + outcomes.negative + outcomes.neutral;
    if (total > 0) {
      // Positive = 1, Neutral = 0.5, Negative = 0
      effectivenessScores[tone] = (outcomes.positive + outcomes.neutral * 0.5) / total;
    } else {
      // No data, use neutral score
      effectivenessScores[tone] = 0.5;
    }
  }

  // Find best performing tone
  let bestTone = statedPreference as 'tough_love' | 'gentle' | 'balanced';
  let bestScore = effectivenessScores[statedPreference] || 0.5;

  for (const [tone, score] of Object.entries(effectivenessScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestTone = tone as 'tough_love' | 'gentle' | 'balanced';
    }
  }

  // Build reasoning
  let reasoning = '';
  if (checkIns.length < 3) {
    reasoning = `Limited interaction history. Using stated preference: ${statedPreference}`;
    bestTone = statedPreference as 'tough_love' | 'gentle' | 'balanced';
  } else if (bestTone !== statedPreference) {
    reasoning = `Data suggests ${bestTone} tone works better than stated preference (${statedPreference}). ${bestTone} has ${Math.round(bestScore * 100)}% positive response rate.`;
  } else {
    reasoning = `Confirmed that ${bestTone} works well - ${Math.round(bestScore * 100)}% positive response rate.`;
  }

  return {
    suggestedTone: bestTone,
    confidence: checkIns.length >= 5 ? 0.8 : 0.5,
    reasoning,
    recentResponses: checkIns.slice(0, 5).map(ci => ({
      tone: ci.tone_used || 'unknown',
      outcome: ci.outcome || 'unknown'
    }))
  };
}

/**
 * Tool to calibrate communication tone based on what works.
 */
export const calibrateToneTool = new FunctionTool({
  name: 'calibrate_tone',
  description: `Analyze what communication tone works best for this user.
Use this to:
- Decide how to frame difficult feedback (direct vs. gentle)
- Choose the right encouragement style
- Adapt when user seems resistant to current approach
- Personalize motivational messages

Returns the most effective tone based on past interactions and user preference.`,
  parameters: z.object({}),
  execute: async () => {
    try {
      const user = await getOrCreateUser();
      const analysis = await analyzeToneEffectiveness(user.id);

      return {
        success: true,
        ...analysis,
        toneGuide: {
          tough_love: "Be direct, challenge them, don't sugarcoat. \"You said you would, but you didn't. What's really going on?\"",
          gentle: "Lead with empathy, validate feelings, small steps. \"It's okay to have setbacks. What felt hard about this week?\"",
          balanced: "Mix accountability with support. \"I notice you missed a few days - that's normal. Let's figure out what happened and adjust.\""
        }
      };
    } catch (error) {
      console.error('Error calibrating tone:', error);
      return { 
        success: false, 
        suggestedTone: 'balanced',
        reasoning: 'Could not analyze history, defaulting to balanced tone.'
      };
    }
  },
});

/**
 * Tool to update tone preference based on explicit feedback.
 */
export const updateTonePreferenceTool = new FunctionTool({
  name: 'update_tone_preference',
  description: `Update the user's preferred communication tone.
Use this when:
- User explicitly says they want more/less tough love
- User seems frustrated with current approach
- User asks to change the coaching style

This updates both the preference AND informs future calibration.`,
  parameters: z.object({
    newPreference: z.enum(['tough_love', 'gentle', 'balanced']).describe('The new tone preference'),
    reason: z.string().optional().describe('Why the change is being made'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      await sql`
        UPDATE users 
        SET tone_preference = ${params.newPreference}, updated_at = NOW()
        WHERE id = ${user.id}::uuid
      `;

      const toneDescriptions = {
        tough_love: "I'll be more direct with you - expect honest feedback and accountability.",
        gentle: "I'll focus on encouragement and take things at your pace. Every step counts.",
        balanced: "I'll mix honest feedback with support - challenging you while understanding life happens."
      };

      return {
        success: true,
        newPreference: params.newPreference,
        message: `Got it! ${toneDescriptions[params.newPreference]}${params.reason ? ` (Noted: ${params.reason})` : ''}`
      };
    } catch (error) {
      console.error('Error updating tone preference:', error);
      return { success: false, message: 'Failed to update tone preference.' };
    }
  },
});

/**
 * Tool to get tone guidance for a specific situation.
 */
export const getToneGuidanceTool = new FunctionTool({
  name: 'get_tone_guidance',
  description: `Get specific tone guidance for a situation.
Use this before delivering:
- Difficult feedback about missed goals
- Celebrations and praise
- Suggestions that require behavior change
- Responses to frustration or discouragement

Tells you HOW to say something based on what works for this user.`,
  parameters: z.object({
    situation: z.enum([
      'missed_goal',
      'achieved_goal', 
      'long_absence',
      'expressing_frustration',
      'asking_for_change',
      'giving_feedback',
      'morning_checkin',
      'evening_reflection'
    ]).describe('The type of situation'),
    additionalContext: z.string().optional().describe('Any additional context about the situation'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      const analysis = await analyzeToneEffectiveness(user.id);
      const tone = analysis.suggestedTone;

      // Situation-specific guidance
      const guidance: Record<string, Record<string, string>> = {
        missed_goal: {
          tough_love: "Be direct: 'You set this goal but didn't follow through. What's actually stopping you?' Push for real answers, not excuses.",
          gentle: "Lead with understanding: 'I see this week didn't go as planned. That's okay - let's figure out what made it hard and adjust.'",
          balanced: "Acknowledge and redirect: 'You came up short this week, which happens. But let's not let it become a pattern - what needs to change?'"
        },
        achieved_goal: {
          tough_love: "Celebrate but push forward: 'Great work hitting your target. Now let's talk about leveling up - you can do more.'",
          gentle: "Full celebration: 'This is amazing! Take a moment to really feel proud of what you accomplished. This is proof you can do this.'",
          balanced: "Acknowledge and build: 'Excellent work! This shows your approach is working. Ready to build on this momentum?'"
        },
        long_absence: {
          tough_love: "Direct address: 'It's been a while. Are you still committed to this goal, or do we need to have an honest conversation?'",
          gentle: "Warm welcome back: 'Hey! Good to see you. Life gets busy - no judgment. What's been going on?'",
          balanced: "Curious check-in: 'Welcome back! I noticed you've been away. Everything okay? Let's get you back on track.'"
        },
        expressing_frustration: {
          tough_love: "Validate then challenge: 'I hear you're frustrated. But frustration means you care. Let's channel that into action.'",
          gentle: "Pure validation first: 'That sounds really hard. Your feelings are valid. Take a breath - we'll work through this together.'",
          balanced: "Acknowledge and problem-solve: 'I understand the frustration. Let's break this down - what specifically isn't working?'"
        },
        asking_for_change: {
          tough_love: "Clear and direct: 'Here's what I need you to try. Commit to it for one week before deciding it doesn't work.'",
          gentle: "Collaborative: 'Would you be open to trying something different? We could start small and see how it feels.'",
          balanced: "Reasoned suggestion: 'Based on your patterns, I think this change could help. What do you think about trying it?'"
        },
        giving_feedback: {
          tough_love: "Honest and clear: State the observation directly, then what needs to change. No softening.",
          gentle: "Sandwich approach: Start positive, share the feedback gently, end with encouragement and support.",
          balanced: "Straightforward but kind: Share the feedback clearly while acknowledging effort and providing next steps."
        },
        morning_checkin: {
          tough_love: "Action-focused: 'New day. What's the plan? What will you accomplish today?'",
          gentle: "Warm start: 'Good morning! How are you feeling today? What would make today a win for you?'",
          balanced: "Purposeful: 'Morning! Let's set you up for success. What's your main focus today?'"
        },
        evening_reflection: {
          tough_love: "Accountability: 'How did today stack up against your goals? Be honest.'",
          gentle: "Appreciative: 'How was your day? What went well, and what are you grateful for?'",
          balanced: "Reflective: 'End of day check-in - what worked today, and what could be better tomorrow?'"
        }
      };

      const situationGuidance = guidance[params.situation]?.[tone] || 
        'Adapt your response based on context while staying true to their preferred communication style.';

      return {
        success: true,
        situation: params.situation,
        recommendedTone: tone,
        guidance: situationGuidance,
        toneReasoning: analysis.reasoning,
        confidence: analysis.confidence
      };
    } catch (error) {
      console.error('Error getting tone guidance:', error);
      return { 
        success: false, 
        recommendedTone: 'balanced',
        guidance: 'When in doubt, be supportive but honest.'
      };
    }
  },
});
