import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const logActivityTool = new FunctionTool({
  name: 'log_activity',
  description:
    'Log a daily activity like exercise, meal, sleep, mood, or weight. Use this when the user reports something they did.',
  parameters: z.object({
    logType: z
      .enum(['exercise', 'meal', 'sleep', 'mood', 'weight', 'stress'])
      .describe('Type of activity being logged'),
    value: z
      .string()
      .describe(
        'The main value or description of the activity (e.g., "30 minutes running", "7 hours", "150 lbs")'
      ),
    notes: z.string().optional().describe('Additional notes from the user'),
  }),
  execute: async (params) => {
    // TODO: Connect to database
    console.log('Logging activity:', params);
    return { success: true, message: 'Activity logged successfully.' };
  },
});
