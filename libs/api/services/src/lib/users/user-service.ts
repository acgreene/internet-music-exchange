import {
  DatabaseRepository,
  getPostgresErrorCode,
  PostgresErrorCode,
  type User,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { isValidHandle } from '../naming/naming-utils';

const NAME_MAX_LENGTH = 100;

export interface UpdateProfileParams {
  username?: string;
  name?: string | null;
  /** Whether the user, as a designer, welcomes custom design requests. */
  openToCommissions?: boolean;
  /** Whether to keep off the "supported by" lists of what they buy. */
  hidePurchases?: boolean;
}

/**
 * User profiles: the public handle and display name every account has.
 */
export class UserService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
  ) {}

  /**
   * Read the signed-in user's own profile, and whether they are a platform
   * admin, so the app knows to show the admin tools.
   *
   * @throws ApiError 404 when the user has no profile.
   */
  public async getOwnProfile(
    userId: string,
  ): Promise<User & { isAdmin: boolean }> {
    const user = await this.db.users.getById(userId);
    if (!user)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'User not found.',
      );
    return { ...user, isAdmin: await this.isAdmin(userId) };
  }

  /**
   * Report whether a user is a platform admin.
   */
  public isAdmin(userId: string): Promise<boolean> {
    return this.db.moderation.isAdmin(userId);
  }

  /**
   * Read a public profile, `/users/<username>`.
   *
   * @throws ApiError 404 when nobody has that username.
   */
  public async getPublicProfile(username: string): Promise<User> {
    const user = await this.db.users.getByUsername(username);
    if (!user)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'User not found.',
      );
    return user;
  }

  /**
   * Report whether a username is valid and free, for checking as someone
   * types.
   */
  public async isUsernameAvailable(
    username: string,
    userId?: string,
  ): Promise<boolean> {
    if (!isValidHandle(username)) return false;
    return this.db.users.isUsernameAvailable(username, userId);
  }

  /**
   * Change a user's username, display name, or openness to commissions.
   *
   * @throws ApiError 400 for a malformed username or overlong name, 409 when
   * the username is taken.
   */
  public async updateProfile(
    userId: string,
    params: UpdateProfileParams,
  ): Promise<User> {
    if (params.username !== undefined && !isValidHandle(params.username)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Usernames are 3 to 30 lowercase letters, numbers, hyphens, or underscores, starting and ending with a letter or number.',
      );
    }
    if (params.name && params.name.length > NAME_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Display names are at most ${NAME_MAX_LENGTH} characters.`,
      );
    }

    // a blank display name clears it
    const name =
      params.name === undefined ? undefined : params.name?.trim() || null;

    try {
      await this.db.users.updateById(userId, {
        username: params.username,
        name,
        openToCommissions: params.openToCommissions,
        hidePurchases: params.hidePurchases,
      });
    } catch (error) {
      if (getPostgresErrorCode(error) === PostgresErrorCode.UniqueViolation) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'That username is taken.',
        );
      }
      throw error;
    }

    return this.getOwnProfile(userId);
  }
}
