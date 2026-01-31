import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';

export const decomposeGoalTool = new FunctionTool({
  name: 'decompose_goal',
  description: `Break down a saved goal into weekly targets and daily actions.
Call this IMMEDIATELY after saving a goal to create an actionable plan.
This calculates weekly milestones and suggests specific daily habits.`,
  parameters: z.object({
    goalId: z.string().describe('The ID of the goal to decompose (from save_goal response)'),
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
      // Verify the goal exists
      const goals = await sql`SELECT * FROM goals WHERE id = ${params.goalId}`;
      if (goals.length === 0) {
        return { success: false, message: 'Goal not found. Please save the goal first.' };
      }

      const goal = goals[0];

      // Save each weekly target to the database
      const savedTargets = [];
      for (const target of params.weeklyTargets) {
        await sql`
          INSERT INTO weekly_targets (goal_id, week_start, target_value, notes)
          VALUES (
            ${params.goalId},
            ${target.weekStart},
            ${target.targetValue},
            ${JSON.stringify({
              weekNumber: target.weekNumber,
              description: target.targetDescription,
              dailyActions: target.dailyActions,
            })}
          )
          RETURNING *
        `;
        savedTargets.push({
          weekNumber: target.weekNumber,
          weekStart: target.weekStart,
          target: target.targetDescription,
          dailyActions: target.dailyActions,
        });
      }

      console.log('Goal decomposed:', savedTargets.length, 'weekly targets created');

      return {
        success: true,
        message: `Created ${savedTargets.length} weekly targets for "${goal.title}"`,
        plan: savedTargets,
      };
    } catch (error) {
      console.error('Error decomposing goal:', error);
      return { success: false, message: 'Failed to create weekly targets. Please try again.' };
    }
  },
});
