import { isDevMode } from '@angular/core';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiErrorBodySchema } from '@ime/models';
import { ApiError, ApiErrorKind } from './api-error';
import type { ApiResult } from './api-result';

// Same-origin in development; the dev servers proxy /api to the local API.
const DEVELOPMENT_BASE_URL = '';

// Placeholder until a production deployment exists; set the real API origin here.
const PRODUCTION_BASE_URL = '';

/**
 * HTTP methods the transport can perform. Values are wire format.
 */
enum HttpMethod {
  /**
   * Read a resource.
   */
  Get = 'GET',

  /**
   * Create a resource or invoke an action with a JSON body.
   */
  Post = 'POST',

  /**
   * Replace or update a resource with a JSON body.
   */
  Put = 'PUT',

  /**
   * Remove a resource.
   */
  Delete = 'DELETE',
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
    ? DEVELOPMENT_BASE_URL
    : PRODUCTION_BASE_URL;

  constructor(
    /**
     * Lazy source of the Supabase client, called only when a request needs the
     * access token so SSR never constructs the client.
     */
    private readonly supabase: () => SupabaseClient,
  ) {}

  /**
   * Fetch a GET endpoint and validate its body against the given contract schema.
   */
  public async get<T>(
    path: string,
    schema: z.ZodType<T>,
  ): Promise<ApiResult<T>> {
    return this.request(HttpMethod.Get, path, schema);
  }

  /**
   * Send a JSON body to a POST endpoint and validate the response body against
   * the given contract schema.
   */
  public async post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<ApiResult<T>> {
    return this.request(HttpMethod.Post, path, schema, body);
  }

  /**
   * Send a JSON body to a PUT endpoint and validate the response body against
   * the given contract schema.
   */
  public async put<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<ApiResult<T>> {
    return this.request(HttpMethod.Put, path, schema, body);
  }

  /**
   * Call a DELETE endpoint and validate the response body against the given
   * contract schema.
   */
  public async delete<T>(
    path: string,
    schema: z.ZodType<T>,
  ): Promise<ApiResult<T>> {
    return this.request(HttpMethod.Delete, path, schema);
  }

  /**
   * Perform a request and map every failure mode to a typed ApiError. All verb
   * methods delegate here so cross-cutting behavior is applied exactly once.
   * @private
   */
  private async request<T>(
    method: HttpMethod,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<ApiResult<T>> {
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
