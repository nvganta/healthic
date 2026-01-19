import { FunctionTool } from '@google/adk';
import { z } from 'zod';

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
    // TODO: Connect to database
    console.log('Getting recent activity:', params);
    return { activities: [], message: 'No recent activity logged.' };
  },
});
