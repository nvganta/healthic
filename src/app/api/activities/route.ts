import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);

    const user = await getOrCreateUser();

    const activities = await sql`
      SELECT * FROM daily_logs
      WHERE user_id = ${user.id}
        AND log_date >= CURRENT_DATE - ${days}::integer
      ORDER BY log_date DESC, created_at DESC
      LIMIT 20
    `;

    return NextResponse.json({
      activities: activities.map((a) => ({
        id: a.id,
        date: a.log_date,
        type: a.log_type,
        data: a.data,
        notes: a.notes,
      })),
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ activities: [], error: 'Failed to fetch activities' }, { status: 500 });
  }
}
