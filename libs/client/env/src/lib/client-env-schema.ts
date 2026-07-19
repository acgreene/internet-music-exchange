import { z } from 'zod';

/**
 * A base URL the client prefixes onto API routes. Empty means same-origin,
 * which is how development works: the dev server proxies /api to the local API.
 * Anything else must carry a scheme, since it is used as an absolute URL.
 */
const apiBaseUrl = z.union([z.literal(''), z.url()]);

/**
 * Schema for all environment variables the client requires. This is the
 * spot that decides what the client gets: tools/generate-client-env.mjs
 * imports this module and bakes exactly these variables into generated-env.ts,
 * so adding a key here is all it takes to have it picked up.
 */
export const clientEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  DEVELOPMENT_API_BASE_URL: apiBaseUrl,
  PRODUCTION_API_BASE_URL: apiBaseUrl,
});

/**
 * The validated variables, keyed as they are named in .env.
 */
export type ClientEnvValues = z.infer<typeof clientEnvSchema>;
