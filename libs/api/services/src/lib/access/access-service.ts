import { type Artist, DatabaseRepository, type User } from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';

/**
 * Permission checks shared by every service: who is acting, whether they may
 * act at all, and whether they may act for a given artist.
 */
export class AccessService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
  ) {}

  /**
   * Require a user who is not suspended, for anything that posts, publishes,
   * or sells.
   *
   * @throws ApiError 404 when the user has no profile, 403 when suspended.
   */
  public async requireActiveUser(userId: string): Promise<User> {
    const user = await this.db.users.getById(userId);
    if (!user)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'User not found.',
      );
    if (user.suspendedAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'Your account is suspended.',
      );
    }
    return user;
  }

  /**
   * Require that a user manages an artist.
   *
   * @throws ApiError 404 when the artist does not exist, 403 when the user
   * does not manage it.
   */
  public async requireManager(
    userId: string,
    artistId: string,
  ): Promise<Artist> {
    const artist = await this.db.artists.getById(artistId);
    if (!artist)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Artist not found.',
      );
    if (!(await this.db.artists.isManager(userId, artistId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'You do not manage this artist.',
      );
    }
    return artist;
  }

  /**
   * Require a platform admin.
   *
   * @throws ApiError 403 when the user is not an admin.
   */
  public async requireAdmin(userId: string): Promise<void> {
    if (!(await this.db.moderation.isAdmin(userId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'Admins only.',
      );
    }
  }
}
