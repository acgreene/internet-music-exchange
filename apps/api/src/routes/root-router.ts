import { logger } from 'hono/logger';
import { AuthService } from '@ime/services';
import { Logger } from '@ime/utils';
import { UsersRouter } from './users/users-router';
import { AuthRouter } from './auth';
import { ArtistPagesRouter } from './artist-pages';
import { HealthRouter } from './health';
import { AbstractRouter } from './abstract-router';

export class RootRouter extends AbstractRouter {
  /**
   * Owns the single auth service for the process and hands it to every router
   * that needs one, so all of them — and their auth middleware — share it.
   */
  constructor(private readonly authService = new AuthService()) {
    super();
    this.register();
  }

  protected register(): void {
    const httpLog = new Logger('api').child('http');
    this.routes.use(logger((line, ...rest) => httpLog.debug(line, ...rest)));

    const authRouter = new AuthRouter(this.authService).router;
    this.routes.route('/', authRouter);

    const healthRouter = new HealthRouter().router;
    this.routes.route('/', healthRouter);

    const usersRouter = new UsersRouter(this.authService).router;
    this.routes.route('/', usersRouter);

    const designerPagesRouter = new ArtistPagesRouter().router;
    this.routes.route('/', designerPagesRouter);
  }
}
