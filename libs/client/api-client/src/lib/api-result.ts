import type { ApiError } from '@ime/models';

/**
 * The outcome of an API call. Alters based on the ok flag: true carries the
 * validated data, false carries a typed ApiError.
 */
export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * The data of a successful result, or its error thrown, for loaders that
 * report failure by throwing (such as a resource's).
 */
export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw result.error;
  return result.data;
}
