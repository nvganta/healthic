import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const getGoalsTool = new FunctionTool({
  name: 'get_goals',
  description:
    "Retrieve the user's current active goals. Use this to understand what the user is working towards.",
  parameters: z.object({}),
  execute: async () => {
    // TODO: Connect to database
    return { goals: [], message: 'No goals set yet. Would you like to set a health resolution?' };
  },
});
