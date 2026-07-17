import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Logger } from '@ime/logger';
import { authRoutes } from './routes/auth/auth.routes';
import { healthRoutes } from './routes/health/health.routes';
import { errorHandler } from './routes/utils/response.utils';
import { usersRoutes } from './routes/users/users.routes';

/**
 * Build the API application with all routes and middleware.
 */
export function createApp() {
  const app = new Hono();
  app.onError(errorHandler);

  const httpLog = new Logger('api').child('http');
  app.use(logger((line, ...rest) => httpLog.debug(line, ...rest)));

  app.route('/', authRoutes);
  app.route('/', healthRoutes);
  app.route('/', usersRoutes);

  return app;
}
