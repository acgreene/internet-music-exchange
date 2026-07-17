import { z } from 'zod';

/**
 * Standard envelope the API returns for non-2xx responses, so clients can
 * surface a server-provided message instead of a generic one.
 */
export const apiErrorBodySchema = z.object({
  error: z.string(),
});

/**
 * A validated API error body.
 */
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
