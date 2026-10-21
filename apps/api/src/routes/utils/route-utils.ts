import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';
import type { Context } from 'hono';
import { Logger } from '@ime/utils';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { HTTPException } from 'hono/http-exception';
import { ApiError, HttpStatus } from '@ime/models';
import type { User } from '@supabase/supabase-js';

const log = new Logger('api');

export class RouteUtils {
  constructor(private readonly context: Context) {}

  /**
   * Parses and validates the JSON body against the Zod schema you pass in.
   * On failure, bypasses the route and returns a bad request response.
   * On success, passes the parsed, typed body to the route.
   */
  public static validateJsonBody<T extends z.ZodType>(schema: T) {
    return zValidator('json', schema, (result, c) => {
      if (!result.success) {
        return c.json({ error: 'Invalid request body' }, HttpStatus.BadRequest);
      }
      return undefined;
    });
  }

  public static errorHandler(error: Error, c: Context): Response {
    if (error instanceof ApiError) {
      return c.json(
        { error: error.message },
        (error.status ??
          HttpStatus.InternalServerError) as ContentfulStatusCode,
      );
    }
    if (error instanceof HTTPException) {
      return error.getResponse();
    }
    log.error('Unhandled route error', error);
    return c.json(
      { error: 'Internal server error' },
      HttpStatus.InternalServerError,
    );
  }

  public respond(status: HttpStatus, message: string): Response {
    return this.context.json({ error: message }, status);
  }

  public getBearerToken(): string | null {
    const header = this.context.req.header('Authorization');
    return header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : null;
  }

  public getAuthToken(): string {
    const token = this.context.get('authToken');
    if (!token) {
      throw new Error(
        'Auth context missing: authMiddleware did not run for this route.',
      );
    }
    return token;
  }

  public getAuthUser(): User {
    const user = this.context.get('authUser');
    if (!user) {
      throw new Error(
        'Auth context missing: authMiddleware did not run for this route.',
      );
    }
    return user;
  }
}
