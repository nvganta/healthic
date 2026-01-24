import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('goalId');

    let targets;
    if (goalId) {
      targets = await sql`
        SELECT wt.*, g.title as goal_title
        FROM weekly_targets wt
        JOIN goals g ON wt.goal_id = g.id
        WHERE wt.goal_id = ${goalId}
        ORDER BY wt.week_start ASC
      `;
    } else {
      // Get all weekly targets for the default user
      targets = await sql`
        SELECT wt.*, g.title as goal_title
        FROM weekly_targets wt
        JOIN goals g ON wt.goal_id = g.id
        JOIN users u ON g.user_id = u.id
        WHERE u.email = 'default_user'
        ORDER BY wt.week_start ASC
      `;
    }

    return NextResponse.json({
      targets: targets.map((t) => ({
        id: t.id,
        goalId: t.goal_id,
        goalTitle: t.goal_title,
        weekStart: t.week_start,
        targetValue: t.target_value,
        actualValue: t.actual_value,
        notes: t.notes, // Contains weekNumber, description, dailyActions
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching weekly targets:', error);
    return NextResponse.json({ targets: [], error: 'Failed to fetch weekly targets' }, { status: 500 });
  }
}
