import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ApiError, HttpStatus } from '@ime/models';
import { Logger } from '@ime/utils';

const log = new Logger('api');

export class RouteUtils {
  /**
   * Turn anything a route throws into the API's error body: a service's
   * ApiError keeps its status and message, and anything unexpected is logged
   * and answered with a plain 500.
   */
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
}
