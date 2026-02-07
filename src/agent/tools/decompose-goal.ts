import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const decomposeGoalTool = new FunctionTool({
  name: 'decompose_goal',
  description: `Break down a proposed goal into weekly targets and daily actions.
Call this IMMEDIATELY after proposing a goal with save_goal.
The decomposition will be shown to the user for review and approval before saving.`,
  parameters: z.object({
    weeklyTargets: z.array(
      z.object({
        weekNumber: z.number().describe('Week number (1, 2, 3, etc.)'),
        weekStart: z.string().describe('Start date of the week in YYYY-MM-DD format'),
        targetValue: z.number().describe('Target value for this week (e.g., 1.5 for 1.5 lbs)'),
        targetDescription: z.string().describe('Human-readable description of what to achieve this week'),
        dailyActions: z.array(z.string()).describe('List of specific daily actions to take this week'),
      })
    ).describe('Array of weekly targets with daily actions. Create realistic, progressive targets.'),
  }),
  execute: async (params) => {
    try {
      // Return the weekly targets as a proposal instead of saving directly
      // The chat route will combine this with the goal proposal and show to user
      const proposedWeeklyTargets = params.weeklyTargets.map((target) => ({
        weekNumber: target.weekNumber,
        weekStart: target.weekStart,
        targetValue: target.targetValue,
        targetDescription: target.targetDescription,
        dailyActions: target.dailyActions,
      }));

      console.log('Weekly targets proposed for approval:', proposedWeeklyTargets.length, 'weeks');

      return {
        success: true,
        proposal: true,
        proposedWeeklyTargets,
        message: `I've created a ${proposedWeeklyTargets.length}-week plan. Please review and approve the plan to start tracking your progress.`,
      };
    } catch (error) {
      console.error('Error preparing weekly targets proposal:', error);
      return { success: false, message: 'Failed to create weekly breakdown. Please try again.' };
    }
  },
});
