import {
  ApiRoute,
  type CatalogHome,
  type CatalogSearchQuery,
  type Chart,
  type ChartQuery,
  type FeedItem,
  type LibraryItem,
  type PlaceCount,
  type PageQuery,
  type ReleaseCard,
  type ReleaseCardWithArtist,
  type ReleasePageResponse,
  type SearchResults,
  type SearchSuggestions,
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

  /**
   * Today's home page shelves, with the listener's own when signed in.
   */
  public getHome(): Promise<ApiResult<CatalogHome>> {
    return this.transport.get(ApiRoute.CatalogHome);
  }

  /**
   * A chart of releases by how many people bought or claimed them.
   */
  public getChart(query: ChartQuery): Promise<ApiResult<Chart>> {
    return this.transport.get(ApiRoute.Charts, { query });
  }

  /**
   * Releases matching words and filters, with counts for every filter.
   */
  public search(query: CatalogSearchQuery): Promise<ApiResult<SearchResults>> {
    return this.transport.get(ApiRoute.CatalogSearch, { query });
  }

  /**
   * Every place artists with music on sale are based.
   */
  public listPlaces(): Promise<ApiResult<PlaceCount[]>> {
    return this.transport.get(ApiRoute.CatalogPlaces);
  }

  /**
   * Artists, releases, and tags for what someone has typed so far.
   */
  public suggest(q: string): Promise<ApiResult<SearchSuggestions>> {
    return this.transport.get(ApiRoute.CatalogSuggest, { query: { q } });
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
