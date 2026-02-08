/**
 * Migration script to:
 * 1. Create daily_actions table if not exists
 * 2. Populate daily_actions from existing weekly_targets.notes
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log('🚀 Starting daily_actions migration...');

  // Step 1: Create the daily_actions table
  console.log('📦 Creating daily_actions table...');
  await sql`
    CREATE TABLE IF NOT EXISTS daily_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      weekly_target_id UUID REFERENCES weekly_targets(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
      action_text TEXT NOT NULL,
      action_date DATE NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Create indexes
  await sql`
    CREATE INDEX IF NOT EXISTS daily_actions_user_date_idx
    ON daily_actions(user_id, action_date)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS daily_actions_goal_idx
    ON daily_actions(goal_id, action_date)
  `;

  console.log('✅ Table and indexes created');

  // Step 2: Migrate existing weekly_targets.notes to daily_actions
  console.log('📊 Migrating existing weekly targets...');

  const weeklyTargets = await sql`
    SELECT wt.id as weekly_target_id, wt.goal_id, wt.week_start, wt.notes, g.user_id
    FROM weekly_targets wt
    JOIN goals g ON wt.goal_id = g.id
    WHERE wt.notes IS NOT NULL
  `;

  let migratedCount = 0;
  for (const target of weeklyTargets) {
    try {
      const notes = typeof target.notes === 'string'
        ? JSON.parse(target.notes)
        : target.notes;

      if (notes.dailyActions && Array.isArray(notes.dailyActions)) {
        const weekStart = new Date(target.week_start);

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const actionDate = new Date(weekStart);
          actionDate.setDate(actionDate.getDate() + dayOffset);
          const dateStr = actionDate.toISOString().split('T')[0];

          for (const actionText of notes.dailyActions) {
            // Check if already exists to avoid duplicates
            const existing = await sql`
              SELECT id FROM daily_actions
              WHERE weekly_target_id = ${target.weekly_target_id}
                AND action_text = ${actionText}
                AND action_date = ${dateStr}
            `;

            if (existing.length === 0) {
              await sql`
                INSERT INTO daily_actions (
                  weekly_target_id, user_id, goal_id, action_text, action_date
                ) VALUES (
                  ${target.weekly_target_id},
                  ${target.user_id},
                  ${target.goal_id},
                  ${actionText},
                  ${dateStr}
                )
              `;
              migratedCount++;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ Could not parse notes for target ${target.weekly_target_id}:`, err);
    }
  }

  console.log(`✅ Migrated ${migratedCount} daily actions from existing weekly targets`);
  console.log('🎉 Migration complete!');
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
