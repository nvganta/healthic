import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Allow build to proceed without DATABASE_URL (it will be available at runtime)
const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️ DATABASE_URL environment variable is not set');
}

export const sql: NeonQueryFunction<false, false> = neon(DATABASE_URL);
