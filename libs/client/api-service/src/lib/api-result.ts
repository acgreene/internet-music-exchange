import type { ApiError } from './api-error';

/**
 * The outcome of an API call. Discriminate on the ok flag: true carries the
 * validated data, false carries a typed ApiError. Methods never throw.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
