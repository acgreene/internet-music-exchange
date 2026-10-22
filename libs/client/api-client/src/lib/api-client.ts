import { Injectable } from '@angular/core';
import { ApiRoute, type HealthResponse } from '@ime/models';
import type { ApiResult } from './api-result';
import { ApiTransport } from './api-transport';
import { UsersClient } from './user';
import { SupabaseSingleton } from './auth';
import { ArtistPagesClient } from './artist-pages';
import { ArtistsClient } from './artists';

/**
 * SDK for the IME API.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly supabase = SupabaseSingleton.getInstance().supabase;
  /**
   * Shared HTTP core used by this facade and every domain group.
   * @private
   */
  private readonly transport = new ApiTransport(this.supabase);

  /**
   * Account and session operations.
   */
  public readonly user = new UsersClient(this.transport, this.supabase);

  /**
   * Artists' profiles, and what their managers edit.
   */
  public readonly artists = new ArtistsClient(this.transport);

  public readonly artistPages = new ArtistPagesClient(
    this.transport,
    this.supabase,
  );

  /**
   * Check the health of the API.
   */
  public async health(): Promise<ApiResult<HealthResponse>> {
    return this.transport.get(ApiRoute.Health);
  }
}
