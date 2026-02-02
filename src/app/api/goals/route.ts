import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';

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

export async function POST(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();

    const { title, description, goalType, targetValue, targetUnit, targetDate } = body;

    if (!title || !goalType) {
      return NextResponse.json({ error: 'Title and goal type are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO goals (user_id, title, description, goal_type, target_value, target_unit, target_date)
      VALUES (${user.id}, ${title}, ${description || null}, ${goalType}, ${targetValue || null}, ${targetUnit || null}, ${targetDate || null})
      RETURNING *
    `;

    const g = result[0];
    return NextResponse.json({
      goal: {
        id: g.id,
        title: g.title,
        description: g.description,
        goalType: g.goal_type,
        targetValue: g.target_value,
        targetUnit: g.target_unit,
        targetDate: g.target_date,
        createdAt: g.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();

    const { id, title, description, goalType, targetValue, targetUnit, targetDate } = body;

    if (!id) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 });
    }

    const result = await sql`
      UPDATE goals
      SET title = COALESCE(${title || null}, title),
          description = COALESCE(${description ?? null}, description),
          goal_type = COALESCE(${goalType || null}, goal_type),
          target_value = COALESCE(${targetValue ?? null}, target_value),
          target_unit = COALESCE(${targetUnit ?? null}, target_unit),
          target_date = COALESCE(${targetDate || null}, target_date),
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const g = result[0];
    return NextResponse.json({
      goal: {
        id: g.id,
        title: g.title,
        description: g.description,
        goalType: g.goal_type,
        targetValue: g.target_value,
        targetUnit: g.target_unit,
        targetDate: g.target_date,
        createdAt: g.created_at,
      },
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 });
    }

    const result = await sql`
      UPDATE goals
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
