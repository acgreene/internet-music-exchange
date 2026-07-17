import { serve } from '@hono/node-server';
import { createApp } from './app';

try {
  process.loadEnvFile();
} catch {
  // no .env file; rely on the process environment
}

const port = Number(process.env['PORT'] ?? 3000);

serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});
