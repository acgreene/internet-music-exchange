import { serve } from '@hono/node-server';
import { getDb } from '@ime/db';
import { Logger } from '@ime/logger';
import { createApp } from './app';

const log = new Logger('api');

try {
  process.loadEnvFile();
} catch {
  // no .env file; rely on the process environment
}

// Touch the database handle at startup so a misconfigured process fails
// immediately instead of on the first request.
getDb();

const port = Number(process.env['PORT'] ?? 3000);

serve({ fetch: createApp().fetch, port }, (info) => {
  log.info(`listening on http://localhost:${info.port}`);
});
