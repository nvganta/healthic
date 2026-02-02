import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';

export async function GET() {
  try {
    const user = await getOrCreateUser();
    const userId = user.id;

    // Run all queries in parallel
    const [
      activeGoals,
      completedGoalsCount,
      activitiesThisWeek,
      activitiesLastWeek,
      weeklyTargets,
      patterns,
      portraitRows,
      conversationsCount,
      activityDates,
    ] = await Promise.all([
      // Active goals with details
      sql`
        SELECT id, title, goal_type, target_value, target_unit, target_date, status, created_at
        FROM goals
        WHERE user_id = ${userId} AND status = 'active'
        ORDER BY created_at DESC
      `,

      // Completed goals count
      sql`
        SELECT COUNT(*) as count FROM goals
        WHERE user_id = ${userId} AND status = 'completed'
      `,

      // Activities this week
      sql`
        SELECT log_type, COUNT(*) as count
        FROM daily_logs
        WHERE user_id = ${userId}
          AND log_date >= date_trunc('week', CURRENT_DATE)
        GROUP BY log_type
      `,

      // Activities last week (for comparison)
      sql`
        SELECT COUNT(*) as count
        FROM daily_logs
        WHERE user_id = ${userId}
          AND log_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
          AND log_date < date_trunc('week', CURRENT_DATE)
      `,

      // Weekly targets for active goals (current + recent weeks)
      sql`
        SELECT wt.id, wt.goal_id, wt.week_start, wt.target_value, wt.actual_value, wt.notes,
               g.title as goal_title, g.goal_type
        FROM weekly_targets wt
        JOIN goals g ON wt.goal_id = g.id
        WHERE g.user_id = ${userId} AND g.status = 'active'
        ORDER BY wt.week_start DESC
        LIMIT 50
      `,

      // Health patterns
      sql`
        SELECT id, pattern_type, description, confidence, created_at
        FROM patterns
        WHERE user_id = ${userId} AND pattern_type != 'portrait'
        ORDER BY updated_at DESC
        LIMIT 10
      `,

      // User portrait
      sql`
        SELECT description FROM patterns
        WHERE user_id = ${userId} AND pattern_type = 'portrait'
        ORDER BY updated_at DESC LIMIT 1
      `,

      // Conversations count
      sql`
        SELECT COUNT(*) as count FROM conversations
        WHERE user_id = ${userId}
      `,

      // Activity dates for streak calculation (last 60 days)
      sql`
        SELECT DISTINCT log_date
        FROM daily_logs
        WHERE user_id = ${userId}
          AND log_date >= CURRENT_DATE - 60
        ORDER BY log_date DESC
      `,
    ]);

    // Calculate activity streak
    let streak = 0;
    if (activityDates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dates = activityDates.map((d) => {
        const date = new Date(d.log_date);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      });

      const todayMs = today.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Check if today or yesterday has activity (to start the streak)
      const hasToday = dates.includes(todayMs);
      const hasYesterday = dates.includes(todayMs - oneDayMs);

      if (hasToday || hasYesterday) {
        const startDate = hasToday ? todayMs : todayMs - oneDayMs;
        streak = 1;
        let checkDate = startDate - oneDayMs;
        while (dates.includes(checkDate)) {
          streak++;
          checkDate -= oneDayMs;
        }
      }
    }

    // Build activity breakdown
    const activityBreakdown: Record<string, number> = {};
    let totalThisWeek = 0;
    for (const row of activitiesThisWeek) {
      activityBreakdown[row.log_type] = parseInt(row.count as string, 10);
      totalThisWeek += parseInt(row.count as string, 10);
    }
    const totalLastWeek = parseInt(activitiesLastWeek[0]?.count as string || '0', 10);

    // Build goals with progress
    const goalsWithProgress = activeGoals.map((goal) => {
      const goalTargets = weeklyTargets.filter((wt) => wt.goal_id === goal.id);
      const totalTargetValue = goalTargets.reduce(
        (sum, wt) => sum + (parseFloat(wt.target_value) || 0), 0
      );
      const totalActualValue = goalTargets.reduce(
        (sum, wt) => sum + (parseFloat(wt.actual_value) || 0), 0
      );
      const progressPercent = totalTargetValue > 0
        ? Math.min(100, Math.round((totalActualValue / totalTargetValue) * 100))
        : 0;

      // Current week target
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const currentWeekTarget = goalTargets.find((wt) => {
        const wtDate = new Date(wt.week_start);
        wtDate.setHours(0, 0, 0, 0);
        return wtDate.getTime() >= weekStart.getTime() &&
          wtDate.getTime() < weekStart.getTime() + 7 * 24 * 60 * 60 * 1000;
      });

      return {
        id: goal.id,
        title: goal.title,
        goalType: goal.goal_type,
        targetValue: goal.target_value,
        targetUnit: goal.target_unit,
        targetDate: goal.target_date,
        progressPercent,
        totalWeeks: goalTargets.length,
        currentWeek: currentWeekTarget
          ? {
              targetValue: currentWeekTarget.target_value,
              actualValue: currentWeekTarget.actual_value,
              notes: currentWeekTarget.notes,
            }
          : null,
      };
    });

    // Parse portrait
    let portrait = null;
    if (portraitRows.length > 0) {
      try {
        portrait = JSON.parse(portraitRows[0].description);
      } catch {
        portrait = { summary: portraitRows[0].description };
      }
    }

    return NextResponse.json({
      overview: {
        activeGoals: activeGoals.length,
        completedGoals: parseInt(completedGoalsCount[0]?.count as string || '0', 10),
        activitiesThisWeek: totalThisWeek,
        activitiesLastWeek: totalLastWeek,
        streak,
        conversations: parseInt(conversationsCount[0]?.count as string || '0', 10),
      },
      goals: goalsWithProgress,
      activityBreakdown,
      patterns: patterns.map((p) => ({
        id: p.id,
        patternType: p.pattern_type,
        description: p.description,
        confidence: p.confidence,
        createdAt: p.created_at,
      })),
      portrait,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
