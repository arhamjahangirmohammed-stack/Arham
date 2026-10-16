import { z } from 'zod';

/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at application start.
 * Provides clear error messages for missing or invalid configuration.
 */

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL. Check your .env.local file.',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(100, {
    message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY appears invalid. Copy it from your Supabase project settings.',
  }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_DB_URL: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
});

if (!parsed.success) {
  console.error('Invalid environment variables:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  - ${issue.message}`);
  });
  throw new Error('Invalid environment variables. See console for details.');
}

export const env = parsed.data;

/**
 * Check if running in production environment
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Check if running in development environment
 */
export const isDevelopment = process.env.NODE_ENV === 'development';
