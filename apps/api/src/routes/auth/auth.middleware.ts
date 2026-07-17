import { createMiddleware } from 'hono/factory';
import { AuthService } from '@ime/auth';
import { unauthorized } from '../utils/response.utils';
import { type AuthEnv, bearerToken } from './auth-context';

const authService = new AuthService();

/**
 * Authenticate requests via Bearer token: validates the token against the
 * auth service and attaches authToken and authUser to the context for
 * downstream handlers. Missing tokens respond 401; invalid tokens throw
 * AuthError, which the router's errorHandler maps to a response. A suspension
 * gate slots in here once account suspension exists.
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const token = bearerToken(c);
  if (!token) {
    return unauthorized(c);
  }

  c.set('authToken', token);
  c.set('authUser', await authService.getUser(token));

  await next();
});
