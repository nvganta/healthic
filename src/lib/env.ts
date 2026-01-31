import { z } from 'zod';

const envSchema = z.object({
  // Required
  GOOGLE_GENAI_API_KEY: z.string().min(1, 'GOOGLE_GENAI_API_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Optional
  OPIK_API_KEY: z.string().optional(),
});

function validateEnv() {
  // Skip validation during build time (Next.js build process)
  if (process.env.NODE_ENV === 'production' && !process.env.GOOGLE_GENAI_API_KEY) {
    console.warn('⚠️ Environment validation skipped during build. Ensure variables are set at runtime.');
    return {
      GOOGLE_GENAI_API_KEY: '',
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
