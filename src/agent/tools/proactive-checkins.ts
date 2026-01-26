import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

interface CheckInTrigger {
  type: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedTone: 'tough_love' | 'gentle' | 'balanced';
  suggestedMessage: string;
}

/**
 * Analyzes user behavior to determine if a proactive check-in is needed.
 * Returns triggers based on:
 * - Missed activity streaks
 * - Mood/stress patterns
 * - Goal progress concerns
 * - Celebration moments
 */
async function analyzeCheckInTriggers(userId: string): Promise<CheckInTrigger[]> {
  const triggers: CheckInTrigger[] = [];

  // 1. Check for missed activity streaks
  const recentActivity = await sql`
    SELECT log_type, log_date, data 
    FROM daily_logs 
    WHERE user_id = ${userId}::uuid 
      AND log_date >= CURRENT_DATE - 14
    ORDER BY log_date DESC
  `;

  const exerciseLogs = recentActivity.filter(l => l.log_type === 'exercise');
  const lastExercise = exerciseLogs[0];
  
  if (lastExercise) {
    // Use date string comparison to avoid timezone issues
    const logDateStr = lastExercise.log_date.toISOString 
      ? lastExercise.log_date.toISOString().split('T')[0]
      : String(lastExercise.log_date).split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Calculate days difference using UTC dates
    const logDate = new Date(logDateStr + 'T00:00:00Z');
    const today = new Date(todayStr + 'T00:00:00Z');
    const daysSinceExercise = Math.floor((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceExercise >= 3 && daysSinceExercise < 5) {
      triggers.push({
        type: 'missed_streak',
        reason: `No exercise logged in ${daysSinceExercise} days`,
        priority: 'medium',
        suggestedTone: 'gentle',
        suggestedMessage: `Hey! I noticed it's been ${daysSinceExercise} days since your last workout. Everything okay? Sometimes life gets busy - want to plan a quick 15-minute activity to get back on track?`
      });
    } else if (daysSinceExercise >= 5) {
      triggers.push({
        type: 'extended_break',
        reason: `No exercise logged in ${daysSinceExercise} days - extended break`,
        priority: 'high',
        suggestedTone: 'balanced',
        suggestedMessage: `I've noticed you haven't logged any exercise in ${daysSinceExercise} days. No judgment here - I just want to check in. Are you facing any obstacles I can help with? Even a short walk counts!`
      });
    }
  }

  // 2. Check for concerning mood/stress patterns
  const moodLogs = recentActivity.filter(l => l.log_type === 'mood' || l.log_type === 'stress');
  const recentMoodLogs = moodLogs.slice(0, 5);
  
  const negativeMoods = recentMoodLogs.filter(l => {
    const value = String(l.data?.value || '').toLowerCase();
    return value.includes('bad') || value.includes('stress') || value.includes('anxious') || 
           value.includes('tired') || value.includes('low') || value.includes('overwhelmed');
  });

  if (negativeMoods.length >= 3) {
    triggers.push({
      type: 'mood_concern',
      reason: `${negativeMoods.length} negative mood entries in recent logs`,
      priority: 'high',
      suggestedTone: 'gentle',
      suggestedMessage: `I've noticed you've been feeling stressed or down lately. Your wellbeing matters more than any goal. Would you like to talk about what's going on, or should we adjust your plan to be more manageable right now?`
    });
  }

  // 3. Check goal progress
  const weeklyTargets = await sql`
    SELECT wt.*, g.title as goal_title
    FROM weekly_targets wt
    JOIN goals g ON wt.goal_id = g.id
    WHERE g.user_id = ${userId}::uuid 
      AND g.status = 'active'
      AND wt.week_start <= CURRENT_DATE
      AND wt.week_start + 7 > CURRENT_DATE
  `;

  for (const target of weeklyTargets) {
    const progress = target.actual_value && target.target_value 
      ? (target.actual_value / target.target_value) * 100 
      : 0;
    
    // Check if we're past mid-week with low progress
    const dayOfWeek = new Date().getDay();
    const isPastMidWeek = dayOfWeek >= 4; // Thursday or later
    
    if (isPastMidWeek && progress < 30) {
      triggers.push({
        type: 'goal_behind',
        reason: `Only ${Math.round(progress)}% progress on "${target.goal_title}" with few days left in week`,
        priority: 'medium',
        suggestedTone: 'tough_love',
        suggestedMessage: `Quick check-in on your "${target.goal_title}" goal - you're at ${Math.round(progress)}% for this week with just a few days left. Want to push through with an intensive couple of days, or should we adjust the target to something more realistic?`
      });
    }
  }

  // 4. Check for celebration moments
  const completedTargets = weeklyTargets.filter(t => {
    const progress = t.actual_value && t.target_value ? (t.actual_value / t.target_value) * 100 : 0;
    return progress >= 100;
  });

  if (completedTargets.length > 0) {
    triggers.push({
      type: 'celebration',
      reason: `Completed ${completedTargets.length} weekly target(s)!`,
      priority: 'medium',
      suggestedTone: 'balanced',
      suggestedMessage: `🎉 Amazing work! You've crushed your weekly target for "${completedTargets[0].goal_title}"! This is exactly the kind of consistency that leads to real results. How are you feeling about your progress?`
    });
  }

  // 5. Check for weight plateau (if tracking weight)
  const weightLogs = recentActivity
    .filter(l => l.log_type === 'weight')
    .sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime());

  if (weightLogs.length >= 4) {
    const weights = weightLogs.slice(-4).map(l => parseFloat(String(l.data?.value || 0)));
    const variance = Math.max(...weights) - Math.min(...weights);
    
    if (variance < 1) { // Less than 1 lb variance over 4+ entries
      triggers.push({
        type: 'plateau',
        reason: 'Weight has plateaued over recent entries',
        priority: 'low',
        suggestedTone: 'balanced',
        suggestedMessage: `I've noticed your weight has been stable lately. Plateaus are totally normal! Your body might be adjusting. Want to try mixing things up - maybe a new type of workout or adjusting your nutrition approach?`
      });
    }
  }

  return triggers;
}

/**
 * Tool to check if proactive outreach is needed.
 * The agent can use this to decide when to reach out to the user.
 */
export const checkForProactiveOutreachTool = new FunctionTool({
  name: 'check_for_proactive_outreach',
  description: `Analyze user's recent activity to determine if proactive check-in is warranted.
Use this to:
- Check if user needs encouragement after missing activities
- Identify concerning mood patterns that need support
- Find celebration moments to acknowledge
- Detect when goals need attention
Returns suggested check-in messages with appropriate tone.`,
  parameters: z.object({}),
  execute: async () => {
    try {
      const user = await getOrCreateUser();
      const triggers = await analyzeCheckInTriggers(user.id);

      if (triggers.length === 0) {
        return {
          shouldReachOut: false,
          message: 'No proactive check-in needed at this time. User appears to be on track.',
          triggers: []
        };
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      triggers.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      // Get user's tone preference to adjust suggestions
      const tonePreference = user.tone_preference || 'balanced';

      return {
        shouldReachOut: true,
        userTonePreference: tonePreference,
        triggers: triggers,
        topPriority: triggers[0],
        message: `Found ${triggers.length} reason(s) for check-in. Top priority: ${triggers[0].type}`
      };
    } catch (error) {
      console.error('Error checking for proactive outreach:', error);
      return { 
        shouldReachOut: false, 
        error: 'Failed to analyze check-in triggers',
        triggers: [] 
      };
    }
  },
});

/**
 * Tool to record a check-in that was sent.
 * Helps track which check-ins are effective.
 */
export const recordCheckInTool = new FunctionTool({
  name: 'record_check_in',
  description: `Record that a proactive check-in was sent to the user.
Use this after sending a check-in message to track:
- What triggered the check-in
- What tone was used
- Later: whether the user responded positively
This helps improve future check-in decisions.`,
  parameters: z.object({
    triggerReason: z.string().describe('Why the check-in was triggered'),
    toneUsed: z.enum(['tough_love', 'gentle', 'balanced']).describe('The tone used in the check-in'),
    channel: z.enum(['web', 'sms', 'whatsapp', 'voice']).default('web').describe('How the check-in was delivered'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      const result = await sql`
        INSERT INTO check_ins (user_id, trigger_reason, tone_used, channel)
        VALUES (${user.id}::uuid, ${params.triggerReason}, ${params.toneUsed}, ${params.channel})
        RETURNING id
      `;

      return {
        success: true,
        checkInId: result[0].id,
        message: 'Check-in recorded. This will help improve future outreach timing.'
      };
    } catch (error) {
      console.error('Error recording check-in:', error);
      return { success: false, message: 'Failed to record check-in.' };
    }
  },
});

/**
 * Tool to record user response to a check-in.
 * Tracks effectiveness of different check-in approaches.
 */
export const recordCheckInResponseTool = new FunctionTool({
  name: 'record_check_in_response',
  description: `Record how the user responded to a check-in.
Use this to track whether the check-in was effective:
- positive: User engaged, took action, or expressed gratitude
- negative: User seemed annoyed or dismissed the check-in
- neutral: User acknowledged but no strong reaction
This data improves future check-in decisions.`,
  parameters: z.object({
    checkInId: z.string().describe('The ID of the check-in to update'),
    outcome: z.enum(['positive', 'negative', 'neutral', 'no_response']).describe('How the user responded'),
  }),
  execute: async (params) => {
    try {
      await sql`
        UPDATE check_ins 
        SET user_responded = TRUE, outcome = ${params.outcome}
        WHERE id = ${params.checkInId}::uuid
      `;

      return {
        success: true,
        message: `Check-in response recorded as "${params.outcome}". This helps calibrate future outreach.`
      };
    } catch (error) {
      console.error('Error recording check-in response:', error);
      return { success: false, message: 'Failed to record response.' };
    }
  },
});
