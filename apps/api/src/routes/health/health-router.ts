import { ApiRoute, type HealthResponse, HealthStatus } from '@ime/models';
import type { HealthService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';

export class HealthRouter extends AbstractRouter {
  constructor(private readonly healthService: HealthService) {
    super();
    this.register();
  }

  protected register() {
    this.routes.get(ApiRoute.Health, async (c) => {
      const databaseOk = await this.healthService.isDatabaseReachable();
      const health: HealthResponse = {
        status: databaseOk ? HealthStatus.Ok : HealthStatus.Degraded,
        timestamp: new Date().toISOString(),
      };
      return c.json(health);
    });
  }
}
