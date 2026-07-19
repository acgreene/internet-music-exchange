import type { AuthService } from '@ime/auth';
import { ApiRoute, signInRequestSchema, signUpRequestSchema } from '@ime/models';
import { RouteUtils } from '../utils';
import { AbstractRouter } from '../abstract-router';
import { MiddlewareHandler } from 'hono';
import { AuthMiddleware } from './auth-middleware';

export class AuthRouter extends AbstractRouter {
  private readonly authMiddleware: MiddlewareHandler;

  constructor(private readonly authService: AuthService) {
    super();
    this.register();
    this.authMiddleware = new AuthMiddleware(authService).middleware();
  }

  protected register(): void {
    this.routes.post(
      ApiRoute.SignUp,
      RouteUtils.validateJsonBody(signUpRequestSchema),
      async (c) => {
        const { email, password } = c.req.valid('json');
        const session = await this.authService.signUp(email, password);
        return c.json(session);
      },
    );

    this.routes.post(
      ApiRoute.SignIn,
      RouteUtils.validateJsonBody(signInRequestSchema),
      async (c) => {
        const { email, password } = c.req.valid('json');
        const session = await this.authService.signIn(email, password);
        return c.json(session);
      },
    );

    this.routes.post(ApiRoute.SignOut, this.authMiddleware, async (c) => {
      const routeUtils = new RouteUtils(c);
      const authToken = routeUtils.getAuthToken();
      await this.authService.signOut(authToken);
      return c.json({ success: true });
    });
  }
}
