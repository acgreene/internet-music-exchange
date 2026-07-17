import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AuthError } from '@ime/auth';

/**
 * Respond 400 with the contract error envelope.
 */
export function badRequest(c: Context, message: string): Response {
  return c.json({ error: message }, 400);
}

/**
 * Respond 401 with the contract error envelope.
 */
export function unauthorized(c: Context, message = 'Missing bearer token'): Response {
  return c.json({ error: message }, 401);
}

/**
 * Map an auth service failure to an HTTP error response with the contract
 * error envelope, rethrowing anything that is not an AuthError.
 */
export function fromAuthError(c: Context, error: unknown): Response {
  if (error instanceof AuthError) {
    return c.json(
      { error: error.message },
      error.status as ContentfulStatusCode,
    );
  }
  throw error;
}
