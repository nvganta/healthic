import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

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
    try {
      const user = await getOrCreateUser();

      const result = await sql`
        INSERT INTO daily_logs (user_id, log_date, log_type, data, notes)
        VALUES (
          ${user.id},
          CURRENT_DATE,
          ${params.logType},
          ${JSON.stringify({ value: params.value })},
          ${params.notes ?? null}
        )
        RETURNING *
      `;

      console.log('Activity logged:', result[0]);
      return {
        success: true,
        logId: result[0].id,
        message: 'Activity logged successfully.',
      };
    } catch (error) {
      console.error('Error logging activity:', error);
      return { success: false, message: 'Failed to log activity. Please try again.' };
    }
  },
});
