import { LlmAgent, FunctionTool } from '@google/adk';
import { z } from 'zod';

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
    // This will be connected to the database later
    console.log('Saving goal:', params);
    return { success: true, message: `Goal "${params.title}" has been saved. I'll help you break this down into actionable steps.` };
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
    console.log('Logging activity:', params);
    return { success: true, message: 'Activity logged successfully.' };
  },
});

// Tool to get user's goals
const getGoalsTool = new FunctionTool({
  name: 'get_goals',
  description: 'Retrieve the user\'s current active goals. Use this to understand what the user is working towards.',
  parameters: z.object({}),
  execute: async () => {
    // This will be connected to the database later
    return { goals: [], message: 'No goals set yet. Would you like to set a health resolution?' };
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
    console.log('Getting recent activity:', params);
    return { activities: [], message: 'No recent activity logged.' };
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
