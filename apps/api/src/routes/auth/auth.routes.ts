import { Hono } from 'hono';
import { AuthService } from '@ime/auth';
import { ApiRoute, signInRequestSchema, signUpRequestSchema } from '@ime/models';
import { errorHandler } from '../utils/response.utils';
import { validateJson } from '../utils/validate.utils';
import { type AuthEnv, getAuthToken } from './auth-context';
import { authMiddleware } from './auth.middleware';

export const authRoutes = new Hono<AuthEnv>();
authRoutes.onError(errorHandler);

const authService = new AuthService();

authRoutes.post(
  ApiRoute.SignUp,
  validateJson(signUpRequestSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');
    const session = await authService.signUp(email, password);
    return c.json(session);
  },
);

authRoutes.post(
  ApiRoute.SignIn,
  validateJson(signInRequestSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');
    const session = await authService.signIn(email, password);
    return c.json(session);
  },
);

authRoutes.post(ApiRoute.SignOut, authMiddleware, async (c) => {
  const authToken = getAuthToken(c);
  await authService.signOut(authToken);
  return c.json({ success: true });
});
