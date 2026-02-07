import { sql } from './db';

// Points awarded for different actions
export const POINTS = {
  COMPLETE_ACTION: 10,
  LOG_ACTIVITY: 5,
  COMPLETE_ALL_DAILY: 25, // Bonus for completing all actions in a day
  STREAK_DAY: 5, // Per day of streak
  COMPLETE_WEEKLY_TARGET: 50,
  COMPLETE_GOAL: 200,
} as const;

// Level definitions
export const LEVELS = [
  { level: 1, name: 'Beginner', pointsRequired: 0, color: 'slate' },
  { level: 2, name: 'Getting Started', pointsRequired: 100, color: 'emerald' },
  { level: 3, name: 'Building Habits', pointsRequired: 300, color: 'teal' },
  { level: 4, name: 'Consistent', pointsRequired: 600, color: 'cyan' },
  { level: 5, name: 'Committed', pointsRequired: 1000, color: 'blue' },
  { level: 6, name: 'Health Champion', pointsRequired: 2000, color: 'violet' },
  { level: 7, name: 'Wellness Master', pointsRequired: 5000, color: 'amber' },
] as const;

// Badge definitions
export const BADGES = {
  first_goal: {
    id: 'first_goal',
    name: 'First Steps',
    description: 'Complete your first goal',
    icon: '🏆',
  },
  streak_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    description: '7-day activity streak',
    icon: '🔥',
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Master',
    description: '30-day activity streak',
    icon: '🌟',
  },
  perfect_week: {
    id: 'perfect_week',
    name: 'Perfect Week',
    description: 'Complete all actions for a full week',
    icon: '⭐',
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Log activity before 8am',
    icon: '🌅',
  },
  level_5: {
    id: 'level_5',
    name: 'Committed',
    description: 'Reach level 5',
    icon: '🎖️',
  },
  first_action: {
    id: 'first_action',
    name: 'Getting Started',
    description: 'Complete your first action',
    icon: '✅',
  },
} as const;

export type BadgeId = keyof typeof BADGES;

/**
 * Get the user's current level based on total points
 */
export function getLevelFromPoints(points: number) {
  let currentLevel: (typeof LEVELS)[number] = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.pointsRequired) {
      currentLevel = level;
    } else {
      break;
    }
  }

  // Calculate progress to next level
  const currentLevelIndex = LEVELS.findIndex((l) => l.level === currentLevel.level);
  const nextLevel = LEVELS[currentLevelIndex + 1];

  let progressToNext = 100;
  let pointsToNext = 0;
  if (nextLevel) {
    const pointsInLevel = points - currentLevel.pointsRequired;
    const pointsNeeded = nextLevel.pointsRequired - currentLevel.pointsRequired;
    progressToNext = Math.round((pointsInLevel / pointsNeeded) * 100);
    pointsToNext = nextLevel.pointsRequired - points;
  }

  return {
    ...currentLevel,
    progressToNext,
    pointsToNext,
    nextLevel: nextLevel || null,
  };
}

/**
 * Award points to a user (atomic operation to prevent race conditions)
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  referenceId?: string
): Promise<{ newTotal: number; levelUp: boolean; newLevel?: typeof LEVELS[number] }> {
  // Atomically update points and return new total (prevents race conditions)
  const [user] = await sql`
    UPDATE users
    SET total_points = COALESCE(total_points, 0) + ${points}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING total_points as new_total
  `;

  const newTotal = user?.new_total || points;
  const currentPoints = newTotal - points;

  // Record points history
  await sql`
    INSERT INTO points_history (user_id, points, reason, reference_id)
    VALUES (${userId}, ${points}, ${reason}, ${referenceId || null})
  `;

  // Check for level up
  const oldLevel = getLevelFromPoints(currentPoints);
  const newLevel = getLevelFromPoints(newTotal);
  const levelUp = newLevel.level > oldLevel.level;

  // Award level badges
  if (newLevel.level >= 5) {
    await awardBadge(userId, 'level_5');
  }

  return {
    newTotal,
    levelUp,
    newLevel: levelUp ? newLevel : undefined,
  };
}

/**
 * Award a badge to a user (if not already earned)
 */
export async function awardBadge(
  userId: string,
  badgeId: BadgeId
): Promise<{ awarded: boolean; badge: typeof BADGES[BadgeId] }> {
  const badge = BADGES[badgeId];

  // Check if already has badge
  const [existing] = await sql`
    SELECT id FROM user_badges
    WHERE user_id = ${userId} AND badge_id = ${badgeId}
  `;

  if (existing) {
    return { awarded: false, badge };
  }

  // Award badge
  await sql`
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (${userId}, ${badgeId})
  `;

  return { awarded: true, badge };
}

/**
 * Get all badges for a user
 */
export async function getUserBadges(userId: string) {
  const earned = await sql`
    SELECT badge_id, earned_at FROM user_badges
    WHERE user_id = ${userId}
    ORDER BY earned_at DESC
  `;

  const earnedBadges = earned.map((b) => ({
    ...BADGES[b.badge_id as BadgeId],
    earnedAt: b.earned_at,
  }));

  // Get unearned badges
  const earnedIds = new Set(earned.map((b) => b.badge_id));
  const unearnedBadges = Object.values(BADGES).filter((b) => !earnedIds.has(b.id));

  return { earned: earnedBadges, unearned: unearnedBadges };
}

/**
 * Get gamification stats for a user
 */
export async function getGamificationStats(userId: string) {
  const [user] = await sql`
    SELECT total_points, current_streak, longest_streak
    FROM users WHERE id = ${userId}
  `;

  const points = user?.total_points || 0;
  const level = getLevelFromPoints(points);

  const badges = await getUserBadges(userId);

  // Get recent points history
  const recentPoints = await sql`
    SELECT points, reason, created_at FROM points_history
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 10
  `;

  return {
    points,
    level,
    streak: {
      current: user?.current_streak || 0,
      longest: user?.longest_streak || 0,
    },
    badges,
    recentPoints: recentPoints.map((p) => ({
      points: p.points,
      reason: p.reason,
      createdAt: p.created_at,
    })),
  };
}

/**
 * Update user streak (atomic operation to prevent race conditions)
 */
export async function updateStreak(userId: string, hasActivityToday: boolean) {
  let result;

  if (hasActivityToday) {
    // Atomically increment streak and update longest if needed
    [result] = await sql`
      UPDATE users SET
        current_streak = COALESCE(current_streak, 0) + 1,
        longest_streak = GREATEST(COALESCE(longest_streak, 0), COALESCE(current_streak, 0) + 1),
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING current_streak, longest_streak
    `;

    const currentStreak = result?.current_streak || 1;

    // Check for streak badges
    if (currentStreak >= 7) {
      await awardBadge(userId, 'streak_7');
    }
    if (currentStreak >= 30) {
      await awardBadge(userId, 'streak_30');
    }
  } else {
    // Reset streak to 0
    [result] = await sql`
      UPDATE users SET
        current_streak = 0,
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING current_streak, longest_streak
    `;
  }

  return {
    currentStreak: result?.current_streak || 0,
    longestStreak: result?.longest_streak || 0,
  };
}

/**
 * Check and award badge for completing all daily actions
 */
export async function checkDailyCompletionBadge(userId: string, date: string) {
  // Check if all actions for the day are complete
  const [result] = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN is_completed THEN 1 END) as completed
    FROM daily_actions
    WHERE user_id = ${userId} AND action_date = ${date}
  `;

  if (result.total > 0 && result.total === result.completed) {
    // Award bonus points
    await awardPoints(userId, POINTS.COMPLETE_ALL_DAILY, 'all_daily_complete', undefined);
    return true;
  }
  return false;
}
