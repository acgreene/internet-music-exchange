import { logger } from 'hono/logger';
import type { ImeServices } from '@ime/services';
import { Logger } from '@ime/utils';
import { AbstractRouter } from './abstract-router';
import { ArtistPagesRouter } from './artist-pages';
import { ArtistsRouter } from './artists';
import { AuthRouter } from './auth';
import { HealthRouter } from './health';
import { RouteGuard } from './route-guard';
import { UsersRouter } from './users';

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
      new ArtistPagesRouter(guard, services.artistPages),
    ];
    for (const router of routers) this.routes.route('/', router.router);
  }
}
