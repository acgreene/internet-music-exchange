import type { AuthService } from '@ime/auth';
import { ApiRoute } from '@ime/models';
import { createAuthMiddleware } from '../auth';
import { RouteUtils } from '../utils';
import { AbstractRouter } from '../abstract-router';

export class UsersRouter extends AbstractRouter {
  constructor(private readonly authService: AuthService) {
    super();
    this.register();
  }

  protected register(): void {
    const authMiddleware = createAuthMiddleware(this.authService);

    this.routes.delete(ApiRoute.Users, authMiddleware, async (c) => {
      const routeUtils = new RouteUtils(c);
      const authUser = routeUtils.getAuthUser();
      await this.authService.deleteUser(authUser.id);
      return c.json({ success: true });
    });
  }
}
