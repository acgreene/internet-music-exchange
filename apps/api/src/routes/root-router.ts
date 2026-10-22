import { logger } from 'hono/logger';
import type { ImeServices } from '@ime/services';
import { Logger } from '@ime/utils';
import { AbstractRouter } from './abstract-router';
import { ArtistPagesRouter } from './artist-pages';
import { ArtistsRouter } from './artists';
import { AuthRouter } from './auth';
import { CatalogRouter } from './catalog';
import { CommunityRouter } from './community';
import { CratesRouter } from './crates';
import { DesignsRouter } from './designs';
import { FundingRouter } from './funding';
import { HealthRouter } from './health';
import { MerchRouter } from './merch';
import { ModerationRouter } from './moderation';
import { OrdersRouter } from './orders';
import { ReleasesRouter } from './releases';
import { RouteGuard } from './route-guard';
import { UsersRouter } from './users';
import { WebhooksRouter } from './webhooks';

export class RootRouter extends AbstractRouter {
  /**
   * Hands each router the services it needs, all from the one set the
   * process builds at startup, and one guard they share.
   */
  constructor(private readonly services: ImeServices) {
    super(new RouteGuard(services.auth, services.users));
    this.register();
  }

  protected register(): void {
    const httpLog = new Logger('api').child('http');
    this.routes.use(logger((line, ...rest) => httpLog.debug(line, ...rest)));

    const { guard, services } = this;
    const routers: AbstractRouter[] = [
      new HealthRouter(guard, services.health),
      new AuthRouter(guard, services.auth),
      new UsersRouter(guard, services.auth, services.users, services.artists),
      new ArtistsRouter(guard, services.artists),
      new ReleasesRouter(guard, services.releases),
      new CatalogRouter(
        guard,
        services.catalog,
        services.shelves,
        services.search,
        services.charts,
      ),
      new MerchRouter(guard, services.products, services.store),
      new CratesRouter(guard, services.crates, services.dig),
      new CommunityRouter(guard, services.follows, services.comments),
      new DesignsRouter(
        guard,
        services.designs,
        services.designMarketplace,
        services.releaseDesigns,
        services.gallery,
      ),
      new OrdersRouter(
        guard,
        services.checkout,
        services.purchases,
        services.sales,
      ),
      new ArtistPagesRouter(guard, services.artistPages),
      new FundingRouter(
        guard,
        services.paymentAccounts,
        services.billing,
        services.costShares,
        services.donations,
        services.publicCosts,
      ),
      new ModerationRouter(
        guard,
        services.reports,
        services.moderation,
        services.monthlyClose,
      ),
      new WebhooksRouter(guard, services.stripeWebhooks),
    ];
    for (const router of routers) this.routes.route('/', router.router);
  }
}
