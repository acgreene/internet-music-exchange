import { logger } from 'hono/logger';
import type { ImeServices } from '@ime/services';
import { Logger } from '@ime/utils';
import { UsersRouter } from './users/users-router';
import { AuthRouter } from './auth';
import { ArtistPagesRouter } from './artist-pages';
import { HealthRouter } from './health';
import { AbstractRouter } from './abstract-router';

export class RootRouter extends AbstractRouter {
  /**
   * Hands each router the services it needs, all from the one set the
   * process builds at startup.
   */
  constructor(private readonly services: ImeServices) {
    super();
    this.register();
  }

  protected register(): void {
    const httpLog = new Logger('api').child('http');
    this.routes.use(logger((line, ...rest) => httpLog.debug(line, ...rest)));

    const authRouter = new AuthRouter(this.services.auth).router;
    this.routes.route('/', authRouter);

    const healthRouter = new HealthRouter(this.services.health).router;
    this.routes.route('/', healthRouter);

    const usersRouter = new UsersRouter(this.services.auth).router;
    this.routes.route('/', usersRouter);

    const designerPagesRouter = new ArtistPagesRouter(this.services.artistPages)
      .router;
    this.routes.route('/', designerPagesRouter);
  }
}
