import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';

// Keys that come from auto-extraction (extract-preferences.ts)
const EXTRACTED_KEYS = ['dietary', 'health_conditions', 'exercise_preferences', 'schedule_constraints', 'dislikes'];

// Keys that come from profile intake (update_user_profile tool)
const INTAKE_KEYS = [
  'currentWeight', 'targetWeight', 'height', 'activityLevel',
  'dietaryPreferences', 'workSchedule', 'exercisePreferences',
  'challenges', 'motivation',
];

export async function GET() {
  try {
    const user = await getOrCreateUser();
    const prefs = (user.preferences as Record<string, unknown>) || {};

    // Split preferences into intake vs extracted
    const intake: Record<string, unknown> = {};
    const extracted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(prefs)) {
      if (EXTRACTED_KEYS.includes(key)) {
        extracted[key] = value;
      } else if (INTAKE_KEYS.includes(key)) {
        intake[key] = value;
      } else {
        intake[key] = value; // default to intake
      }
    }

    // Fetch patterns (excluding portrait)
    const patterns = await sql`
      SELECT id, pattern_type, description, confidence, created_at, updated_at
      FROM patterns
      WHERE user_id = ${user.id} AND pattern_type != 'portrait'
      ORDER BY updated_at DESC
      LIMIT 50
    `;

    // Fetch portrait
    let portrait = null;
    const portraitRows = await sql`
      SELECT description FROM patterns
      WHERE user_id = ${user.id} AND pattern_type = 'portrait'
      ORDER BY updated_at DESC LIMIT 1
    `;
    if (portraitRows.length > 0) {
      try {
        portrait = JSON.parse(portraitRows[0].description);
      } catch {
        portrait = { summary: portraitRows[0].description };
      }
    }

    return NextResponse.json({
      profile: {
        name: user.name,
        email: user.email,
        tonePreference: user.tone_preference || 'balanced',
        createdAt: user.created_at,
        intake,
        extracted,
      },
      patterns: patterns.map((p: Record<string, unknown>) => ({
        id: p.id,
        patternType: p.pattern_type,
        description: p.description,
        confidence: p.confidence,
        createdAt: p.created_at,
      })),
      portrait,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    const { name, tonePreference, preferences } = body;

    // Merge preferences if provided
    let updatedPrefs = (user.preferences as Record<string, unknown>) || {};
    if (preferences) {
      updatedPrefs = { ...updatedPrefs, ...preferences };
    }

    await sql`
      UPDATE users
      SET
        name = COALESCE(${name || null}, name),
        tone_preference = COALESCE(${tonePreference || null}, tone_preference),
        preferences = ${JSON.stringify(updatedPrefs)}::jsonb,
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
