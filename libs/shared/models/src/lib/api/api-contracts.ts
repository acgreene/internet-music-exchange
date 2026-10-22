import type { z } from 'zod';
import type { ApiContract, RouteContracts } from './contract';
import type { HttpMethod } from './http-method';
import {
  accountContracts,
  type ApiRoute,
  artistContracts,
  artistPageContracts,
  authContracts,
  catalogContracts,
  communityContracts,
  designContracts,
  fundingContracts,
  healthContracts,
  merchContracts,
  moderationContracts,
  orderContracts,
  releaseContracts,
} from './routes';

export type { ApiContract, RouteContracts } from './contract';

/**
 * The request and response contract of every route the API serves, keyed by
 * route and then method. Each domain declares its own in `routes/`.
 *
 * This is the one place a route's shape is declared. Callers name a route and
 * the schemas follow, so a request body and a response body cannot be
 * validated against the wrong contract, and adding a route without declaring
 * its shape is a type error.
 */
export const API_CONTRACTS = {
  ...healthContracts,
  ...authContracts,
  ...artistPageContracts,
  ...accountContracts,
  ...artistContracts,
  ...releaseContracts,
  ...catalogContracts,
  ...merchContracts,
  ...orderContracts,
  ...communityContracts,
  ...designContracts,
  ...fundingContracts,
  ...moderationContracts,
} as const satisfies Record<ApiRoute, RouteContracts>;

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
 * The query string a route and method accept, or undefined when they take
 * none.
 */
export type QueryOf<R extends RouteWith<M>, M extends HttpMethod> =
  ContractOf<R, M> extends { query: infer S extends z.ZodType }
    ? z.infer<S>
    : undefined;

/**
 * The names of a route's `:name` placeholders.
 */
type ParamNames<R extends string> =
  R extends `${string}:${infer Name}/${infer Rest}`
    ? Name | ParamNames<Rest>
    : R extends `${string}:${infer Name}`
      ? Name
      : never;

/**
 * The values a route's `:name` placeholders take, keyed by name.
 */
export type ParamsOf<R extends ApiRoute> = {
  [Name in ParamNames<`${R}`>]: string;
};

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
 * The schema a route and method's query string is validated against, or
 * undefined when the route takes none.
 */
export function querySchema<M extends HttpMethod, R extends RouteWith<M>>(
  route: R,
  method: M,
): z.ZodType | undefined {
  return apiContract(route, method).query;
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
