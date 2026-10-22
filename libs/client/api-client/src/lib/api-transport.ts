import { isDevMode } from '@angular/core';
import {
  ApiError,
  apiErrorBodySchema,
  ApiErrorKind,
  type ApiRoute,
  HttpMethod,
  type ParamsOf,
  type QueryOf,
  type RequestOf,
  type ResponseOf,
  responseSchema,
  type RouteWith,
} from '@ime/models';
import type { ApiResult } from './api-result';
import { clientEnv } from '@ime/client-env';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * What a call to a route and method takes: its path params when the route has
 * placeholders, its body when the contract declares one, and its query string
 * when it accepts one. Each is required exactly when the route needs it.
 */
export type RequestOptions<
  M extends HttpMethod,
  R extends RouteWith<M>,
> = (keyof ParamsOf<R> extends never
  ? { params?: undefined }
  : { params: ParamsOf<R> }) &
  (RequestOf<R, M> extends undefined
    ? { body?: undefined }
    : { body: RequestOf<R, M> }) &
  (QueryOf<R, M> extends undefined
    ? { query?: undefined }
    : { query?: QueryOf<R, M> });

/**
 * The options argument, optional when the route needs nothing.
 */
type OptionsArgs<M extends HttpMethod, R extends RouteWith<M>> =
  object extends RequestOptions<M, R>
    ? [options?: RequestOptions<M, R>]
    : [options: RequestOptions<M, R>];

/**
 * @throws Error when a placeholder has no value, so it fails here rather than
 * as a confusing 404 from the server.
 */
function buildPath(route: ApiRoute, params?: object, query?: unknown): string {
  const values = (params ?? {}) as Record<string, string | undefined>;
  const path = route.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    const value = values[name];
    if (value === undefined) {
      throw new Error(`Missing route parameter "${name}" for ${route}`);
    }
    return encodeURIComponent(value);
  });

  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(
    (query ?? {}) as Record<string, unknown>,
  )) {
    if (value !== undefined && value !== null) search.set(name, String(value));
  }
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * Shared HTTP core for the API service. Owns the base URL, performs requests,
 * attaches the Supabase session's bearer token, validates response bodies
 * against contract schemas, and maps every failure mode to a typed ApiError.
 */
export class ApiTransport {
  /**
   * The base URL of the API.
   * @private
   */
  private readonly baseUrl = isDevMode()
    ? clientEnv.DEVELOPMENT_API_BASE_URL
    : clientEnv.PRODUCTION_API_BASE_URL;

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Fetch a GET route and validate its body against the route's contract.
   */
  public get<R extends RouteWith<HttpMethod.Get>>(
    route: R,
    ...options: OptionsArgs<HttpMethod.Get, R>
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Get>>> {
    return this.request(HttpMethod.Get, route, options[0]);
  }

  /**
   * Call a POST route, sending the body its contract declares, and validate
   * the response against that contract.
   */
  public post<R extends RouteWith<HttpMethod.Post>>(
    route: R,
    ...options: OptionsArgs<HttpMethod.Post, R>
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Post>>> {
    return this.request(HttpMethod.Post, route, options[0]);
  }

  /**
   * Call a PUT route, sending the value its contract declares, and validate
   * the response against that contract.
   */
  public put<R extends RouteWith<HttpMethod.Put>>(
    route: R,
    ...options: OptionsArgs<HttpMethod.Put, R>
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Put>>> {
    return this.request(HttpMethod.Put, route, options[0]);
  }

  /**
   * Call a PATCH route, sending the changes its contract declares, and
   * validate the response against that contract.
   */
  public patch<R extends RouteWith<HttpMethod.Patch>>(
    route: R,
    ...options: OptionsArgs<HttpMethod.Patch, R>
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Patch>>> {
    return this.request(HttpMethod.Patch, route, options[0]);
  }

  /**
   * Call a DELETE route and validate the response against its contract.
   */
  public delete<R extends RouteWith<HttpMethod.Delete>>(
    route: R,
    ...options: OptionsArgs<HttpMethod.Delete, R>
  ): Promise<ApiResult<ResponseOf<R, HttpMethod.Delete>>> {
    return this.request(HttpMethod.Delete, route, options[0]);
  }

  /**
   * Perform a request and map every failure mode to a typed ApiError.
   * @private
   */
  private async request<M extends HttpMethod, R extends RouteWith<M>>(
    method: M,
    route: R,
    options?: { params?: object; body?: unknown; query?: unknown },
  ): Promise<ApiResult<ResponseOf<R, M>>> {
    const path = buildPath(route, options?.params, options?.query);
    const body = options?.body;
    const schema = responseSchema(route, method);
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const { data } = await this.supabase.auth.getSession();
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
