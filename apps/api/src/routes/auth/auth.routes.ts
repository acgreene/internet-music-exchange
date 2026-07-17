import { Hono } from 'hono';
import { AuthService } from '@ime/auth';
import { ApiRoute, signInRequestSchema, signUpRequestSchema } from '@ime/models';
import { errorHandler } from '../utils/response.utils';
import { validateJson } from '../utils/validate.utils';
import { type AuthEnv, getAuthToken } from './auth-context';
import { authMiddleware } from './auth.middleware';

/**
 * Auth routes wrapping Supabase server-side: the API owns the wire contract
 * while clients adopt the returned tokens into supabase-js for persistence
 * and refresh.
 */
export const authRoutes = new Hono<AuthEnv>();
authRoutes.onError(errorHandler);

const authService = new AuthService();

authRoutes.post(
  ApiRoute.SignUp,
  validateJson(signUpRequestSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');
    return c.json(await authService.signUp(email, password));
  },
);

authRoutes.post(
  ApiRoute.SignIn,
  validateJson(signInRequestSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');
    return c.json(await authService.signIn(email, password));
  },
);

authRoutes.post(ApiRoute.SignOut, authMiddleware, async (c) => {
  await authService.signOut(getAuthToken(c));
  return c.json({ success: true });
});
