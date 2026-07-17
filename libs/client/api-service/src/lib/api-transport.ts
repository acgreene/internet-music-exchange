import { isDevMode } from '@angular/core';
import { z } from 'zod';
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
}

/**
 * Shared HTTP core for the API service. Owns the base URL, performs requests,
 * validates response bodies against contract schemas, and maps every failure
 * mode to a typed ApiError.
 */
export class ApiTransport {
  /**
   * The base URL of the API.
   * @private
   */
  private readonly baseUrl = isDevMode()
    ? DEVELOPMENT_BASE_URL
    : PRODUCTION_BASE_URL;

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
   * Perform a request and map every failure mode to a typed ApiError.
   * @private
   */
  private async request<T>(
    method: HttpMethod,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers:
          body === undefined
            ? undefined
            : { 'Content-Type': 'application/json' },
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
