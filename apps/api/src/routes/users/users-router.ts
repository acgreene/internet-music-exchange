import { ApiRoute, HttpMethod } from '@ime/models';
import type { ArtistService, AuthService, UserService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Accounts: the signed-in user's own profile, public profiles, whether names
 * are free, and deleting an account.
 */
export class UsersRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly auth: AuthService,
    private readonly users: UserService,
    private readonly artists: ArtistService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(HttpMethod.Delete, ApiRoute.Users, 'user', ({ userId }) =>
      this.auth.deleteUser(userId),
    );

    this.handle(HttpMethod.Get, ApiRoute.Me, 'user', ({ userId }) =>
      this.users.getOwnProfile(userId),
    );

    this.handle(HttpMethod.Patch, ApiRoute.Me, 'user', ({ userId, body }) =>
      this.users.updateProfile(userId, body),
    );

    this.handle(HttpMethod.Get, ApiRoute.UserProfile, 'public', ({ params }) =>
      this.users.getPublicProfile(params.username),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.UsernameAvailability,
      'user',
      async ({ params, userId }) => ({
        available: await this.users.isUsernameAvailable(
          params.username,
          userId,
        ),
      }),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.HandleAvailability,
      'user',
      async ({ params, query }) => ({
        available: await this.artists.isHandleAvailable(
          params.handle,
          query.artistId,
        ),
      }),
    );
  }
}
