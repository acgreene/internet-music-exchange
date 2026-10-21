/**
 * Provide safe local defaults for the API's required environment variables so
 * specs can import API modules without a .env file (for example in CI).
 * Existing values always win.
 */
export function stubApiTestEnv(): void {
  process.env['DATABASE_URL'] ??=
    'postgresql://postgres:postgres@127.0.0.1:54332/postgres';
  process.env['SUPABASE_URL'] ??= 'http://127.0.0.1:54331';
  process.env['SUPABASE_PUBLISHABLE_KEY'] ??= 'sb_publishable_test';
  process.env['SUPABASE_SECRET_KEY'] ??= 'sb_secret_test';
}
