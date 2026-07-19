import { clientEnvSchema } from './client-env-schema';
import { generatedEnv } from './generated-env';

export { clientEnvSchema } from './client-env-schema';
export type { ClientEnvValues } from './client-env-schema';

/**
 * Browsers can't read .env, so the values are baked in at build time by
 * tools/generate-client-env.mjs and validated here.
 */
const parsed = clientEnvSchema.safeParse(generatedEnv);
if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => issue.path.join('.'))
    .join(', ');
  throw new Error(
    `Invalid or missing client environment variables: ${problems}. Copy .env.example to .env and fill them from \`supabase status\`, then rebuild.`,
  );
}

/**
 * Validated environment variables for the client, shared by every client lib
 * and app.
 */
export const clientEnv = parsed.data;
