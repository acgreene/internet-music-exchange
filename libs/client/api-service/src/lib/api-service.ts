import { Injectable } from '@angular/core';
import { ApiRoute, type HealthResponse } from '@ime/models';
import type { ApiResult } from './api-result';
import { ApiTransport } from './api-transport';
import { getSupabaseClient } from './auth';
import { UserApi } from './user';

/**
 * SDK for the IME API.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  /**
   * Shared HTTP core used by this facade and every domain group.
   * @private
   */
  private readonly transport = new ApiTransport(getSupabaseClient);

  /**
   * Account and session operations.
   */
  public readonly user = new UserApi(this.transport, getSupabaseClient);

  /**
   * Check the health of the API.
   */
  public async health(): Promise<ApiResult<HealthResponse>> {
    return this.transport.get(ApiRoute.Health);
  }
}
