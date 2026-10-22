import type * as z from 'zod';
import type { HttpMethod } from './http-method';

/**
 * What a single route and method exchange: the query string schema, for the
 * ones that take one, the request body schema, for the ones that take a body,
 * and the response body schema.
 */
export interface ApiContract {
  readonly query?: z.ZodType;
  readonly request?: z.ZodType;
  readonly response: z.ZodType;
}

/**
 * The contracts of one route, keyed by method.
 */
export type RouteContracts = Partial<Record<HttpMethod, ApiContract>>;
