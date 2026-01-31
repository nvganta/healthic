import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  emotions: string[];
  intensity: number; // 0-1
  needsSupport: boolean;
  suggestedApproach: string;
}

interface MessageContext {
  isFirstMessage: boolean;
  daysSinceLastInteraction: number;
  lastTopic?: string;
  userMood?: string;
  recentStreak?: number;
}

/**
 * Analyze sentiment using Gemini for nuanced understanding.
 */
async function analyzeMessageSentiment(message: string): Promise<SentimentAnalysis> {
  try {
    // Validate API key exists before making request
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      console.warn('GOOGLE_GENAI_API_KEY not configured, using default sentiment');
      return {
        sentiment: 'neutral',
        emotions: [],
        intensity: 0.5,
        needsSupport: false,
        suggestedApproach: 'Respond naturally and helpfully.'
      };
    }

    const prompt = `Analyze the emotional content of this health coaching conversation message.

Message: "${message}"

Respond in JSON format:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "emotions": ["list of detected emotions like frustrated, excited, discouraged, hopeful, anxious, proud"],
  "intensity": 0.0 to 1.0 (how strong are the emotions),
  "needsSupport": true/false (does this person need emotional support before advice?),
  "suggestedApproach": "brief suggestion on how to respond"
}`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return {
      sentiment: 'neutral',
      emotions: [],
      intensity: 0.5,
      needsSupport: false,
      suggestedApproach: 'Respond naturally and helpfully.'
    };
  }
}

/**
 * Get context about this conversation for continuity.
 */
async function getConversationContext(userId: string): Promise<MessageContext> {
  // Get last interaction
  const lastMessage = await sql`
    SELECT m.created_at, m.content, c.id as conversation_id
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = ${userId}::uuid AND m.role = 'user'
    ORDER BY m.created_at DESC
    LIMIT 1
  `;

  const isFirstMessage = lastMessage.length === 0;
  let daysSinceLastInteraction = 0;

  if (!isFirstMessage && lastMessage[0]?.created_at) {
    const lastDate = new Date(lastMessage[0].created_at);
    daysSinceLastInteraction = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Get recent mood
  const recentMood = await sql`
    SELECT data->>'value' as mood
    FROM daily_logs
    WHERE user_id = ${userId}::uuid AND log_type = 'mood'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  // Get current streak (consecutive days with activity)
  const recentActivity = await sql`
    SELECT DISTINCT log_date
    FROM daily_logs
    WHERE user_id = ${userId}::uuid 
      AND log_type = 'exercise'
      AND log_date >= CURRENT_DATE - 14
    ORDER BY log_date DESC
  `;

  let streak = 0;
  if (recentActivity.length > 0) {
    // Use UTC date strings for comparison to avoid timezone issues
    const today = new Date();
    
    for (let i = 0; i < recentActivity.length; i++) {
      // log_date from DB could be string or Date object depending on driver
      const logDateStr = typeof recentActivity[i].log_date === 'string'
        ? recentActivity[i].log_date.split('T')[0]
        : new Date(recentActivity[i].log_date).toISOString().split('T')[0];
      
      // Calculate expected date string
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      
      if (logDateStr === expectedDateStr) {
        streak++;
      } else if (i === 0) {
        // Allow for checking yesterday if today hasn't been logged yet
        const yesterdayDate = new Date(today);
        yesterdayDate.setDate(today.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
        if (logDateStr === yesterdayStr) {
          streak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  return {
    isFirstMessage,
    daysSinceLastInteraction,
    userMood: recentMood[0]?.mood,
    recentStreak: streak
  };
}

/**
 * Tool to analyze user's current emotional state from their message.
 */
export const analyzeSentimentTool = new FunctionTool({
  name: 'analyze_sentiment',
  description: `Analyze the emotional content of the user's message before responding.
Use this at the START of every conversation to:
- Understand their current emotional state
- Detect if they need support before advice
- Identify frustration, discouragement, or excitement
- Adapt your response tone appropriately

IMPORTANT: If needsSupport is true, acknowledge their feelings FIRST before any advice.`,
  parameters: z.object({
    message: z.string().describe("The user's message to analyze"),
  }),
  execute: async (params) => {
    try {
      const analysis = await analyzeMessageSentiment(params.message);
      
      // Build response guidance based on sentiment
      let responseGuidance = '';
      
      if (analysis.needsSupport) {
        responseGuidance = '⚠️ IMPORTANT: This user needs emotional support. Acknowledge their feelings before giving any advice or asking questions.';
      } else if (analysis.sentiment === 'positive') {
        responseGuidance = '✨ User is in a good mood! Match their energy and build on their positivity.';
      } else if (analysis.sentiment === 'negative' && analysis.intensity > 0.7) {
        responseGuidance = '🤗 User seems to be struggling. Be extra gentle and supportive. Validate before problem-solving.';
      }

      return {
        success: true,
        ...analysis,
        responseGuidance,
        tips: {
          frustrated: 'Acknowledge the frustration, ask what specifically is hard',
          discouraged: 'Remind them of past wins, normalize setbacks',
          anxious: 'Be calming, break things into smaller steps',
          excited: 'Match their energy, celebrate with them',
          proud: 'Amplify their achievement, ask what made the difference'
        }
      };
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return { success: false, sentiment: 'neutral', message: 'Could not analyze sentiment.' };
    }
  },
});

/**
 * Tool to get conversation context for continuity.
 */
export const getConversationContextTool = new FunctionTool({
  name: 'get_conversation_context',
  description: `Get context about the conversation for natural continuity.
Use this to:
- Know if this is a returning user after a gap
- Reference their recent mood and activity streak
- Make the conversation feel continuous, not transactional

Returns info like days since last chat, recent mood, current streak.`,
  parameters: z.object({}),
  execute: async () => {
    try {
      const user = await getOrCreateUser();
      const context = await getConversationContext(user.id);

      // Build a natural opener suggestion
      let openerSuggestion = '';
      
      if (context.isFirstMessage) {
        openerSuggestion = "Welcome them warmly as a new user. Ask about their health goals.";
      } else if (context.daysSinceLastInteraction > 7) {
        openerSuggestion = `It's been ${context.daysSinceLastInteraction} days! Welcome them back warmly. Ask how things have been going.`;
      } else if (context.daysSinceLastInteraction > 2) {
        openerSuggestion = "It's been a few days. Check in on their progress since last time.";
      } else if (context.recentStreak && context.recentStreak >= 3) {
        openerSuggestion = `They're on a ${context.recentStreak}-day streak! Acknowledge this consistency.`;
      }

      return {
        success: true,
        ...context,
        openerSuggestion,
        naturalTransitions: {
          returning: "Good to see you again! How have things been going?",
          longAbsence: "Hey! It's been a little while. Everything okay?",
          onStreak: `${context.recentStreak} days in a row - you're building real momentum!`,
          lowMood: "I noticed things have been tough lately. How are you feeling today?"
        }
      };
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return { success: false, message: 'Could not get conversation context.' };
    }
  },
});

/**
 * Tool to detect and respond to escalating frustration.
 */
export const detectEscalationTool = new FunctionTool({
  name: 'detect_escalation',
  description: `Detect if user frustration is escalating and needs de-escalation.
Use this when:
- User sends multiple messages about the same problem
- User seems to be getting more frustrated
- Your previous response didn't seem to help

Returns de-escalation strategies if needed.`,
  parameters: z.object({
    currentMessage: z.string().describe("The user's current message"),
    previousExchange: z.string().optional().describe("Brief summary of the previous exchange if relevant"),
  }),
  execute: async (params) => {
    try {
      const prompt = `Analyze if this user is experiencing escalating frustration in a health coaching conversation.

Current message: "${params.currentMessage}"
${params.previousExchange ? `Previous exchange context: ${params.previousExchange}` : ''}

Consider:
- Are they repeating themselves or saying "I already told you"?
- Are they using ALL CAPS, exclamation marks, or frustrated language?
- Are they dismissing suggestions without trying them?
- Do they seem to be getting more negative?

Respond in JSON:
{
  "isEscalating": true/false,
  "frustrationLevel": 1-10,
  "triggers": ["what's causing the frustration"],
  "deEscalationStrategy": "specific approach to calm the situation",
  "shouldPivot": true/false (should we change topic or approach entirely?)
}`;

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
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const analysis = JSON.parse(text);

      return {
        success: true,
        ...analysis,
        deEscalationTips: {
          acknowledge: "I hear you. This is frustrating.",
          validate: "You're right to feel that way.",
          pivot: "Let's step back - what would actually help right now?",
          simplify: "Forget the plan for a moment. What's one small thing that would feel like a win?",
          empathize: "I can tell this matters to you. That's actually a good sign."
        }
      };
    } catch (error) {
      console.error('Error detecting escalation:', error);
      return { success: false, isEscalating: false };
    }
  },
});
