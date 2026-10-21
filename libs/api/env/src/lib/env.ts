import { z } from 'zod';

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
  SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_'),

  // Cloudflare R2 (S3-compatible object storage).
  R2_ENDPOINT: z.url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),

  // Stripe. The secret key is the platform's own; the Connect webhook secret
  // signs events from sellers' connected accounts.
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  // Where the web app lives, for links that send people back to it.
  WEB_APP_URL: z.url(),

  // Binaries the transcoding worker runs. Found on PATH unless set.
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  FFPROBE_PATH: z.string().min(1).default('ffprobe'),
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
