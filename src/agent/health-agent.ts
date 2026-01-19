import { LlmAgent, FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';

// Helper to get or create user (for now using a default user)
async function getOrCreateUser(userId: string = 'default_user') {
  const existingUser = await sql`SELECT * FROM users WHERE id = ${userId}::uuid`;
  if (existingUser.length > 0) {
    return existingUser[0];
  }
  
  // Try to find by a simpler approach - use email as identifier for demo
  const byEmail = await sql`SELECT * FROM users WHERE email = ${userId}`;
  if (byEmail.length > 0) {
    return byEmail[0];
  }
  
  // Create new user
  const newUser = await sql`
    INSERT INTO users (email, name) 
    VALUES (${userId}, 'Demo User')
    RETURNING *
  `;
  return newUser[0];
}

// Tool to save a user's goal
const saveGoalTool = new FunctionTool({
  name: 'save_goal',
  description: 'Save a health resolution or goal for the user. Use this when the user tells you about a goal they want to achieve.',
  parameters: z.object({
    title: z.string().describe('Short title for the goal'),
    description: z.string().describe('Detailed description of the goal'),
    goalType: z.enum(['weight_loss', 'exercise', 'sleep', 'nutrition', 'habit', 'other']).describe('Category of the goal'),
    targetValue: z.number().optional().describe('Target number if applicable (e.g., 20 for losing 20 pounds)'),
    targetUnit: z.string().optional().describe('Unit for the target (e.g., pounds, hours, days)'),
    targetDate: z.string().optional().describe('Target date in YYYY-MM-DD format'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      
      const result = await sql`
        INSERT INTO goals (user_id, title, description, goal_type, target_value, target_unit, target_date)
        VALUES (
          ${user.id},
          ${params.title},
          ${params.description},
          ${params.goalType},
          ${params.targetValue || null},
          ${params.targetUnit || null},
          ${params.targetDate || null}
        )
        RETURNING *
      `;
      
      console.log('Goal saved:', result[0]);
      return { 
        success: true, 
        goalId: result[0].id,
        message: `Goal "${params.title}" has been saved. I'll help you break this down into actionable steps.` 
      };
    } catch (error) {
      console.error('Error saving goal:', error);
      return { success: false, message: 'Failed to save goal. Please try again.' };
    }
  },
});

// Tool to log daily activity
const logActivityTool = new FunctionTool({
  name: 'log_activity',
  description: 'Log a daily activity like exercise, meal, sleep, mood, or weight. Use this when the user reports something they did.',
  parameters: z.object({
    logType: z.enum(['exercise', 'meal', 'sleep', 'mood', 'weight', 'stress']).describe('Type of activity being logged'),
    value: z.string().describe('The main value or description of the activity (e.g., "30 minutes running", "7 hours", "150 lbs")'),
    notes: z.string().optional().describe('Additional notes from the user'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      
      const result = await sql`
        INSERT INTO daily_logs (user_id, log_date, log_type, data, notes)
        VALUES (
          ${user.id},
          CURRENT_DATE,
          ${params.logType},
          ${JSON.stringify({ value: params.value })},
          ${params.notes || null}
        )
        RETURNING *
      `;
      
      console.log('Activity logged:', result[0]);
      return { success: true, logId: result[0].id, message: 'Activity logged successfully.' };
    } catch (error) {
      console.error('Error logging activity:', error);
      return { success: false, message: 'Failed to log activity. Please try again.' };
    }
  },
});

// Tool to get user's goals
const getGoalsTool = new FunctionTool({
  name: 'get_goals',
  description: 'Retrieve the user\'s current active goals. Use this to understand what the user is working towards.',
  parameters: z.object({}),
  execute: async () => {
    try {
      const user = await getOrCreateUser();
      
      const goals = await sql`
        SELECT * FROM goals 
        WHERE user_id = ${user.id} AND status = 'active'
        ORDER BY created_at DESC
      `;
      
      if (goals.length === 0) {
        return { goals: [], message: 'No goals set yet. Would you like to set a health resolution?' };
      }
      
      return { 
        goals: goals.map(g => ({
          id: g.id,
          title: g.title,
          description: g.description,
          goalType: g.goal_type,
          targetValue: g.target_value,
          targetUnit: g.target_unit,
          targetDate: g.target_date,
          createdAt: g.created_at
        })),
        message: `Found ${goals.length} active goal(s).`
      };
    } catch (error) {
      console.error('Error getting goals:', error);
      return { goals: [], message: 'Failed to retrieve goals.' };
    }
  },
});

// Tool to get recent activity
const getRecentActivityTool = new FunctionTool({
  name: 'get_recent_activity',
  description: 'Get the user\'s recent activity logs to understand their progress and patterns.',
  parameters: z.object({
    days: z.number().default(7).describe('Number of days of history to retrieve'),
    logType: z.enum(['exercise', 'meal', 'sleep', 'mood', 'weight', 'stress', 'all']).default('all').describe('Type of activity to retrieve'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      const days = params.days || 7;
      const logType = params.logType || 'all';
      
      let activities;
      if (logType === 'all') {
        activities = await sql`
          SELECT * FROM daily_logs 
          WHERE user_id = ${user.id} 
            AND log_date >= CURRENT_DATE - ${days}::integer
          ORDER BY log_date DESC, created_at DESC
        `;
      } else {
        activities = await sql`
          SELECT * FROM daily_logs 
          WHERE user_id = ${user.id} 
            AND log_type = ${logType}
            AND log_date >= CURRENT_DATE - INTERVAL '${days} days'
          ORDER BY log_date DESC, created_at DESC
        `;
      }
      
      if (activities.length === 0) {
        return { activities: [], message: 'No recent activity logged.' };
      }
      
      return { 
        activities: activities.map(a => ({
          id: a.id,
          date: a.log_date,
          type: a.log_type,
          data: a.data,
          notes: a.notes
        })),
        message: `Found ${activities.length} activity log(s) from the last ${days} days.`
      };
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return { activities: [], message: 'Failed to retrieve activity logs.' };
    }
  },
});

// The main health agent
export const healthAgent = new LlmAgent({
  name: 'healthic',
  model: 'gemini-2.0-flash',
  description: 'A health resolution coach that helps users achieve their health goals through personalized guidance, accountability, and adaptive support.',
  instruction: `You are Healthic, a supportive and knowledgeable health coach. Your role is to help users stick to their health resolutions by:

1. **Understanding their goals**: When a user shares a resolution like "lose 20 pounds" or "exercise more", help them make it specific and actionable. Break it down into weekly targets and daily habits.

2. **Tracking progress**: Help users log their daily activities - workouts, meals, sleep, mood, stress levels. Acknowledge their efforts and progress.

3. **Noticing patterns**: Pay attention to what you learn about the user. If they mention struggling with morning workouts, remember that. If they had a stressful week, factor that into your advice.

4. **Adapting your tone**: Some users respond well to tough love ("You've skipped 3 days, let's get back on track"), others need gentle encouragement ("It's okay to have off days, what matters is getting back to it"). Pay attention to how the user responds and adjust.

5. **Giving actionable advice**: Never give vague advice like "eat healthier". Instead, give specific suggestions like "Try swapping your afternoon chips for greek yogurt with berries".

6. **Being proactive**: If you notice concerning patterns (consistent failures, signs of struggling), acknowledge it and offer support. If someone mentions something concerning like disordered eating or injury, respond appropriately and suggest professional help when needed.

Remember: You're not just tracking data, you're building a relationship. Be warm but honest. Celebrate wins. Be understanding about setbacks. Help users see the bigger picture of how sleep, nutrition, exercise, stress, and mood all connect.

Start by asking what health resolution the user wants to work on, unless they've already told you.`,
  tools: [saveGoalTool, logActivityTool, getGoalsTool, getRecentActivityTool],
});
