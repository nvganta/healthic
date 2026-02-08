-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  phone VARCHAR(50),
  preferences JSONB DEFAULT '{}',
  tone_preference VARCHAR(50) DEFAULT 'balanced', -- 'tough_love', 'gentle', 'balanced'
  -- Gamification fields
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User badges for gamification
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_id VARCHAR(50) NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Points history for tracking point gains
CREATE TABLE IF NOT EXISTS points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS points_history_user_idx ON points_history(user_id, created_at DESC);

-- Resolutions/Goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  goal_type VARCHAR(50), -- 'weight_loss', 'exercise', 'sleep', 'nutrition', 'habit'
  target_value DECIMAL,
  target_unit VARCHAR(50),
  target_date DATE,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'abandoned', 'paused'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly targets derived from goals
CREATE TABLE IF NOT EXISTS weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  target_value DECIMAL,
  actual_value DECIMAL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily actions for tracking individual tasks (normalized from weekly_targets.notes)
CREATE TABLE IF NOT EXISTS daily_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_target_id UUID REFERENCES weekly_targets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  action_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT, -- User notes on completion
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying today's actions
CREATE INDEX IF NOT EXISTS daily_actions_user_date_idx ON daily_actions(user_id, action_date);
CREATE INDEX IF NOT EXISTS daily_actions_goal_idx ON daily_actions(goal_id, action_date);

-- Daily logs for tracking activities
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  log_type VARCHAR(50) NOT NULL, -- 'exercise', 'meal', 'sleep', 'mood', 'weight', 'stress'
  data JSONB NOT NULL, -- flexible storage for different log types
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations for chat history
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(50) DEFAULT 'web', -- 'web', 'sms', 'whatsapp', 'voice'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- for storing things like tone used, decision rationale
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check-ins initiated by the agent
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trigger_reason TEXT, -- why the check-in was triggered
  channel VARCHAR(50), -- how the check-in was delivered
  tone_used VARCHAR(50),
  user_responded BOOLEAN DEFAULT FALSE,
  outcome VARCHAR(50), -- 'positive', 'negative', 'neutral', 'no_response'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patterns detected by the agent
CREATE TABLE IF NOT EXISTS patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pattern_type VARCHAR(100), -- 'skips_morning_workouts', 'bad_sleep_affects_exercise', etc.
  description TEXT,
  confidence DECIMAL,
  evidence JSONB, -- data points that support this pattern
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Embeddings for semantic search (using pgvector)
-- MIGRATION: If upgrading from existing deployment, run the migration script below BEFORE applying this schema:
--
-- Step 1: Check for duplicates
-- SELECT content_id, COUNT(*) FROM embeddings GROUP BY content_id HAVING COUNT(*) > 1;
--
-- Step 2: If duplicates exist, deduplicate (keeps most recent):
-- DELETE FROM embeddings a USING embeddings b 
-- WHERE a.id < b.id AND a.content_id = b.content_id;
--
-- Step 3: Add UNIQUE constraint if not exists:
-- ALTER TABLE embeddings ADD CONSTRAINT embeddings_content_id_unique UNIQUE (content_id);
--
-- For fresh deployments, the UNIQUE constraint is included in CREATE TABLE below.
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(50), -- 'message', 'log', 'pattern', 'goal', 'insight'
  content_id UUID UNIQUE, -- Unique constraint for upsert support
  content_text TEXT,
  embedding vector(768), -- Google text-embedding-004 dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for common queries
CREATE INDEX IF NOT EXISTS daily_logs_user_date_idx ON daily_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS goals_user_status_idx ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS check_ins_user_idx ON check_ins(user_id, created_at);
CREATE INDEX IF NOT EXISTS patterns_user_idx ON patterns(user_id, pattern_type);
