import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';
import { badRequest } from './response.utils';

/**
 * Validate the JSON request body against a contract schema. Handlers behind
 * this middleware read the typed body via c.req.valid('json'); mismatches
 * respond 400 with the contract error envelope before the handler runs.
 */
export function validateJson<T extends z.ZodType>(schema: T) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return badRequest(c, 'Invalid request body');
    }
    return undefined;
  });
}
