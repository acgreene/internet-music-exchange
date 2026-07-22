import type { ApiError } from '@ime/models';

/**
 * The outcome of an API call. Alters based on the ok flag: true carries the
 * validated data, false carries a typed ApiError.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
