import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { ApiRoute, type HealthResponse, HealthStatus } from '@ime/models';

/**
 * Build the API application with all routes and middleware.
 */
export function createApp() {
  const app = new Hono();

  app.use(logger());

  app.get(ApiRoute.Health, (c) => {
    const health: HealthResponse = {
      status: HealthStatus.Ok,
      timestamp: new Date().toISOString(),
    };
    return c.json(health);
  });

  return app;
}
