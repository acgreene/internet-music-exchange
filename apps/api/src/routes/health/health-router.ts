import { databaseService } from '@ime/db';
import { ApiRoute, type HealthResponse, HealthStatus } from '@ime/models';
import { AbstractRouter } from '../abstract-router';

export class HealthRouter extends AbstractRouter {
  constructor() {
    super();
    this.register();
  }

  protected register() {
    this.routes.get(ApiRoute.Health, async (c) => {
      const databaseOk = await databaseService.ping();
      const health: HealthResponse = {
        status: databaseOk ? HealthStatus.Ok : HealthStatus.Degraded,
        timestamp: new Date().toISOString(),
      };
      return c.json(health);
    });
  }
}
