import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Check if we're in Next.js build phase
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

// Allow build to proceed without DATABASE_URL (it will be available at runtime)
const DATABASE_URL = process.env.DATABASE_URL || '';

// Create SQL client - throw at runtime if DATABASE_URL is missing (but not during build)
export const sql: NeonQueryFunction<false, false> = DATABASE_URL 
  ? neon(DATABASE_URL) 
  : ((() => { 
      if (!isBuildPhase) {
        throw new Error('DATABASE_URL is required at runtime');
      }
      // Return a dummy function during build that will never be called
      return (() => Promise.resolve([])) as unknown as NeonQueryFunction<false, false>;
    })());
