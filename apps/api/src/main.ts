import { serve } from '@hono/node-server';
import { env } from '@ime/env';
import { Logger } from '@ime/logger';
import { createApp } from './app';

const log = new Logger('api');

serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
  log.info(`listening on http://localhost:${info.port}`);
});
