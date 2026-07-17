import { z } from 'zod';

// Load .env into process.env before validating. This module initializes on
// the first import, before any consumer code runs, so every module in the API can
// count on validated environment variables at construction time.
try {
  process.loadEnvFile();
} catch {
  // no .env file; rely on the process environment
}

/**
 * Schema for every environment variable the API requires. The process refuses
 * to launch when any of them are missing or malformed.
 */
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => issue.path.join('.'))
    .join(', ');
  throw new Error(
    `Invalid or missing environment variables: ${problems}. Copy .env.example to .env and fill them from \`supabase status\`.`,
  );
}

/**
 * Validated environment variables for the API.
 */
export const env = parsed.data;
