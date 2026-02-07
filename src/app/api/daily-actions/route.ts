import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';
import { awardPoints, awardBadge, checkDailyCompletionBadge, POINTS } from '@/lib/gamification';

export async function GET(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const { searchParams } = new URL(request.url);

    // Default to today if no date specified
    const dateParam = searchParams.get('date');
    const today = new Date().toISOString().split('T')[0];
    const targetDate = dateParam || today;

    const actions = await sql`
      SELECT
        da.id,
        da.action_text,
        da.action_date,
        da.is_completed,
        da.completed_at,
        da.notes,
        da.goal_id,
        g.title as goal_title,
        g.goal_type
      FROM daily_actions da
      JOIN goals g ON da.goal_id = g.id
      WHERE da.user_id = ${user.id}
        AND da.action_date = ${targetDate}
        AND g.status = 'active'
      ORDER BY da.is_completed ASC, g.title ASC, da.created_at ASC
    `;

    // Calculate completion stats
    const completedCount = actions.filter((a) => a.is_completed).length;
    const totalCount = actions.length;

    return NextResponse.json({
      date: targetDate,
      actions: actions.map((a) => ({
        id: a.id,
        actionText: a.action_text,
        actionDate: a.action_date,
        isCompleted: a.is_completed,
        completedAt: a.completed_at,
        notes: a.notes,
        goalId: a.goal_id,
        goalTitle: a.goal_title,
        goalType: a.goal_type,
      })),
      stats: {
        completed: completedCount,
        total: totalCount,
        percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching daily actions:', error);
    return NextResponse.json(
      { actions: [], stats: { completed: 0, total: 0, percentage: 0 }, error: 'Failed to fetch actions' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    const { actionId, isCompleted, notes } = body;

    if (!actionId) {
      return NextResponse.json({ error: 'Action ID is required' }, { status: 400 });
    }

    // Verify ownership first before any operation
    const [existing] = await sql`
      SELECT is_completed FROM daily_actions
      WHERE id = ${actionId} AND user_id = ${user.id}
    `;

    // Return 404 early if action doesn't belong to user (prevents information leakage)
    if (!existing) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    const wasCompleted = existing.is_completed || false;
    const isNewCompletion = isCompleted && !wasCompleted;

    const [a] = await sql`
      UPDATE daily_actions
      SET
        is_completed = ${isCompleted},
        completed_at = ${isCompleted ? new Date().toISOString() : null},
        notes = COALESCE(${notes || null}, notes)
      WHERE id = ${actionId} AND user_id = ${user.id}
      RETURNING *
    `;

    // Award points and check for badges if newly completed
    let pointsAwarded = 0;
    let badgeEarned = null;

    if (isNewCompletion) {
      // Award points for completing an action
      const pointResult = await awardPoints(
        user.id,
        POINTS.COMPLETE_ACTION,
        'complete_action',
        actionId
      );
      pointsAwarded = POINTS.COMPLETE_ACTION;

      // Check if this is the user's first action ever
      const [actionCount] = await sql`
        SELECT COUNT(*) as count FROM daily_actions
        WHERE user_id = ${user.id} AND is_completed = true
      `;
      if (parseInt(actionCount.count) === 1) {
        const badge = await awardBadge(user.id, 'first_action');
        if (badge.awarded) {
          badgeEarned = badge.badge;
        }
      }

      // Check if all daily actions are now complete
      const allComplete = await checkDailyCompletionBadge(user.id, a.action_date);
      if (allComplete) {
        pointsAwarded += POINTS.COMPLETE_ALL_DAILY;
      }
    }

    return NextResponse.json({
      action: {
        id: a.id,
        actionText: a.action_text,
        actionDate: a.action_date,
        isCompleted: a.is_completed,
        completedAt: a.completed_at,
        notes: a.notes,
      },
      gamification: isNewCompletion ? {
        pointsAwarded,
        badgeEarned,
      } : undefined,
    });
  } catch (error) {
    console.error('Error updating action:', error);
    return NextResponse.json({ error: 'Failed to update action' }, { status: 500 });
  }
}
