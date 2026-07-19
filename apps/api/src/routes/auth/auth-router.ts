import type { AuthService } from '@ime/auth';
import {
  ApiRoute,
  signInRequestSchema,
  signUpRequestSchema,
} from '@ime/models';
import { createAuthMiddleware } from './auth-middleware';
import { RouteUtils } from '../utils';
import { AbstractRouter } from '../abstract-router';

export class AuthRouter extends AbstractRouter {
  constructor(private readonly authService: AuthService) {
    super();
    this.register();
  }

  protected register(): void {
    const authMiddleware = createAuthMiddleware(this.authService);

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

    this.routes.post(ApiRoute.SignOut, authMiddleware, async (c) => {
      const routeUtils = new RouteUtils(c);
      const authToken = routeUtils.getAuthToken();
      await this.authService.signOut(authToken);
      return c.json({ success: true });
    });
  }
}
