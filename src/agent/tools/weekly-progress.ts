import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

/**
 * Tool to get weekly targets and track progress.
 * Helps the agent understand how the user is doing against their plan.
 */
export const getWeeklyProgressTool = new FunctionTool({
  name: 'get_weekly_progress',
  description: "Get the current week's targets and progress for the user's goals. Use this to check how they're doing against their weekly plan and provide encouragement or adjustments.",
  parameters: z.object({
    goalId: z.string().optional().describe('Specific goal ID, or leave empty for all active goals'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      
      let targets;
      if (params.goalId) {
        targets = await sql`
          SELECT wt.*, g.title as goal_title, g.goal_type, g.target_value as goal_target, g.target_unit
          FROM weekly_targets wt
          JOIN goals g ON wt.goal_id = g.id
          WHERE g.user_id = ${user.id} 
            AND g.id = ${params.goalId}::uuid
            AND wt.week_start <= CURRENT_DATE
            AND wt.week_start + 7 > CURRENT_DATE
        `;
      } else {
        targets = await sql`
          SELECT wt.*, g.title as goal_title, g.goal_type, g.target_value as goal_target, g.target_unit
          FROM weekly_targets wt
          JOIN goals g ON wt.goal_id = g.id
          WHERE g.user_id = ${user.id} 
            AND g.status = 'active'
            AND wt.week_start <= CURRENT_DATE
            AND wt.week_start + 7 > CURRENT_DATE
        `;
      }
      
      if (targets.length === 0) {
        return { 
          targets: [], 
          message: 'No weekly targets found for the current week. Consider using decompose_goal to create a weekly plan.' 
        };
      }
      
      // Calculate progress percentage for each target
      const targetsWithProgress = targets.map(t => {
        const progress = t.actual_value && t.target_value 
          ? Math.round((t.actual_value / t.target_value) * 100)
          : 0;
        return {
          id: t.id,
          goalTitle: t.goal_title,
          goalType: t.goal_type,
          weekStart: t.week_start,
          targetValue: t.target_value,
          actualValue: t.actual_value || 0,
          progressPercent: progress,
          notes: t.notes,
          goalTarget: t.goal_target,
          targetUnit: t.target_unit,
        };
      });
      
      return { 
        targets: targetsWithProgress,
        message: `Found ${targets.length} target(s) for this week.`
      };
    } catch (error) {
      console.error('Error getting weekly progress:', error);
      return { targets: [], message: 'Failed to retrieve weekly targets.' };
    }
  },
});

/**
 * Tool to update progress on a weekly target.
 */
export const updateWeeklyProgressTool = new FunctionTool({
  name: 'update_weekly_progress',
  description: "Update the actual progress value for a weekly target. Use this when the user reports progress toward their weekly goal.",
  parameters: z.object({
    targetId: z.string().describe('The ID of the weekly target to update'),
    actualValue: z.number().nonnegative().describe('The actual value achieved so far this week (must be non-negative)'),
    notes: z.string().optional().describe('Optional notes about the progress'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      const result = await sql`
        UPDATE weekly_targets wt
        SET 
          actual_value = ${params.actualValue},
          notes = COALESCE(${params.notes || null}, wt.notes)
        FROM goals g
        WHERE wt.id = ${params.targetId}::uuid
          AND wt.goal_id = g.id
          AND g.user_id = ${user.id}
        RETURNING wt.*
      `;
      
      if (result.length === 0) {
        return { success: false, message: 'Weekly target not found.' };
      }
      
      const target = result[0];
      const progress = target.target_value 
        ? Math.round((params.actualValue / target.target_value) * 100)
        : 0;
      
      let encouragement = '';
      if (progress < 0) {
        encouragement = "Let's refocus and get back on track.";
      } else if (progress >= 100) {
        encouragement = "🎉 Amazing! You've hit your weekly target!";
      } else if (progress >= 75) {
        encouragement = "💪 Great progress! You're almost there!";
      } else if (progress >= 50) {
        encouragement = "👍 Solid progress! Keep it up!";
      } else {
        encouragement = "📈 Good start! Every bit counts.";
      }
      
      return { 
        success: true, 
        progressPercent: progress,
        message: `Progress updated to ${params.actualValue}. ${encouragement}` 
      };
    } catch (error) {
      console.error('Error updating weekly progress:', error);
      return { success: false, message: 'Failed to update progress.' };
    }
  },
});
