import { createMiddleware } from 'hono/factory';
import type { AuthService } from '@ime/services';
import { RouteResponse, RouteUtils } from '../utils';

export class AuthMiddleware {
  constructor(private readonly authService: AuthService) {}

  public middleware() {
    return createMiddleware(async (c, next) => {
      const routeUtils = new RouteUtils(c);
      const token = routeUtils.getBearerToken();
      if (!token) {
        return routeUtils.respond(
          RouteResponse.Unauthorized,
          'Authentication token missing.',
        );
      }

      c.set('authToken', token);
      c.set('authUser', await this.authService.getUser(token));

      await next();
    });
  }
}
