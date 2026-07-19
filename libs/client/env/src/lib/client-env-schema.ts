import { z } from 'zod';

/**
 * Schema for all environment variables the client requires. This is the
 * spot that decides what the client gets: tools/generate-client-env.mjs
 * imports this module and bakes exactly these variables into generated-env.ts,
 * so adding a key here is all it takes to have it picked up.
 */
export const clientEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  DEVELOPMENT_BASE_URL: z.url(),
  PRODUCTION_BASE_URL: z.url(),
});

/**
 * The validated variables, keyed as they are named in .env.
 */
export type ClientEnvValues = z.infer<typeof clientEnvSchema>;
