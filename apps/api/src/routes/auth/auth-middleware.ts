import { createMiddleware } from 'hono/factory';
import type { AuthService } from '@ime/auth';
import { RouteResponse, RouteUtils } from '../utils';

/**
 * Builds the bearer-token authentication middleware.
 *
 * Validates the token and attaches authToken and authUser to the context
 * for downstream routes.
 */
export function createAuthMiddleware(authService: AuthService) {
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
    c.set('authUser', await authService.getUser(token));

    await next();
  });
}
