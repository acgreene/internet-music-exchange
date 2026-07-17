import { createMiddleware } from 'hono/factory';
import { AuthService } from '@ime/auth';
import { fromAuthError, unauthorized } from '../responses';
import { type AuthEnv, bearerToken } from './auth-context';

const authService = new AuthService();

/**
 * Authenticate requests via Bearer token: validates the token against the
 * auth service and attaches authToken and authUser to the context for
 * downstream handlers. Responds 401 with the contract error envelope when the
 * token is missing or invalid. A suspension gate slots in here once account
 * suspension exists.
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const token = bearerToken(c);
  if (!token) {
    return unauthorized(c);
  }
  c.set('authToken', token);

  try {
    c.set('authUser', await authService.getUser(token));
  } catch (error) {
    return fromAuthError(c, error);
  }

  await next();
});
