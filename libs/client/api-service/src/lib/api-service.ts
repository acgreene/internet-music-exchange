import { Injectable } from '@angular/core';
import { ApiRoute, type HealthResponse, healthResponseSchema } from '@ime/models';
import type { ApiResult } from './api-result';
import { ApiTransport } from './api-transport';

/**
 * SDK for the IME API.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  /**
   * Shared HTTP core used by this facade and every future domain group.
   * @private
   */
  private readonly transport = new ApiTransport();

  /**
   * Check the health of the API.
   */
  public async health(): Promise<ApiResult<HealthResponse>> {
    return this.transport.get(ApiRoute.Health, healthResponseSchema);
  }
}
