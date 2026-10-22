import { ApiRoute, HttpMethod } from '@ime/models';
import type { AuthService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

export class UsersRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly auth: AuthService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(HttpMethod.Delete, ApiRoute.Users, 'user', ({ userId }) =>
      this.auth.deleteUser(userId),
    );
  }
}
