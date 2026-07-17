import { z } from 'zod';
import type { Session, User } from '../../models';

/**
 * Request body for creating an account.
 */
export const signUpRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

/**
 * A validated sign-up request.
 */
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

/**
 * Request body for signing in with email and password.
 */
export const signInRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * A validated sign-in request.
 */
export type SignInRequest = z.infer<typeof signInRequestSchema>;

/**
 * Wire schema for a user, checked against the domain User type.
 */
export const userSchema: z.ZodType<User> = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime({ offset: true }),
});

/**
 * Wire schema for a session, checked against the domain Session type.
 */
export const sessionSchema: z.ZodType<Session> = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  user: userSchema,
});
