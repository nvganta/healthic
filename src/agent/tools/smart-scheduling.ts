import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

interface OptimalTiming {
  bestDays: string[];
  bestTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  responseRateByDay: Record<string, number>;
  responseRateByHour: Record<string, number>;
  confidence: number;
}

interface CheckInSchedule {
  nextCheckIn: Date | null;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedMessage: string;
  cooldownActive: boolean;
}

/**
 * Analyze when user is most responsive based on past interactions.
 */
async function analyzeOptimalTiming(userId: string): Promise<OptimalTiming> {
  // Get all messages with timestamps
  const messages = await sql`
    SELECT m.created_at, m.role
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = ${userId}::uuid
    ORDER BY m.created_at DESC
    LIMIT 200
  `;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const responseRateByDay: Record<string, number> = {};
  const responseRateByHour: Record<string, number> = {};
  const messageCountByDay: Record<string, number> = {};
  const messageCountByHour: Record<string, number> = {};

  dayNames.forEach(d => {
    responseRateByDay[d] = 0;
    messageCountByDay[d] = 0;
  });

  for (let h = 0; h < 24; h++) {
    const hourKey = `${h.toString().padStart(2, '0')}:00`;
    responseRateByHour[hourKey] = 0;
    messageCountByHour[hourKey] = 0;
  }

  // Count user messages by day and hour
  const userMessages = messages.filter(m => m.role === 'user');
  
  userMessages.forEach(msg => {
    const date = new Date(msg.created_at);
    const dayName = dayNames[date.getDay()];
    const hourKey = `${date.getHours().toString().padStart(2, '0')}:00`;
    
    messageCountByDay[dayName] = (messageCountByDay[dayName] || 0) + 1;
    messageCountByHour[hourKey] = (messageCountByHour[hourKey] || 0) + 1;
  });

  // Calculate rates (normalize by count)
  const totalMessages = userMessages.length || 1;
  
  Object.keys(messageCountByDay).forEach(day => {
    responseRateByDay[day] = Math.round((messageCountByDay[day] / totalMessages) * 100);
  });

  Object.keys(messageCountByHour).forEach(hour => {
    responseRateByHour[hour] = Math.round((messageCountByHour[hour] / totalMessages) * 100);
  });

  // Find best days
  const sortedDays = Object.entries(responseRateByDay)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => day);

  // Find best time of day
  const morningRate = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00']
    .reduce((sum, h) => sum + (responseRateByHour[h] || 0), 0);
  const afternoonRate = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
    .reduce((sum, h) => sum + (responseRateByHour[h] || 0), 0);
  const eveningRate = ['18:00', '19:00', '20:00', '21:00']
    .reduce((sum, h) => sum + (responseRateByHour[h] || 0), 0);
  const nightRate = ['22:00', '23:00', '00:00', '01:00', '02:00']
    .reduce((sum, h) => sum + (responseRateByHour[h] || 0), 0);

  const timeRates = { morning: morningRate, afternoon: afternoonRate, evening: eveningRate, night: nightRate };
  const bestTimeOfDay = Object.entries(timeRates)
    .sort(([, a], [, b]) => b - a)[0][0] as 'morning' | 'afternoon' | 'evening' | 'night';

  return {
    bestDays: sortedDays,
    bestTimeOfDay,
    responseRateByDay,
    responseRateByHour,
    confidence: userMessages.length >= 20 ? 0.8 : userMessages.length >= 10 ? 0.5 : 0.3
  };
}

/**
 * Calculate next optimal check-in time.
 */
async function calculateNextCheckIn(userId: string): Promise<CheckInSchedule> {
  // Check for cooldown (don't send check-ins too frequently)
  const recentCheckIns = await sql`
    SELECT created_at, outcome
    FROM check_ins
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
    LIMIT 5
  `;

  const lastCheckIn = recentCheckIns[0];
  const hoursSinceLastCheckIn = lastCheckIn 
    ? (Date.now() - new Date(lastCheckIn.created_at).getTime()) / (1000 * 60 * 60)
    : Infinity;

  // Cooldown: minimum 24 hours between check-ins, 48 if last one was negative
  const minCooldown = lastCheckIn?.outcome === 'negative' ? 48 : 24;
  
  if (hoursSinceLastCheckIn < minCooldown) {
    return {
      nextCheckIn: null,
      reason: `Cooldown active. ${Math.round(minCooldown - hoursSinceLastCheckIn)} hours until next check-in allowed.`,
      priority: 'low',
      suggestedMessage: '',
      cooldownActive: true
    };
  }

  // Get optimal timing
  const timing = await analyzeOptimalTiming(userId);
  
  // Get triggers for check-in
  const lastActivity = await sql`
    SELECT log_date, log_type
    FROM daily_logs
    WHERE user_id = ${userId}::uuid AND log_type = 'exercise'
    ORDER BY log_date DESC
    LIMIT 1
  `;

  const daysSinceActivity = lastActivity.length > 0
    ? Math.floor((Date.now() - new Date(lastActivity[0].log_date).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  // Calculate next check-in
  const now = new Date();
  let nextCheckIn: Date | null = null;
  let reason = '';
  let priority: 'high' | 'medium' | 'low' = 'low';
  let suggestedMessage = '';

  if (daysSinceActivity >= 5) {
    // Urgent - extended absence
    nextCheckIn = now;
    reason = `Extended absence: ${daysSinceActivity} days without activity`;
    priority = 'high';
    suggestedMessage = `Hey! I noticed it's been ${daysSinceActivity} days. No pressure, just checking in - everything okay?`;
  } else if (daysSinceActivity >= 3) {
    // Schedule for optimal time
    const targetHour = timing.bestTimeOfDay === 'morning' ? 9 
      : timing.bestTimeOfDay === 'afternoon' ? 14 
      : timing.bestTimeOfDay === 'evening' ? 19 : 21;
    
    nextCheckIn = new Date();
    nextCheckIn.setHours(targetHour, 0, 0, 0);
    if (nextCheckIn <= now) {
      nextCheckIn.setDate(nextCheckIn.getDate() + 1);
    }
    
    reason = `${daysSinceActivity} days since last activity - gentle reminder due`;
    priority = 'medium';
    suggestedMessage = `Quick check-in - how's the week going? I noticed a bit of a gap in your activity.`;
  } else {
    // No urgent need - schedule routine check-in
    reason = 'No urgent check-in needed. User is active.';
    priority = 'low';
  }

  return {
    nextCheckIn,
    reason,
    priority,
    suggestedMessage,
    cooldownActive: false
  };
}

/**
 * Tool to learn optimal timing for user interactions.
 */
export const learnOptimalTimingTool = new FunctionTool({
  name: 'learn_optimal_timing',
  description: `Analyze when the user is most responsive and active.
Use this to:
- Know the best days/times to send check-ins
- Understand their activity patterns
- Schedule follow-ups at optimal times

Returns best days, best time of day, and confidence level.`,
  parameters: z.object({}),
  execute: async () => {
    try {
      const user = await getOrCreateUser();
      const timing = await analyzeOptimalTiming(user.id);

      const timeDescriptions = {
        morning: '6am-12pm',
        afternoon: '12pm-6pm', 
        evening: '6pm-10pm',
        night: '10pm-2am'
      };

      return {
        success: true,
        ...timing,
        summary: `User is most active on ${timing.bestDays.slice(0, 2).join(' and ')}, typically in the ${timing.bestTimeOfDay} (${timeDescriptions[timing.bestTimeOfDay]}).`,
        recommendation: timing.confidence >= 0.5 
          ? `Schedule check-ins for ${timing.bestDays[0]} ${timing.bestTimeOfDay} for best response rate.`
          : 'Not enough data yet. Continue tracking to learn patterns.'
      };
    } catch (error) {
      console.error('Error learning optimal timing:', error);
      return { success: false, message: 'Could not analyze timing patterns.' };
    }
  },
});

/**
 * Tool to get smart check-in schedule.
 */
export const getSmartCheckInScheduleTool = new FunctionTool({
  name: 'get_smart_checkin_schedule',
  description: `Get intelligent check-in scheduling that respects cooldowns and optimal timing.
Use this to:
- Know when to next reach out
- Respect cooldown periods (don't spam)
- Get pre-written message suggestions
- Understand urgency level

Returns next check-in time, reason, and suggested message.`,
  parameters: z.object({}),
  execute: async () => {
    try {
      const user = await getOrCreateUser();
      const schedule = await calculateNextCheckIn(user.id);

      return {
        success: true,
        ...schedule,
        nextCheckInFormatted: schedule.nextCheckIn 
          ? schedule.nextCheckIn.toLocaleString()
          : 'No check-in scheduled',
        guidelines: {
          high: 'Send check-in now - user may need support',
          medium: 'Schedule for optimal time - gentle nudge appropriate',
          low: 'No action needed - user is engaged'
        }
      };
    } catch (error) {
      console.error('Error getting check-in schedule:', error);
      return { success: false, message: 'Could not calculate check-in schedule.' };
    }
  },
});

/**
 * Tool to generate varied check-in messages.
 */
export const generateCheckInMessageTool = new FunctionTool({
  name: 'generate_checkin_message',
  description: `Generate a fresh, non-repetitive check-in message.
Use this to:
- Avoid sending the same message twice
- Match the message to the situation and user's tone preference
- Create natural-feeling outreach

Generates a unique message based on context and past messages sent.`,
  parameters: z.object({
    situation: z.enum([
      'missed_activity',
      'weekly_checkin', 
      'goal_progress',
      'celebration',
      'long_absence',
      'mood_concern'
    ]).describe('The type of check-in needed'),
    additionalContext: z.string().optional().describe('Any specific context to include'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      
      // Get recent check-in messages to avoid repetition
      const recentMessages = await sql`
        SELECT trigger_reason
        FROM check_ins
        WHERE user_id = ${user.id}::uuid
        ORDER BY created_at DESC
        LIMIT 10
      `;
      
      const recentReasons = recentMessages.map(m => m.trigger_reason).join(', ');
      const tonePreference = user.tone_preference || 'balanced';

      const prompt = `Generate a fresh check-in message for a health coaching app.

Situation: ${params.situation}
User's tone preference: ${tonePreference}
${params.additionalContext ? `Additional context: ${params.additionalContext}` : ''}
Recent messages sent (AVOID repeating these): ${recentReasons || 'None'}

Requirements:
- Be warm and human, not robotic
- Keep it short (1-2 sentences)
- Match the tone preference
- Don't start with "Hey!" if that was used recently
- Include a specific question or call to action

Respond in JSON:
{
  "message": "the check-in message",
  "callToAction": "what you want them to do",
  "alternativeOpeners": ["2-3 alternative opening phrases"]
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
              temperature: 0.8, // Higher temp for variety
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const generated = JSON.parse(text);

      return {
        success: true,
        situation: params.situation,
        toneUsed: tonePreference,
        ...generated
      };
    } catch (error) {
      console.error('Error generating check-in message:', error);
      return { 
        success: false, 
        message: "How's everything going? Just wanted to check in.",
        fallback: true
      };
    }
  },
});
