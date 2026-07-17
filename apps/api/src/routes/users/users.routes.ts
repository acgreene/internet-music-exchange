import { Hono } from 'hono';
import { AuthService } from '@ime/auth';
import { ApiRoute } from '@ime/models';
import { type AuthEnv, getAuthUser } from '../auth/auth-context';
import { authMiddleware } from '../auth/auth.middleware';
import { errorHandler } from '../utils/response.utils';

export const usersRoutes = new Hono<AuthEnv>();
usersRoutes.onError(errorHandler);

const authService = new AuthService();

usersRoutes.delete(ApiRoute.Users, authMiddleware, async (c) => {
  await authService.deleteUser(getAuthUser(c).id);
  return c.json({ success: true });
});
