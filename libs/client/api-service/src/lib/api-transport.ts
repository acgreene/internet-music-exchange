import { isDevMode } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ApiError,
  apiErrorBodySchema,
  ApiErrorKind,
  type ApiRoute,
  HttpMethod,
  type RequestOf,
  type ResponseOf,
  responseSchema,
  type RouteWith
} from '@ime/models';
import type { ApiResult } from './api-result';
import { clientEnv } from '@ime/client-env';

/**
 * The body argument of a route and method: required for the routes that
 * declare a request schema, absent for the ones that do not.
 */
type BodyArgs<R extends RouteWith<M>, M extends HttpMethod> =
  RequestOf<R, M> extends undefined ? [] : [body: RequestOf<R, M>];

/**
 * Values substituted into a route's `:name` placeholders, keyed by placeholder.
 */
export type RouteParams = Record<string, string>;

/**
 * @throws Error when a placeholder has no value, so it fails here rather than
 * as a confusing 404 from the server.
 */
function buildPath(route: ApiRoute, params?: RouteParams): string {
  return route.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      throw new Error(`Missing route parameter "${name}" for ${route}`);
    }
    return encodeURIComponent(value);
  });
}

/**
 * Shared HTTP core for the API service. Owns the base URL, performs requests,
 * attaches the Supabase session's bearer token, validates response bodies
 * against contract schemas, and maps every failure mode to a typed ApiError.
 * Domain groups compose this class; nothing extends it.
 */
export class ApiTransport {
  /**
   * The base URL of the API.
   * @private
   */
  private readonly baseUrl = isDevMode()
    ? clientEnv.DEVELOPMENT_API_BASE_URL
    : clientEnv.PRODUCTION_API_BASE_URL;

  constructor(
    /**
     * Lazy source of the Supabase client, called only when a request needs the
     * access token.
     */
    private readonly supabase: () => SupabaseClient,
  ) {}

  /**
   * Fetch a GET route and validate its body against the route's contract.
   */
  public async get<R extends RouteWith<HttpMethod.Get>>(
    route: R,
    params?: RouteParams,
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Get>>> {
    return this.request(HttpMethod.Get, route, undefined, params);
  }

  /**
   * Call a POST route, sending the body its contract declares, and validate
   * the response against that contract.
   */
  public async post<R extends RouteWith<HttpMethod.Post>>(
    route: R,
    ...body: BodyArgs<R, HttpMethod.Post>
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Post>>> {
    return this.request(HttpMethod.Post, route, body[0]);
  }

  /**
   * Call a PUT route, sending the body its contract declares, and validate the
   * response against that contract.
   */
  public async put<R extends RouteWith<HttpMethod.Put>>(
    route: R,
    ...body: BodyArgs<R, HttpMethod.Put>
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Put>>> {
    return this.request(HttpMethod.Put, route, body[0]);
  }

  /**
   * Call a DELETE route and validate the response against its contract.
   */
  public async delete<R extends RouteWith<HttpMethod.Delete>>(
    route: R,
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Delete>>> {
    return this.request(HttpMethod.Delete, route);
  }

  /**
   * Perform a request and map every failure mode to a typed ApiError.
   * @private
   */
  private async request<M extends HttpMethod, R extends RouteWith<M>>(
    method: M,
    route: R,
    body?: unknown,
    params?: RouteParams,
  ): Promise<ApiResult<ResponseOf<R, M>>> {
    const path = buildPath(route, params);
    const schema = responseSchema(route, method);
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const { data } = await this.supabase().auth.getSession();
    const accessToken = data.session?.access_token;
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return {
        ok: false,
        error: new ApiError(
          ApiErrorKind.Network,
          null,
          `Could not reach the API at ${path}`,
        ),
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: new ApiError(
          ApiErrorKind.Http,
          response.status,
          await this.errorMessage(response, path),
        ),
      };
    }

    const responseBody = await response.json().catch(() => undefined);
    const parsed = schema.safeParse(responseBody);
    if (!parsed.success) {
      return {
        ok: false,
        error: new ApiError(
          ApiErrorKind.InvalidResponse,
          response.status,
          `API response for ${path} did not match the expected shape`,
        ),
      };
    }

    return { ok: true, data: parsed.data };
  }

  /**
   * Extract the server-provided message from an error response body, falling
   * back to a generic message when the body is missing or unrecognized.
   * @private
   */
  private async errorMessage(
    response: Response,
    path: string,
  ): Promise<string> {
    const body = await response.json().catch(() => undefined);
    const parsed = apiErrorBodySchema.safeParse(body);
    return parsed.success
      ? parsed.data.error
      : `API responded with ${response.status} for ${path}`;
  }
}
