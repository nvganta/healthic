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

export async function POST(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();

    const { type, value, notes } = body;

    if (!type || !value) {
      return NextResponse.json({ error: 'Type and value are required' }, { status: 400 });
    }

    const validTypes = ['exercise', 'meal', 'sleep', 'mood', 'weight', 'stress'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO daily_logs (user_id, log_date, log_type, data, notes)
      VALUES (${user.id}, CURRENT_DATE, ${type}, ${JSON.stringify({ value })}, ${notes || null})
      RETURNING *
    `;

    const a = result[0];
    return NextResponse.json({
      activity: {
        id: a.id,
        date: a.log_date,
        type: a.log_type,
        data: a.data,
        notes: a.notes,
      },
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM daily_logs
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}
