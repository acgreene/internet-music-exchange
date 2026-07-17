/**
 * Provide safe local defaults for the API's required environment variables so
 * specs can import API modules without a .env file (for example in CI).
 * Existing values always win.
 */
export function stubApiTestEnv(): void {
  process.env['DATABASE_URL'] ??=
    'postgresql://postgres:postgres@127.0.0.1:54332/postgres';
  process.env['SUPABASE_URL'] ??= 'http://127.0.0.1:54331';
  process.env['SUPABASE_ANON_KEY'] ??= 'test-anon-key';
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ??= 'test-service-role-key';
}
