import { ApiRoute } from '@ime/models';
import { ArtistPageService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';

/**
 * Serves the data a client needs to render a release as an artist page.
 */
export class ArtistPagesRouter extends AbstractRouter {
  constructor(
    private readonly aps: ArtistPageService = new ArtistPageService(),
  ) {
    super();
    this.register();
  }

  protected register(): void {
    this.routes.get(ApiRoute.ArtistReleasePage, async (c) => {
      const releaseId = c.req.param('releaseId');
      const rendered = await this.aps.renderRelease(releaseId);
      return c.json(rendered);
    });
  }
}
