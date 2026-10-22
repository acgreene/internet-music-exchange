import { ApiRoute, HttpMethod } from '@ime/models';
import type { ArtistPageService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Serves the data a client needs to render a release as an artist page.
 */
export class ArtistPagesRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly artistPages: ArtistPageService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistReleasePage,
      'public',
      ({ params }) => this.artistPages.renderRelease(params.releaseId),
    );
  }
}
