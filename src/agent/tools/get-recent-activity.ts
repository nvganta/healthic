import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

export const getRecentActivityTool = new FunctionTool({
  name: 'get_recent_activity',
  description:
    "Get the user's recent activity logs to understand their progress and patterns.",
  parameters: z.object({
    days: z.number().default(7).describe('Number of days of history to retrieve'),
    logType: z
      .enum(['exercise', 'meal', 'sleep', 'mood', 'weight', 'stress', 'all'])
      .default('all')
      .describe('Type of activity to retrieve'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      const days = params.days ?? 7;
      const logType = params.logType ?? 'all';

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
            AND log_date >= CURRENT_DATE - ${days}::integer
          ORDER BY log_date DESC, created_at DESC
        `;
      }

      if (activities.length === 0) {
        return { activities: [], message: 'No recent activity logged.' };
      }

      return {
        activities: activities.map((a) => ({
          id: a.id,
          date: a.log_date,
          type: a.log_type,
          data: a.data,
          notes: a.notes,
        })),
        message: `Found ${activities.length} activity log(s) from the last ${days} days.`,
      };
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return { activities: [], message: 'Failed to retrieve activity logs.' };
    }
  },
});
