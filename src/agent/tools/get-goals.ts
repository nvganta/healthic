import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

export const getGoalsTool = new FunctionTool({
  name: 'get_goals',
  description:
    "Retrieve the user's current active goals. Use this to understand what the user is working towards.",
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
        goals: goals.map((g) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          goalType: g.goal_type,
          targetValue: g.target_value,
          targetUnit: g.target_unit,
          targetDate: g.target_date,
          createdAt: g.created_at,
        })),
        message: `Found ${goals.length} active goal(s).`,
      };
    } catch (error) {
      console.error('Error getting goals:', error);
      return { goals: [], message: 'Failed to retrieve goals.' };
    }
  },
});
