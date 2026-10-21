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
  process.env['R2_ENDPOINT'] ??= 'https://test-account.r2.cloudflarestorage.com';
  process.env['R2_ACCESS_KEY_ID'] ??= 'test-access-key-id';
  process.env['R2_SECRET_ACCESS_KEY'] ??= 'test-secret-access-key';
  process.env['R2_BUCKET'] ??= 'test-bucket';
  process.env['STRIPE_SECRET_KEY'] ??= 'sk_test_stub';
  process.env['STRIPE_CONNECT_WEBHOOK_SECRET'] ??= 'whsec_test_stub';
  process.env['WEB_APP_URL'] ??= 'http://localhost:4200';
}
