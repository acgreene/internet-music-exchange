import { Hono } from 'hono';
import { db, pingDb } from '@ime/db';
import { ApiRoute, type HealthResponse, HealthStatus } from '@ime/models';

/**
 * Service health routes.
 */
export const healthRoutes = new Hono();

healthRoutes.get(ApiRoute.Health, async (c) => {
  const databaseOk = await pingDb(db);
  const health: HealthResponse = {
    status: databaseOk ? HealthStatus.Ok : HealthStatus.Degraded,
    timestamp: new Date().toISOString(),
  };
  return c.json(health);
});
