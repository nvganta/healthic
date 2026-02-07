/**
 * Migration script for gamification tables:
 * - Add points columns to users table
 * - Create user_badges table
 * - Create points_history table
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log('🎮 Starting gamification migration...');

  // Step 1: Add gamification columns to users table
  console.log('📦 Adding gamification columns to users table...');

  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0`;
    console.log('✅ Users table updated');
  } catch (err) {
    console.log('ℹ️ Columns may already exist:', err);
  }

  // Step 2: Create user_badges table
  console.log('📦 Creating user_badges table...');
  await sql`
    CREATE TABLE IF NOT EXISTS user_badges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      badge_id VARCHAR(50) NOT NULL,
      earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, badge_id)
    )
  `;
  console.log('✅ user_badges table created');

  // Step 3: Create points_history table
  console.log('📦 Creating points_history table...');
  await sql`
    CREATE TABLE IF NOT EXISTS points_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      points INTEGER NOT NULL,
      reason VARCHAR(100) NOT NULL,
      reference_id UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Create index for faster queries
  await sql`
    CREATE INDEX IF NOT EXISTS points_history_user_idx
    ON points_history(user_id, created_at DESC)
  `;
  console.log('✅ points_history table created');

  console.log('🎉 Gamification migration complete!');
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
