import { Hono, type Context, type HonoRequest } from 'hono';
import { z } from 'zod';
import {
  type AckResponse,
  ApiError,
  ApiErrorKind,
  apiContract,
  HttpMethod,
  HttpStatus,
  type ParamsOf,
  type QueryOf,
  type RequestOf,
  type ResponseOf,
  type RouteWith,
} from '@ime/models';
import { Logger } from '@ime/utils';
import type { Access, RouteGuard } from './route-guard';
import { RouteUtils } from './utils';

const log = new Logger('api').child('routes');
/** Any id Postgres accepts, not only RFC 4122 versions, which seed data skips. */
const idSchema = z.guid();

/**
 * Everything a handler gets: input already checked against the route's
 * contract, and the caller as far as its access allows.
 */
export interface RouteContext<
  M extends HttpMethod,
  R extends RouteWith<M>,
  A extends Access,
> {
  params: ParamsOf<R>;
  query: QueryOf<R, M>;
  body: RequestOf<R, M>;
  /** The signed-in user: always there for `user` and `admin` routes. */
  userId: A extends 'user' | 'admin'
    ? string
    : A extends 'optional'
      ? string | undefined
      : undefined;
  /** The caller's access token, for routes that act on the session itself. */
  token: A extends 'user' | 'admin' ? string : string | undefined;
  /** The raw request, for routes that need its exact body or headers. */
  request: HonoRequest;
}

/**
 * What a handler returns: the response its contract declares, or nothing for
 * routes that only acknowledge.
 */
type HandlerResult<M extends HttpMethod, R extends RouteWith<M>> =
  ResponseOf<R, M> extends AckResponse ? void : ResponseOf<R, M>;

/**
 * Base class for all API routes.
 */
export abstract class AbstractRouter {
  protected constructor(
    protected readonly guard: RouteGuard,
    protected routes = new Hono(),
  ) {
    this.routes.onError(RouteUtils.errorHandler);
  }

  /**
   * The group of routes exposed by this router. Created via the `register()`
   * method in the child class.
   */
  public get router(): Hono {
    return this.routes;
  }

  /**
   * Instantiate and register the route group. Define the individual routes
   * in this method with `this.handle()`, then call `this.register()` in the
   * child class constructor so that routes only register once at
   * construction.
   */
  protected abstract register(): void;

  /**
   * Read a path param that must be one of a fixed set of values, such as an
   * image kind. Anything else names nothing, so it is a 404.
   */
  protected enumParam<T extends string>(
    values: readonly T[],
    value: string,
  ): T {
    if (!(values as readonly string[]).includes(value)) {
      throw new ApiError(ApiErrorKind.Http, HttpStatus.NotFound, 'Not found.');
    }
    return value as T;
  }

  /**
   * Serve one route and method by its contract in `@ime/models`. The caller
   * is checked against `access`, path ids, the query string, and the body are
   * validated before the handler runs, and what the handler returns is parsed
   * through the response schema, which drops anything the contract does not
   * list.
   */
  protected handle<
    M extends HttpMethod,
    R extends RouteWith<M>,
    A extends Access,
  >(
    method: M,
    route: R,
    access: A,
    handler: (context: RouteContext<M, R, A>) => Promise<HandlerResult<M, R>>,
  ): void {
    const contract = apiContract(route, method);

    this.routes.on(method, route, async (c) => {
      const caller = await this.guard.identify(c, access);
      const params = c.req.param() as Record<string, string>;
      for (const [name, value] of Object.entries(params)) {
        // a malformed id names nothing, and would only fail in the database
        if (name.endsWith('Id') && !idSchema.safeParse(value).success) {
          throw new ApiError(
            ApiErrorKind.Http,
            HttpStatus.NotFound,
            'Not found.',
          );
        }
      }

      const result = await handler({
        params,
        query: validate(contract.query, c.req.query(), 'query string'),
        body: contract.request
          ? validate(contract.request, await readJson(c), 'request body')
          : undefined,
        userId: caller.userId,
        token: caller.token,
        request: c.req,
      } as RouteContext<M, R, A>);

      const response = contract.response.safeParse(result ?? { success: true });
      if (!response.success) {
        log.error(
          `${method} ${route} returned a response its contract does not allow`,
          response.error,
        );
        throw new Error(`Response for ${method} ${route} broke its contract`);
      }
      return c.json(response.data);
    });
  }
}

/**
 * Parse input against a schema, or answer 400 naming the first problem.
 */
function validate(
  schema: z.ZodType | undefined,
  value: unknown,
  what: string,
): unknown {
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (!result.success) {
    const [issue] = result.error.issues;
    const at = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    throw new ApiError(
      ApiErrorKind.Http,
      HttpStatus.BadRequest,
      `Invalid ${what}${at}: ${issue.message}`,
    );
  }
  return result.data;
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(
      ApiErrorKind.Http,
      HttpStatus.BadRequest,
      'The request body must be JSON.',
    );
  }
}
