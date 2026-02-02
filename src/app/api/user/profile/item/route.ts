import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';

export async function DELETE(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    const { type, preferenceKey, preferenceValue, clearKey, patternId } = body;

    if (type === 'preference' && preferenceKey && preferenceValue) {
      // Remove a specific value from a preference array
      const prefs = (user.preferences as Record<string, unknown>) || {};
      const arr = prefs[preferenceKey];
      if (Array.isArray(arr)) {
        prefs[preferenceKey] = arr.filter(
          (item: string) => item.toLowerCase() !== preferenceValue.toLowerCase()
        );
      }
      await sql`
        UPDATE users
        SET preferences = ${JSON.stringify(prefs)}::jsonb, updated_at = NOW()
        WHERE id = ${user.id}
      `;
      return NextResponse.json({ success: true });
    }

    if (type === 'preference' && clearKey) {
      // Remove a scalar preference
      const prefs = (user.preferences as Record<string, unknown>) || {};
      delete prefs[clearKey];
      await sql`
        UPDATE users
        SET preferences = ${JSON.stringify(prefs)}::jsonb, updated_at = NOW()
        WHERE id = ${user.id}
      `;
      return NextResponse.json({ success: true });
    }

    if (type === 'pattern' && patternId) {
      await sql`
        DELETE FROM patterns WHERE id = ${patternId} AND user_id = ${user.id}
      `;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting profile item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
