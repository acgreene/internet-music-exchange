/// <reference types="node" />
import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch {
  // no .env file; rely on the process environment
}

export default defineConfig({
  schema: './libs/api/db/src/lib/schema.ts',
  out: './libs/api/db/migrations',
  dialect: 'postgresql',
  entities: {
    roles: { provider: 'supabase' },
  },
  dbCredentials: {
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:postgres@127.0.0.1:54332/postgres',
  },
});
