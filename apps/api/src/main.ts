import { serve } from '@hono/node-server';
import { env } from '@ime/env';
import { Logger } from '@ime/utils';
import { RootRouter } from './routes/root-router';

const log = new Logger('api');

serve(
  {
    fetch: new RootRouter().router.fetch,
    port: env.PORT,
  },
  (info) => {
    log.info(`listening on http://localhost:${info.port}`);
  },
);
