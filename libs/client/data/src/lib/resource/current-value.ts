import type { Resource } from '@angular/core';

/**
 * A resource's value, or undefined while it loads or after it failed. Reading
 * `value()` itself throws once a resource has failed.
 */
export function currentValue<T>(resource: Resource<T>): T | undefined {
  return resource.hasValue() ? resource.value() : undefined;
}
