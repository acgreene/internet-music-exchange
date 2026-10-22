import {
  ApiRoute,
  type FeedItem,
  type LibraryItem,
  type PageQuery,
  type ReleaseCard,
  type ReleaseCardWithArtist,
  type ReleasePageResponse,
  type SearchResults,
  type SignedUrlResponse,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * What listeners read and play. Links to stream, download, or open a file
 * expire soon, so fetch one right before using it.
 */
export class CatalogClient {
  constructor(private readonly transport: ApiTransport) {}

  /**
   * The newest releases.
   */
  public listRecent(
    page?: PageQuery,
  ): Promise<ApiResult<ReleaseCardWithArtist[]>> {
    return this.transport.get(ApiRoute.CatalogReleases, { query: page });
  }

  public search(query: string): Promise<ApiResult<SearchResults>> {
    return this.transport.get(ApiRoute.CatalogSearch, { query: { q: query } });
  }

  /**
   * An artist's published releases, by handle.
   */
  public listDiscography(handle: string): Promise<ApiResult<ReleaseCard[]>> {
    return this.transport.get(ApiRoute.CatalogDiscography, {
      params: { handle },
    });
  }

  /**
   * A release page. Signed in, it also says whether the listener owns it.
   */
  public getReleasePage(
    handle: string,
    slug: string,
  ): Promise<ApiResult<ReleasePageResponse>> {
    return this.transport.get(ApiRoute.CatalogReleasePage, {
      params: { handle, slug },
    });
  }

  public getStreamUrl(
    releaseId: string,
    trackId: string,
  ): Promise<ApiResult<SignedUrlResponse>> {
    return this.transport.get(ApiRoute.CatalogTrackStream, {
      params: { releaseId, trackId },
    });
  }

  public getDownloadUrl(
    releaseId: string,
    trackId: string,
  ): Promise<ApiResult<SignedUrlResponse>> {
    return this.transport.get(ApiRoute.CatalogTrackDownload, {
      params: { releaseId, trackId },
    });
  }

  public getAssetUrl(assetId: string): Promise<ApiResult<SignedUrlResponse>> {
    return this.transport.get(ApiRoute.CatalogAsset, { params: { assetId } });
  }

  /**
   * The releases the signed-in user owns.
   */
  public getLibrary(page?: PageQuery): Promise<ApiResult<LibraryItem[]>> {
    return this.transport.get(ApiRoute.MyLibrary, { query: page });
  }

  /**
   * New releases from the artists the signed-in user follows.
   */
  public getFeed(page?: PageQuery): Promise<ApiResult<FeedItem[]>> {
    return this.transport.get(ApiRoute.MyFeed, { query: page });
  }
}
