import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

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
    try {
      const user = await getOrCreateUser();

      const result = await sql`
        INSERT INTO goals (user_id, title, description, goal_type, target_value, target_unit, target_date)
        VALUES (
          ${user.id},
          ${params.title},
          ${params.description},
          ${params.goalType},
          ${params.targetValue ?? null},
          ${params.targetUnit ?? null},
          ${params.targetDate ?? null}
        )
        RETURNING *
      `;

      console.log('Goal saved:', result[0]);
      return {
        success: true,
        goalId: result[0].id,
        message: `Goal "${params.title}" has been saved. I'll help you break this down into actionable steps.`,
      };
    } catch (error) {
      console.error('Error saving goal:', error);
      return { success: false, message: 'Failed to save goal. Please try again.' };
    }
  },
});
