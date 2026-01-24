import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Helper to get or create user
async function getOrCreateUser(userId: string = 'default_user') {
  const existingUser = await sql`SELECT * FROM users WHERE email = ${userId}`;
  if (existingUser.length > 0) {
    return existingUser[0];
  }

  const newUser = await sql`
    INSERT INTO users (email, name)
    VALUES (${userId}, 'Health User')
    RETURNING *
  `;
  return newUser[0];
}

export async function GET() {
  try {
    const user = await getOrCreateUser();

    const goals = await sql`
      SELECT * FROM goals
      WHERE user_id = ${user.id} AND status = 'active'
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        goalType: g.goal_type,
        targetValue: g.target_value,
        targetUnit: g.target_unit,
        targetDate: g.target_date,
        createdAt: g.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ goals: [], error: 'Failed to fetch goals' }, { status: 500 });
  }
}
