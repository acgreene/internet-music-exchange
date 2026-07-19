import { z } from 'zod';

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
 * Wire schema for the session the auth routes return, which is the session
 * supabase-js hands back, verbatim. Loose, so supabase's remaining fields
 * survive parsing: this only pins the tokens the client has to adopt.
 */
export const sessionSchema = z.looseObject({
  access_token: z.string(),
  refresh_token: z.string(),
});

export type SessionResponse = z.infer<typeof sessionSchema>;
