import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  artistFollowers,
  artists,
  type ReleaseComment,
  releaseComments,
  type ReleaseKind,
  releases,
  users,
} from '../tables';

/**
 * An artist a user follows, with the fields a following list renders.
 */
export interface FollowedArtist {
  artistId: string;
  name: string;
  followedAt: Date;
}

/**
 * A user who follows an artist.
 */
export interface FollowerProfile {
  userId: string;
  username: string | null;
  name: string | null;
  followedAt: Date;
}

/**
 * A release from an artist the user follows. Cover art is resolved separately
 * so a whole feed page takes one query.
 */
export interface FeedRelease {
  releaseId: string;
  title: string;
  kind: ReleaseKind;
  artistId: string;
  artistName: string;
  publishedAt: Date | null;
}

/**
 * A comment with the user who left it, and whether they have edited it since.
 */
export interface ReleaseCommentWithAuthor {
  id: string;
  userId: string;
  username: string | null;
  name: string | null;
  comment: string;
  edited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddCommentParams {
  userId: string;
  releaseId: string;
  comment: string;
}

const DEFAULT_LIST_LIMIT = 24;

/**
 * Queries for what users do around an artist's work rather than to it:
 * following artists, and commenting on releases.
 */
export class SocialRepository {
  constructor(private readonly db: Db) {}

  /**
   * Follow an artist. Following one already followed changes nothing.
   *
   * @param userId - The id of the user following.
   * @param artistId - The id of the artist being followed.
   */
  public async follow(userId: string, artistId: string): Promise<void> {
    await this.db
      .insert(artistFollowers)
      .values({ userId, artistId })
      .onConflictDoNothing();
  }

  /**
   * Stop following an artist, whether the user chose to or a manager removed
   * them.
   *
   * @param userId - The id of the user who followed.
   * @param artistId - The id of the artist being unfollowed.
   */
  public async unfollow(userId: string, artistId: string): Promise<void> {
    await this.db
      .delete(artistFollowers)
      .where(
        and(
          eq(artistFollowers.userId, userId),
          eq(artistFollowers.artistId, artistId),
        ),
      );
  }

  /**
   * Report whether a user follows an artist.
   *
   * @param userId - The id of the user to check.
   * @param artistId - The id of the artist.
   * @returns True when the user follows them.
   */
  public async isFollowing(userId: string, artistId: string): Promise<boolean> {
    const [follow] = await this.db
      .select({ userId: artistFollowers.userId })
      .from(artistFollowers)
      .where(
        and(
          eq(artistFollowers.userId, userId),
          eq(artistFollowers.artistId, artistId),
        ),
      )
      .limit(1);

    return Boolean(follow);
  }

  /**
   * Narrow a set of artists to the ones a user already follows, so a page of
   * follow buttons resolves in a single query.
   *
   * @param userId - The id of the user to check.
   * @param artistIds - The ids of the artists being shown.
   * @returns The subset of those ids the user follows.
   */
  public async filterFollowed(
    userId: string,
    artistIds: string[],
  ): Promise<string[]> {
    if (artistIds.length === 0) return [];

    const followed = await this.db
      .select({ artistId: artistFollowers.artistId })
      .from(artistFollowers)
      .where(
        and(
          eq(artistFollowers.userId, userId),
          inArray(artistFollowers.artistId, artistIds),
        ),
      );

    return followed.map((row) => row.artistId);
  }

  /**
   * Count how many users follow an artist.
   *
   * @param artistId - The id of the artist.
   * @returns The number of followers.
   */
  public async countFollowers(artistId: string): Promise<number> {
    const [followers] = await this.db
      .select({ value: count() })
      .from(artistFollowers)
      .where(eq(artistFollowers.artistId, artistId));

    return followers?.value ?? 0;
  }

  /**
   * List the artists a user follows, most recently followed first.
   *
   * @param userId - The id of the following user.
   * @param limit - The maximum number of artists to return.
   * @param offset - How many artists to skip, for paging.
   * @returns One entry per followed artist with when the user followed them.
   */
  public async listFollowedArtists(
    userId: string,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<FollowedArtist[]> {
    return this.db
      .select({
        artistId: artists.id,
        name: artists.name,
        followedAt: artistFollowers.createdAt,
      })
      .from(artistFollowers)
      .innerJoin(artists, eq(artists.id, artistFollowers.artistId))
      .where(eq(artistFollowers.userId, userId))
      .orderBy(desc(artistFollowers.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * List the users who follow an artist, most recent first.
   *
   * @param artistId - The id of the artist.
   * @param limit - The maximum number of followers to return.
   * @param offset - How many followers to skip, for paging.
   * @returns One entry per follower with their profile and when they followed.
   */
  public async listFollowers(
    artistId: string,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<FollowerProfile[]> {
    return this.db
      .select({
        userId: users.id,
        username: users.username,
        name: users.name,
        followedAt: artistFollowers.createdAt,
      })
      .from(artistFollowers)
      .innerJoin(users, eq(users.id, artistFollowers.userId))
      .where(eq(artistFollowers.artistId, artistId))
      .orderBy(desc(artistFollowers.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * List new music from the artists a user follows.
   *
   * @param userId - The id of the following user.
   * @param limit - The maximum number of releases to return.
   * @param offset - How many releases to skip, for paging.
   * @returns Published releases by followed artists, most recently published
   * first.
   */
  public async listFeedReleases(
    userId: string,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<FeedRelease[]> {
    return this.db
      .select({
        releaseId: releases.id,
        title: releases.title,
        kind: releases.kind,
        artistId: artists.id,
        artistName: artists.name,
        publishedAt: releases.publishedAt,
      })
      .from(artistFollowers)
      .innerJoin(releases, eq(releases.artistId, artistFollowers.artistId))
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(
        and(
          eq(artistFollowers.userId, userId),
          eq(releases.status, 'published'),
        ),
      )
      .orderBy(desc(releases.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Read a release's comment feed, newest first.
   *
   * @param releaseId - The id of the release being discussed.
   * @param limit - The maximum number of comments to return.
   * @param offset - How many comments to skip, for paging.
   * @returns One entry per comment with its author and whether it was edited.
   */
  public async listComments(
    releaseId: string,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<ReleaseCommentWithAuthor[]> {
    return this.db
      .select({
        id: releaseComments.id,
        userId: users.id,
        username: users.username,
        name: users.name,
        comment: releaseComments.comment,
        edited: sql<boolean>`${releaseComments.updatedAt} > ${releaseComments.createdAt}`,
        createdAt: releaseComments.createdAt,
        updatedAt: releaseComments.updatedAt,
      })
      .from(releaseComments)
      .innerJoin(users, eq(users.id, releaseComments.userId))
      .where(eq(releaseComments.releaseId, releaseId))
      .orderBy(desc(releaseComments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count the comments on a release.
   *
   * @param releaseId - The id of the release.
   * @returns The number of comments left on it.
   */
  public async countComments(releaseId: string): Promise<number> {
    const [comments] = await this.db
      .select({ value: count() })
      .from(releaseComments)
      .where(eq(releaseComments.releaseId, releaseId));

    return comments?.value ?? 0;
  }

  /**
   * Find a comment by its id, as when checking who may edit it.
   *
   * @param commentId - The id of the comment to look up.
   * @returns The comment row, or null when no comment has that id.
   */
  public async getCommentById(
    commentId: string,
  ): Promise<ReleaseComment | null> {
    const [comment] = await this.db
      .select()
      .from(releaseComments)
      .where(eq(releaseComments.id, commentId))
      .limit(1);

    return comment ?? null;
  }

  /**
   * Leave a comment on a release.
   *
   * @param params - The author, the release and what they wrote.
   * @returns The newly created comment row.
   */
  public async addComment(params: AddCommentParams): Promise<ReleaseComment> {
    const [comment] = await this.db
      .insert(releaseComments)
      .values(params)
      .returning();

    return comment;
  }

  /**
   * Rewrite a comment. The set_release_comment_updated_at trigger stamps when.
   *
   * @param commentId - The id of the comment to change.
   * @param comment - The replacement text.
   */
  public async updateComment(
    commentId: string,
    comment: string,
  ): Promise<void> {
    await this.db
      .update(releaseComments)
      .set({ comment })
      .where(eq(releaseComments.id, commentId));
  }

  /**
   * Delete a comment.
   *
   * @param commentId - The id of the comment to delete.
   */
  public async deleteComment(commentId: string): Promise<void> {
    await this.db
      .delete(releaseComments)
      .where(eq(releaseComments.id, commentId));
  }
}
