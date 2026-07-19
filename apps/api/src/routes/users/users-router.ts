import type { AuthService } from '@ime/auth';
import { ApiRoute } from '@ime/models';
import { AuthMiddleware } from '../auth';
import { RouteUtils } from '../utils';
import { AbstractRouter } from '../abstract-router';
import { MiddlewareHandler } from 'hono';

export class UsersRouter extends AbstractRouter {
  private readonly authMiddleware: MiddlewareHandler;

  constructor(private readonly authService: AuthService) {
    super();
    this.register();
    this.authMiddleware = new AuthMiddleware(authService).middleware();
  }

  protected register(): void {
    this.routes.delete(ApiRoute.Users, this.authMiddleware, async (c) => {
      const routeUtils = new RouteUtils(c);
      const authUser = routeUtils.getAuthUser();
      await this.authService.deleteUser(authUser.id);
      return c.json({ success: true });
    });
  }
}
