import { ApiRoute, HttpMethod } from '@ime/models';
import type { CatalogService, ShelfService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * What listeners read: new releases, search, discographies, release pages,
 * links that stream, download, and open files, and their library and feed.
 */
export class CatalogRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly catalog: CatalogService,
    private readonly shelves: ShelfService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogReleases,
      'public',
      ({ query }) => this.catalog.listRecent(query.limit, query.offset),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogHome,
      'optional',
      ({ userId }) => this.shelves.getHome(userId),
    );

    this.handle(HttpMethod.Get, ApiRoute.CatalogSearch, 'public', ({ query }) =>
      this.catalog.search(query.q),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogDiscography,
      'public',
      ({ params }) => this.catalog.listDiscography(params.handle),
    );

    // owners and managers see more of a release than the public does
    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogReleasePage,
      'optional',
      ({ params, userId }) =>
        this.catalog.getReleasePage(params.handle, params.slug, userId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogTrackStream,
      'optional',
      async ({ params, userId }) => ({
        url: await this.catalog.getStreamUrl(
          params.releaseId,
          params.trackId,
          userId,
        ),
      }),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogTrackDownload,
      'user',
      async ({ params, userId }) => ({
        url: await this.catalog.getDownloadUrl(
          params.releaseId,
          params.trackId,
          userId,
        ),
      }),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogAsset,
      'optional',
      async ({ params, userId }) => ({
        url: await this.catalog.getAssetUrl(params.assetId, userId),
      }),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.MyLibrary,
      'user',
      ({ userId, query }) =>
        this.catalog.getLibrary(userId, query.limit, query.offset),
    );

    this.handle(HttpMethod.Get, ApiRoute.MyFeed, 'user', ({ userId, query }) =>
      this.catalog.getFeed(userId, query.limit, query.offset),
    );
  }
}
