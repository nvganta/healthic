import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';
import { awardPoints, awardBadge, POINTS } from '@/lib/gamification';

interface WeeklyTarget {
  weekNumber: number;
  weekStart: string;
  targetValue: number;
  targetDescription: string;
  dailyActions: string[];
}

interface ApprovedPlan {
  goal: {
    title: string;
    description: string;
    goalType: string;
    targetValue?: number | null;
    targetUnit?: string | null;
    targetDate?: string | null;
  };
  weeklyTargets: WeeklyTarget[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body: ApprovedPlan = await request.json();

    const { goal, weeklyTargets } = body;

    if (!goal || !weeklyTargets || !Array.isArray(weeklyTargets)) {
      return NextResponse.json(
        { error: 'Invalid plan data. Goal and weekly targets are required.' },
        { status: 400 }
      );
    }

    // Use transaction for atomicity
    let savedGoal;
    const savedTargets = [];
    let totalActionsCreated = 0;

    try {
      // Begin transaction
      await sql`BEGIN`;

      // Save the goal
      [savedGoal] = await sql`
        INSERT INTO goals (user_id, title, description, goal_type, target_value, target_unit, target_date)
        VALUES (
          ${user.id},
          ${goal.title},
          ${goal.description},
          ${goal.goalType},
          ${goal.targetValue ?? null},
          ${goal.targetUnit ?? null},
          ${goal.targetDate ?? null}
        )
        RETURNING *
      `;

      console.log('Goal saved:', savedGoal.id);

      // Save weekly targets and daily actions
      for (const target of weeklyTargets) {
        const [weeklyTarget] = await sql`
          INSERT INTO weekly_targets (goal_id, week_start, target_value, notes)
          VALUES (
            ${savedGoal.id},
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

        // Create daily_actions for each day of the week
        const weekStart = new Date(target.weekStart);
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const actionDate = new Date(weekStart);
          actionDate.setDate(actionDate.getDate() + dayOffset);
          const dateStr = actionDate.toISOString().split('T')[0];

          for (const actionText of target.dailyActions) {
            await sql`
              INSERT INTO daily_actions (
                weekly_target_id, user_id, goal_id, action_text, action_date
              ) VALUES (
                ${weeklyTarget.id},
                ${user.id},
                ${savedGoal.id},
                ${actionText},
                ${dateStr}
              )
            `;
            totalActionsCreated++;
          }
        }

        savedTargets.push({
          weekNumber: target.weekNumber,
          weekStart: target.weekStart,
          target: target.targetDescription,
          dailyActionsCount: target.dailyActions.length,
        });
      }

      // Commit transaction
      await sql`COMMIT`;
    } catch (txError) {
      // Rollback on any error
      await sql`ROLLBACK`;
      throw txError;
    }

    console.log('Plan approved and saved:', {
      goalId: savedGoal.id,
      weeksCreated: savedTargets.length,
      totalActionsCreated,
    });

    // Award points for creating a goal (always award base points)
    await awardPoints(user.id, POINTS.LOG_ACTIVITY, 'goal_created', savedGoal.id);
    let pointsAwarded = POINTS.LOG_ACTIVITY;
    let badgeEarned = null;

    // Check if this is the user's first goal
    const [goalCount] = await sql`
      SELECT COUNT(*) as count FROM goals WHERE user_id = ${user.id}
    `;

    if (parseInt(goalCount.count) === 1) {
      // This is their first goal! Award the first_goal badge
      const badge = await awardBadge(user.id, 'first_goal');
      if (badge.awarded) {
        badgeEarned = badge.badge;
      }
      // Award bonus points for first goal
      await awardPoints(user.id, POINTS.COMPLETE_ACTION, 'first_goal_bonus', savedGoal.id);
      pointsAwarded += POINTS.COMPLETE_ACTION;
    }

    return NextResponse.json({
      success: true,
      goalId: savedGoal.id,
      weeksCreated: savedTargets.length,
      totalActionsCreated,
      savedTargets,
      gamification: {
        pointsAwarded,
        badgeEarned,
      },
    });
  } catch (error) {
    console.error('Error approving plan:', error);
    return NextResponse.json(
      { error: 'Failed to save plan. Please try again.' },
      { status: 500 }
    );
  }
}
