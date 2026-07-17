import type { Context } from 'hono';
import type { User } from '@ime/models';

/**
 * Context variables attached by authMiddleware.
 */
export interface AuthVariables {
  /**
   * Raw bearer token, for downstream calls to the auth service.
   */
  authToken: string;

  /**
   * The verified user behind the token.
   */
  authUser: User;
}

/**
 * Hono environment for routes mounted behind authMiddleware.
 */
export type AuthEnv = { Variables: AuthVariables };

/**
 * Extract the bearer token from the Authorization header, or null when absent.
 */
export function bearerToken(c: Context): string | null {
  const header = c.req.header('Authorization');
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

/**
 * The verified bearer token for the current request. A missing value is a
 * routing bug (authMiddleware did not run), not a user error.
 */
export function getAuthToken(c: Context<AuthEnv>): string {
  const token = c.get('authToken');
  if (!token) {
    throw new Error(
      'Auth context missing: authMiddleware did not run for this route.',
    );
  }
  return token;
}

/**
 * The verified user for the current request. A missing value is a routing bug
 * (authMiddleware did not run), not a user error.
 */
export function getAuthUser(c: Context<AuthEnv>): User {
  const user = c.get('authUser');
  if (!user) {
    throw new Error(
      'Auth context missing: authMiddleware did not run for this route.',
    );
  }
  return user;
}

/**
 * The verified user id for the current request.
 */
export function getAuthUserId(c: Context<AuthEnv>): string {
  return getAuthUser(c).id;
}
