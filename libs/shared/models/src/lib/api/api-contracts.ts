import type { z } from 'zod';
import { ackSchema } from './general';
import { HttpMethod } from './http-method';
import {
  ApiRoute,
  designerPageRenderResponseSchema,
  healthResponseSchema,
  sessionSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from './routes';

/**
 * What a single route and method exchange: the request body schema, for the
 * ones that take a body, and the response body schema.
 */
interface ApiContract {
  readonly request?: z.ZodType;
  readonly response: z.ZodType;
}

/**
 * The request and response contract of every route the API serves, keyed by
 * route and then method.
 *
 * This is the one place a route's shape is declared. Callers name a route and
 * the schemas follow, so a request body and a response body cannot be
 * validated against the wrong contract, and adding a route without declaring
 * its shape is a type error.
 */
export const API_CONTRACTS = {
  [ApiRoute.Health]: {
    [HttpMethod.Get]: { response: healthResponseSchema },
  },
  [ApiRoute.Users]: {
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.SignUp]: {
    [HttpMethod.Post]: {
      request: signUpRequestSchema,
      response: sessionSchema,
    },
  },
  [ApiRoute.SignIn]: {
    [HttpMethod.Post]: {
      request: signInRequestSchema,
      response: sessionSchema,
    },
  },
  [ApiRoute.SignOut]: {
    [HttpMethod.Post]: { response: ackSchema },
  },
  [ApiRoute.DesignerPageForRelease]: {
    [HttpMethod.Get]: { response: designerPageRenderResponseSchema },
  },
} as const satisfies Record<ApiRoute, Partial<Record<HttpMethod, ApiContract>>>;

/**
 * The declared contracts, as written above.
 */
type Contracts = typeof API_CONTRACTS;

/**
 * The routes that serve a given method. Lets a caller that only handles POST
 * reject a GET-only route at compile time.
 */
export type RouteWith<M extends HttpMethod> = {
  [R in ApiRoute]: M extends keyof Contracts[R] ? R : never;
}[ApiRoute];

/**
 * The contract declared for a route and method.
 */
type ContractOf<
  R extends ApiRoute,
  M extends HttpMethod,
> = M extends keyof Contracts[R] ? Contracts[R][M] : never;

/**
 * The validated response body a route and method return.
 */
export type ResponseOf<R extends RouteWith<M>, M extends HttpMethod> =
  ContractOf<R, M> extends { response: infer S extends z.ZodType }
    ? z.infer<S>
    : never;

/**
 * The request body a route and method accept, or undefined when they take
 * none.
 */
export type RequestOf<R extends RouteWith<M>, M extends HttpMethod> =
  ContractOf<R, M> extends { request: infer S extends z.ZodType }
    ? z.infer<S>
    : undefined;

/**
 * Look up the contract for a route and method.
 */
export function apiContract<M extends HttpMethod, R extends RouteWith<M>>(
  route: R,
  method: M,
): ApiContract {
  return (API_CONTRACTS[route] as Record<M, ApiContract>)[method];
}

/**
 * The schema a route and method's response body is validated against.
 */
export function responseSchema<M extends HttpMethod, R extends RouteWith<M>>(
  route: R,
  method: M,
): z.ZodType<ResponseOf<R, M>> {
  return apiContract(route, method).response as z.ZodType<ResponseOf<R, M>>;
}

/**
 * The schema a route and method's request body is validated against, or
 * undefined when the route takes no body.
 */
export function requestSchema<M extends HttpMethod, R extends RouteWith<M>>(
  route: R,
  method: M,
): z.ZodType | undefined {
  return apiContract(route, method).request;
}
