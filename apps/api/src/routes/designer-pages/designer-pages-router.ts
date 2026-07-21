import { ApiRoute } from '@ime/models';
import { DesignerPageService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';

/**
 * Serves the data a client needs to render a release as a designer page.
 */
export class DesignerPagesRouter extends AbstractRouter {
  constructor(
    private readonly designerPages: DesignerPageService = new DesignerPageService(),
  ) {
    super();
    this.register();
  }

  protected register(): void {
    this.routes.get(ApiRoute.DesignerPageForRelease, async (c) => {
      const releaseId = c.req.param('releaseId');
      const rendered = await this.designerPages.renderRelease(releaseId);
      return c.json(rendered);
    });
  }
}
