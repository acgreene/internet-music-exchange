import {
  DatabaseRepository,
  type FollowedArtist,
  type FollowerProfile,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';

/**
 * Following artists. Following is public: an artist's follower count is
 * shown to everyone, and its managers can see who follows it and remove a
 * follower. The feed following produces is on `CatalogService`.
 */
export class FollowService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly access: AccessService = new AccessService(db),
  ) {}

  /**
   * Follow an artist. Following one already followed changes nothing.
   *
   * @throws ApiError 404 when no visible artist has that id.
   */
  public async follow(userId: string, artistId: string): Promise<void> {
    await this.requireVisibleArtist(artistId);
    await this.db.social.follow(userId, artistId);
  }

  /**
   * Stop following an artist.
   */
  public async unfollow(userId: string, artistId: string): Promise<void> {
    await this.db.social.unfollow(userId, artistId);
  }

  /**
   * Of the artists on a page, the ones a user already follows, so the page
   * shows every follow button at once.
   */
  public filterFollowed(
    userId: string,
    artistIds: string[],
  ): Promise<string[]> {
    return this.db.social.filterFollowed(userId, artistIds);
  }

  /**
   * The artists a user follows, most recently followed first.
   */
  public listFollowing(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<FollowedArtist[]> {
    return this.db.social.listFollowedArtists(userId, limit, offset);
  }

  /**
   * How many users follow an artist.
   */
  public countFollowers(artistId: string): Promise<number> {
    return this.db.social.countFollowers(artistId);
  }

  /**
   * Who follows an artist, most recent first, for its managers.
   */
  public async listFollowers(
    userId: string,
    artistId: string,
    limit?: number,
    offset?: number,
  ): Promise<FollowerProfile[]> {
    await this.access.requireManager(userId, artistId);
    return this.db.social.listFollowers(artistId, limit, offset);
  }

  /**
   * Remove one of an artist's followers, as moderation by its managers.
   */
  public async removeFollower(
    userId: string,
    artistId: string,
    followerUserId: string,
  ): Promise<void> {
    await this.access.requireManager(userId, artistId);
    await this.db.social.unfollow(followerUserId, artistId);
  }

  private async requireVisibleArtist(artistId: string): Promise<void> {
    const artist = await this.db.artists.getById(artistId);
    if (!artist || artist.suspendedAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Artist not found.',
      );
    }
  }
}
