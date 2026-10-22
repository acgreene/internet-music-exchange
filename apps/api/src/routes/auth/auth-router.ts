import { ApiRoute, HttpMethod } from '@ime/models';
import type { AuthService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

export class AuthRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly auth: AuthService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    // the session goes back whole, every field supabase-js gave it
    this.handle(
      HttpMethod.Post,
      ApiRoute.SignUp,
      'public',
      async ({ body }) => ({
        ...(await this.auth.signUp(body.email, body.password)),
      }),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.SignIn,
      'public',
      async ({ body }) => ({
        ...(await this.auth.signIn(body.email, body.password)),
      }),
    );

    this.handle(HttpMethod.Post, ApiRoute.SignOut, 'user', ({ token }) =>
      this.auth.signOut(token),
    );
  }
}
