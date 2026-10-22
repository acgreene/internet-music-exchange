import { ApiRoute, HealthStatus, HttpMethod } from '@ime/models';
import type { HealthService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

export class HealthRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly health: HealthService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(HttpMethod.Get, ApiRoute.Health, 'public', async () => ({
      status: (await this.health.isDatabaseReachable())
        ? HealthStatus.Ok
        : HealthStatus.Degraded,
      timestamp: new Date().toISOString(),
    }));
  }
}
