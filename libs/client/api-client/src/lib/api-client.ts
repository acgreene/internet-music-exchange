import { Injectable } from '@angular/core';
import { ApiRoute, type HealthResponse } from '@ime/models';
import type { ApiResult } from './api-result';
import { ApiTransport } from './api-transport';
import { UsersClient } from './user';
import { SupabaseSingleton } from './auth';
import { ArtistPagesClient } from './artist-pages';
import { ArtistsClient } from './artists';
import { CatalogClient } from './catalog';
import { CommunityClient } from './community';
import { MerchClient } from './merch';
import { OrdersClient } from './orders';
import { ReleasesClient } from './releases';

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

  /**
   * What listeners browse, read, and play.
   */
  public readonly catalog = new CatalogClient(this.transport);

  /**
   * Merch: stores and product pages, and what managers build.
   */
  public readonly merch = new MerchClient(this.transport);

  /**
   * Following artists, and comments.
   */
  public readonly community = new CommunityClient(this.transport);

  /**
   * Checkout, purchases, and sales.
   */
  public readonly orders = new OrdersClient(this.transport);

  /**
   * Releases, for their artist's managers.
   */
  public readonly releases = new ReleasesClient(this.transport);

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
