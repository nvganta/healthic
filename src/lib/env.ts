import { z } from 'zod';

const envSchema = z.object({
  // Required
  GOOGLE_GENAI_API_KEY: z.string().min(1, 'GOOGLE_GENAI_API_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Optional
  OPIK_API_KEY: z.string().optional(),
});

// Check if we're in Next.js build phase specifically
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

function validateEnv() {
  // Skip validation ONLY during Next.js build phase (not during production runtime)
  if (isBuildPhase) {
    console.warn('⚠️ Environment validation skipped during build phase. Ensure variables are set at runtime.');
    return {
      GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY || '',
      DATABASE_URL: process.env.DATABASE_URL || '',
      OPIK_API_KEY: process.env.OPIK_API_KEY,
    };
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    result.error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

export const env = validateEnv();
