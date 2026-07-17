import { Hono } from 'hono';
import { AuthService } from '@ime/auth';
import { type AckResponse, ApiRoute } from '@ime/models';
import { type AuthEnv, getAuthUser } from '../auth/auth-context';
import { authMiddleware } from '../auth/auth.middleware';
import { fromAuthError } from '../responses';

/**
 * Successful acknowledgement body for actions with no data to return.
 */
const ACK: AckResponse = { success: true };

/**
 * User account routes; only operations needing the service role live here.
 */
export const usersRoutes = new Hono<AuthEnv>();

const authService = new AuthService();

usersRoutes.delete(ApiRoute.Users, authMiddleware, async (c) => {
  try {
    await authService.deleteUser(getAuthUser(c).id);
    return c.json(ACK);
  } catch (error) {
    return fromAuthError(c, error);
  }
});
