import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/agent/tools/user-helper';
import { getGamificationStats } from '@/lib/gamification';

export async function GET() {
  try {
    const user = await getOrCreateUser();
    const stats = await getGamificationStats(user.id);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching gamification stats:', error);
    return NextResponse.json(
      {
        points: 0,
        level: { level: 1, name: 'Beginner', progressToNext: 0, pointsToNext: 100 },
        streak: { current: 0, longest: 0 },
        badges: { earned: [], unearned: [] },
        recentPoints: [],
        error: 'Failed to fetch gamification stats',
      },
      { status: 500 }
    );
  }
}
