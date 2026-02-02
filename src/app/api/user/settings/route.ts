import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';

export async function GET() {
  try {
    const user = await getOrCreateUser();
    return NextResponse.json({
      settings: {
        tonePreference: user.tone_preference || 'balanced',
        name: user.name || '',
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    const { tonePreference, name } = body;

    await sql`
      UPDATE users
      SET
        name = COALESCE(${name || null}, name),
        tone_preference = COALESCE(${tonePreference || null}, tone_preference),
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getOrCreateUser();

    // Clear all conversation history
    await sql`
      DELETE FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE user_id = ${user.id}
      )
    `;
    await sql`
      DELETE FROM conversations WHERE user_id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing history:', error);
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 });
  }
}
