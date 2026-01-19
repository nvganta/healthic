import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const saveGoalTool = new FunctionTool({
  name: 'save_goal',
  description:
    'Save a health resolution or goal for the user. Use this when the user tells you about a goal they want to achieve.',
  parameters: z.object({
    title: z.string().describe('Short title for the goal'),
    description: z.string().describe('Detailed description of the goal'),
    goalType: z
      .enum(['weight_loss', 'exercise', 'sleep', 'nutrition', 'habit', 'other'])
      .describe('Category of the goal'),
    targetValue: z
      .number()
      .optional()
      .describe('Target number if applicable (e.g., 20 for losing 20 pounds)'),
    targetUnit: z.string().optional().describe('Unit for the target (e.g., pounds, hours, days)'),
    targetDate: z.string().optional().describe('Target date in YYYY-MM-DD format'),
  }),
  execute: async (params) => {
    // TODO: Connect to database
    console.log('Saving goal:', params);
    return {
      success: true,
      message: `Goal "${params.title}" has been saved. I'll help you break this down into actionable steps.`,
    };
  },
});
