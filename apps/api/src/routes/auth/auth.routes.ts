import { Hono } from 'hono';
import { AuthService } from '@ime/auth';
import {
  type AckResponse,
  ApiRoute,
  signInRequestSchema,
  signUpRequestSchema,
} from '@ime/models';
import { badRequest, fromAuthError } from '../responses';
import { type AuthEnv, getAuthToken } from './auth-context';
import { authMiddleware } from './auth.middleware';

/**
 * Successful acknowledgement body for actions with no data to return.
 */
const ACK: AckResponse = { success: true };

/**
 * Auth routes wrapping Supabase server-side: the API owns the wire contract
 * while clients adopt the returned tokens into supabase-js for persistence
 * and refresh.
 */
export const authRoutes = new Hono<AuthEnv>();

const authService = new AuthService();

authRoutes.post(ApiRoute.SignUp, async (c) => {
  const body = signUpRequestSchema.safeParse(
    await c.req.json().catch(() => undefined),
  );
  if (!body.success) {
    return badRequest(c, 'Invalid sign-up request');
  }

  try {
    return c.json(await authService.signUp(body.data.email, body.data.password));
  } catch (error) {
    return fromAuthError(c, error);
  }
});

authRoutes.post(ApiRoute.SignIn, async (c) => {
  const body = signInRequestSchema.safeParse(
    await c.req.json().catch(() => undefined),
  );
  if (!body.success) {
    return badRequest(c, 'Invalid sign-in request');
  }

  try {
    return c.json(await authService.signIn(body.data.email, body.data.password));
  } catch (error) {
    return fromAuthError(c, error);
  }
});

authRoutes.post(ApiRoute.SignOut, authMiddleware, async (c) => {
  try {
    await authService.signOut(getAuthToken(c));
    return c.json(ACK);
  } catch (error) {
    return fromAuthError(c, error);
  }
});
