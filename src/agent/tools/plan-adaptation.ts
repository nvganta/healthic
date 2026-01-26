import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

interface AdaptationSuggestion {
  type: 'timing' | 'intensity' | 'frequency' | 'type' | 'target';
  currentValue: string;
  suggestedValue: string;
  reason: string;
  confidence: number;
}

interface PlanAnalysis {
  goalId: string;
  goalTitle: string;
  isWorking: boolean;
  successRate: number;
  suggestions: AdaptationSuggestion[];
}

/**
 * Analyzes a goal's weekly targets and activity logs to determine if the plan is working.
 */
async function analyzePlanEffectiveness(userId: string, goalId?: string): Promise<PlanAnalysis[]> {
  const analyses: PlanAnalysis[] = [];

  // Get goals
  let goals;
  if (goalId) {
    goals = await sql`
      SELECT * FROM goals 
      WHERE user_id = ${userId}::uuid AND id = ${goalId}::uuid
    `;
  } else {
    goals = await sql`
      SELECT * FROM goals 
      WHERE user_id = ${userId}::uuid AND status = 'active'
    `;
  }

  for (const goal of goals) {
    const suggestions: AdaptationSuggestion[] = [];

    // Get weekly targets history for this goal
    const weeklyHistory = await sql`
      SELECT * FROM weekly_targets 
      WHERE goal_id = ${goal.id}::uuid
      ORDER BY week_start DESC
      LIMIT 6
    `;

    // Get related activity logs
    const activityLogs = await sql`
      SELECT * FROM daily_logs
      WHERE user_id = ${userId}::uuid
        AND created_at >= NOW() - INTERVAL '42 days'
      ORDER BY log_date DESC
    `;

    // Calculate success rate (weeks where actual >= 80% of target)
    const completedWeeks = weeklyHistory.filter(w => {
      if (!w.target_value || !w.actual_value) return false;
      return (w.actual_value / w.target_value) >= 0.8;
    });
    const successRate = weeklyHistory.length > 0 
      ? (completedWeeks.length / weeklyHistory.length) * 100 
      : 0;

    const isWorking = successRate >= 60;

    // Analyze patterns for suggestions
    if (!isWorking && weeklyHistory.length >= 2) {
      // Check if targets are too aggressive
      const avgCompletion = weeklyHistory.reduce((sum, w) => {
        if (!w.target_value || !w.actual_value) return sum;
        return sum + (w.actual_value / w.target_value);
      }, 0) / weeklyHistory.length;

      if (avgCompletion < 0.5) {
        const currentTarget = weeklyHistory[0]?.target_value || 0;
        const suggestedTarget = Math.round(currentTarget * 0.7);
        
        suggestions.push({
          type: 'target',
          currentValue: `${currentTarget}`,
          suggestedValue: `${suggestedTarget}`,
          reason: `Average completion is ${Math.round(avgCompletion * 100)}%. Reducing the weekly target will help build momentum and consistency.`,
          confidence: 0.8
        });
      }

      // Analyze time-of-day patterns for exercise goals
      if (goal.goal_type === 'exercise' || goal.goal_type === 'weight_loss') {
        const exerciseLogs = activityLogs.filter(l => l.log_type === 'exercise');
        
        // Check for day-of-week patterns
        const daySuccess: Record<string, { logged: number; total: number }> = {};
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        dayNames.forEach(d => daySuccess[d] = { logged: 0, total: 0 });

        // Count exercise days - use local timezone for day-of-week analysis
        const uniqueDates = new Set(exerciseLogs.map(l => l.log_date));
        uniqueDates.forEach(date => {
          // Use local timezone (getDay) not UTC (getUTCDay) for user's day-of-week
          const dayName = dayNames[new Date(date).getDay()];
          daySuccess[dayName].logged++;
        });

        // Find weak days (assuming 6 weeks of data)
        const weakDays = Object.entries(daySuccess)
          .filter(([, stats]) => stats.logged <= 1)
          .map(([day]) => day);

        if (weakDays.length > 0 && weakDays.length <= 3) {
          suggestions.push({
            type: 'timing',
            currentValue: 'Current schedule',
            suggestedValue: `Consider rest days on ${weakDays.join(', ')} or switch to lighter activities`,
            reason: `You consistently miss workouts on ${weakDays.join(', ')}. Working with your natural patterns is more sustainable than fighting them.`,
            confidence: 0.7
          });
        }
      }

      // Check for intensity issues
      const notes = weeklyHistory
        .filter(w => w.notes)
        .map(w => w.notes?.toLowerCase() || '');
      
      const tiredMentions = notes.filter(n => 
        n.includes('tired') || n.includes('exhausted') || n.includes('sore') || n.includes('burnt out')
      ).length;

      if (tiredMentions >= 2) {
        suggestions.push({
          type: 'intensity',
          currentValue: 'Current intensity',
          suggestedValue: 'Reduce intensity, add recovery days',
          reason: `Multiple notes mention fatigue or exhaustion. Your body might need more recovery time. Quality over quantity.`,
          confidence: 0.75
        });
      }
    }

    // Even if working, look for optimization opportunities
    if (isWorking && successRate >= 90) {
      suggestions.push({
        type: 'target',
        currentValue: weeklyHistory[0]?.target_value?.toString() || 'current',
        suggestedValue: 'Consider increasing by 10-15%',
        reason: `You're consistently hitting your targets! You might be ready for a small increase to keep progressing.`,
        confidence: 0.6
      });
    }

    analyses.push({
      goalId: goal.id,
      goalTitle: goal.title,
      isWorking,
      successRate: Math.round(successRate),
      suggestions
    });
  }

  return analyses;
}

/**
 * Tool to analyze if the current plan is working and suggest adaptations.
 */
export const analyzePlanEffectivenessTool = new FunctionTool({
  name: 'analyze_plan_effectiveness',
  description: `Analyze whether the user's current plan is working and suggest adaptations.
Use this when:
- User says they're struggling or the plan isn't working
- Weekly targets are consistently not being met
- User asks for help adjusting their approach
- Before the start of a new week to review progress

Returns analysis of each goal with specific adaptation suggestions.`,
  parameters: z.object({
    goalId: z.string().optional().describe('Specific goal to analyze, or leave empty for all active goals'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      const analyses = await analyzePlanEffectiveness(user.id, params.goalId);

      if (analyses.length === 0) {
        return {
          success: true,
          analyses: [],
          message: 'No active goals found to analyze. Set a goal first using save_goal and decompose_goal.'
        };
      }

      const workingCount = analyses.filter(a => a.isWorking).length;
      const totalSuggestions = analyses.reduce((sum, a) => sum + a.suggestions.length, 0);

      return {
        success: true,
        analyses,
        summary: {
          totalGoals: analyses.length,
          goalsOnTrack: workingCount,
          goalsNeedingAttention: analyses.length - workingCount,
          totalSuggestions
        },
        message: `Analyzed ${analyses.length} goal(s). ${workingCount} on track, ${analyses.length - workingCount} need attention. ${totalSuggestions} adaptation suggestion(s) found.`
      };
    } catch (error) {
      console.error('Error analyzing plan effectiveness:', error);
      return { success: false, message: 'Failed to analyze plan effectiveness.' };
    }
  },
});

/**
 * Tool to apply a plan adaptation.
 */
export const applyPlanAdaptationTool = new FunctionTool({
  name: 'apply_plan_adaptation',
  description: `Apply an adaptation to the user's plan based on analysis.
Use this after discussing suggested changes with the user.
Can modify:
- Weekly target values
- Goal target dates
- Add notes about the change for tracking

Always explain to the user why the change is being made.`,
  parameters: z.object({
    goalId: z.string().describe('The goal to adapt'),
    adaptationType: z.enum(['reduce_target', 'increase_target', 'extend_deadline', 'pause_goal', 'add_note']).describe('Type of adaptation'),
    newValue: z.string().optional().describe('New value for the target or deadline'),
    reason: z.string().describe('Reason for the adaptation - will be stored for future reference'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      // Verify the goal belongs to this user
      const goal = await sql`
        SELECT * FROM goals 
        WHERE id = ${params.goalId}::uuid AND user_id = ${user.id}::uuid
      `;

      if (goal.length === 0) {
        return { success: false, message: 'Goal not found.' };
      }

      switch (params.adaptationType) {
        case 'reduce_target':
        case 'increase_target': {
          const newTarget = parseFloat(params.newValue || '0');
          if (isNaN(newTarget) || newTarget <= 0) {
            return { success: false, message: 'Invalid target value.' };
          }

          // Update the goal's target
          await sql`
            UPDATE goals 
            SET target_value = ${newTarget}, updated_at = NOW()
            WHERE id = ${params.goalId}::uuid
          `;

          // Update current week's target if exists
          // Calculate weekly target intelligently based on goal type and timeline
          const currentGoal = goal[0];
          const daysToDeadline = currentGoal.target_date 
            ? Math.max(7, Math.ceil((new Date(currentGoal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : 90; // Default 90 days if no deadline
          const weeksRemaining = Math.max(1, Math.ceil(daysToDeadline / 7));
          
          // Calculate weekly target as portion of remaining goal, capped at reasonable values
          const weeklyTarget = Math.min(
            newTarget * 0.2, // Cap at 20% per week max
            Math.max(
              newTarget / weeksRemaining, // Divide evenly across remaining weeks
              newTarget * 0.02 // At least 2% per week
            )
          );

          // Update weekly target with truncated notes to prevent unbounded growth
          // Keep only the last 500 characters of notes to maintain reasonable size
          await sql`
            UPDATE weekly_targets 
            SET target_value = ${weeklyTarget}, 
                notes = RIGHT(CONCAT(COALESCE(notes, ''), ' [Adapted: ', ${params.reason}, ']'), 500)
            WHERE goal_id = ${params.goalId}::uuid
              AND week_start <= CURRENT_DATE
              AND week_start + 7 > CURRENT_DATE
          `;

          return {
            success: true,
            message: `Goal target updated to ${newTarget}. Weekly target adjusted to ${weeklyTarget.toFixed(2)}. ${params.adaptationType === 'reduce_target' ? 'Reduced target to build consistency' : 'Increased target for continued progress'}.`,
            adaptation: { type: params.adaptationType, newValue: newTarget, weeklyTarget, reason: params.reason }
          };
        }

        case 'extend_deadline': {
          const newDate = params.newValue;
          if (!newDate) {
            return { success: false, message: 'New deadline date required.' };
          }

          await sql`
            UPDATE goals 
            SET target_date = ${newDate}::date, updated_at = NOW()
            WHERE id = ${params.goalId}::uuid
          `;

          return {
            success: true,
            message: `Goal deadline extended to ${newDate}. Taking more time is better than giving up!`,
            adaptation: { type: 'extend_deadline', newValue: newDate, reason: params.reason }
          };
        }

        case 'pause_goal': {
          await sql`
            UPDATE goals 
            SET status = 'paused', updated_at = NOW()
            WHERE id = ${params.goalId}::uuid
          `;

          return {
            success: true,
            message: `Goal paused. Sometimes we need to step back to move forward. Use save_goal when ready to resume.`,
            adaptation: { type: 'pause_goal', reason: params.reason }
          };
        }

        case 'add_note': {
          // Add a note to current weekly target
          await sql`
            UPDATE weekly_targets 
            SET notes = CONCAT(COALESCE(notes, ''), ' [Note: ', ${params.reason}, ']')
            WHERE goal_id = ${params.goalId}::uuid
              AND week_start <= CURRENT_DATE
              AND week_start + 7 > CURRENT_DATE
          `;

          return {
            success: true,
            message: `Note added to track this insight: "${params.reason}"`,
            adaptation: { type: 'add_note', reason: params.reason }
          };
        }
      }

      return { success: false, message: 'Unknown adaptation type.' };
    } catch (error) {
      console.error('Error applying plan adaptation:', error);
      return { success: false, message: 'Failed to apply adaptation.' };
    }
  },
});

/**
 * Tool to get historical adaptations for learning.
 */
export const getAdaptationHistoryTool = new FunctionTool({
  name: 'get_adaptation_history',
  description: `Get history of plan adaptations made for this user.
Use this to:
- Learn from past changes that worked or didn't work
- Avoid repeating unsuccessful adaptations
- Understand user's journey and challenges`,
  parameters: z.object({
    goalId: z.string().optional().describe('Specific goal, or leave empty for all goals'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();

      // Get weekly targets with notes (adaptations are stored in notes)
      let history;
      if (params.goalId) {
        history = await sql`
          SELECT wt.*, g.title as goal_title
          FROM weekly_targets wt
          JOIN goals g ON wt.goal_id = g.id
          WHERE g.user_id = ${user.id}::uuid 
            AND g.id = ${params.goalId}::uuid
            AND wt.notes IS NOT NULL
          ORDER BY wt.week_start DESC
          LIMIT 20
        `;
      } else {
        history = await sql`
          SELECT wt.*, g.title as goal_title
          FROM weekly_targets wt
          JOIN goals g ON wt.goal_id = g.id
          WHERE g.user_id = ${user.id}::uuid 
            AND wt.notes IS NOT NULL
          ORDER BY wt.week_start DESC
          LIMIT 20
        `;
      }

      // Parse adaptations from notes
      const adaptations = history
        .filter(h => h.notes?.includes('[Adapted:') || h.notes?.includes('[Note:'))
        .map(h => ({
          goalTitle: h.goal_title,
          weekStart: h.week_start,
          targetValue: h.target_value,
          actualValue: h.actual_value,
          notes: h.notes,
          wasSuccessful: h.actual_value && h.target_value 
            ? (h.actual_value / h.target_value) >= 0.8 
            : null
        }));

      return {
        success: true,
        adaptations,
        message: `Found ${adaptations.length} recorded adaptation(s) or note(s).`
      };
    } catch (error) {
      console.error('Error getting adaptation history:', error);
      return { success: false, message: 'Failed to get adaptation history.' };
    }
  },
});
