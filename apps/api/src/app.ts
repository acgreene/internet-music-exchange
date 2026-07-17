import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { getDb, pingDb } from '@ime/db';
import { Logger } from '@ime/logger';
import { ApiRoute, type HealthResponse, HealthStatus } from '@ime/models';

/**
 * Build the API application with all routes and middleware.
 */
export function createApp() {
  const app = new Hono();

  const httpLog = new Logger('api').child('http');
  app.use(logger((line, ...rest) => httpLog.debug(line, ...rest)));

  app.get(ApiRoute.Health, async (c) => {
    const databaseOk = await pingDb(getDb());
    const health: HealthResponse = {
      status: databaseOk ? HealthStatus.Ok : HealthStatus.Degraded,
      timestamp: new Date().toISOString(),
    };
    return c.json(health);
  });

  return app;
}
