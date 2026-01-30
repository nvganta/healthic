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

      // Parse targetDate - handle both YYYY-MM-DD and relative dates like "in 2 months"
      let targetDate: string | null = null;
      if (params.targetDate) {
        // Check if it's already a valid YYYY-MM-DD date
        if (/^\d{4}-\d{2}-\d{2}$/.test(params.targetDate)) {
          targetDate = params.targetDate;
        } else {
          // Try to parse relative date expressions
          const now = new Date();
          const lower = params.targetDate.toLowerCase();
          const numMatch = lower.match(/(\d+)/);
          const num = numMatch ? parseInt(numMatch[1]) : 1;

          if (lower.includes('month')) {
            now.setMonth(now.getMonth() + num);
            targetDate = now.toISOString().split('T')[0];
          } else if (lower.includes('week')) {
            now.setDate(now.getDate() + num * 7);
            targetDate = now.toISOString().split('T')[0];
          } else if (lower.includes('day')) {
            now.setDate(now.getDate() + num);
            targetDate = now.toISOString().split('T')[0];
          } else if (lower.includes('year')) {
            now.setFullYear(now.getFullYear() + num);
            targetDate = now.toISOString().split('T')[0];
          }
          // If we still can't parse it, leave as null rather than crashing
        }
      }

      const result = await sql`
        INSERT INTO goals (user_id, title, description, goal_type, target_value, target_unit, target_date)
        VALUES (
          ${user.id},
          ${params.title},
          ${params.description},
          ${params.goalType},
          ${params.targetValue ?? null},
          ${params.targetUnit ?? null},
          ${targetDate}
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
