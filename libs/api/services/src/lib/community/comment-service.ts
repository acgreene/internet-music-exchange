import {
  DatabaseRepository,
  type ReleaseComment,
  type ReleaseCommentWithAuthor,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';

/** Matches the database's limit on a comment. */
export const COMMENT_MAX_LENGTH = 2000;

/**
 * Comments on releases. Anyone can read them; signed-in users in good
 * standing can post, and edit or delete their own. An artist's managers can
 * delete any comment on the artist's releases.
 */
export class CommentService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly access: AccessService = new AccessService(db),
  ) {}

  /**
   * A release's comments, newest first, each with its author and whether it
   * was edited.
   *
   * @throws ApiError 404 when the release is not out.
   */
  public async listComments(
    releaseId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ comments: ReleaseCommentWithAuthor[]; total: number }> {
    await this.requireOpenRelease(releaseId);
    const [comments, total] = await Promise.all([
      this.db.social.listComments(releaseId, limit, offset),
      this.db.social.countComments(releaseId),
    ]);
    return { comments, total };
  }

  /**
   * Comment on a release.
   *
   * @throws ApiError 400 for an empty or overlong comment, 403 when the user
   * is suspended, 404 when the release is not out.
   */
  public async addComment(
    userId: string,
    releaseId: string,
    comment: string,
  ): Promise<ReleaseComment> {
    await this.access.requireActiveUser(userId);
    await this.requireOpenRelease(releaseId);
    return this.db.social.addComment({
      userId,
      releaseId,
      comment: this.validComment(comment),
    });
  }

  /**
   * Rewrite one of your own comments. It is marked edited.
   *
   * @throws ApiError 400 for an empty or overlong comment, 403 for someone
   * else's comment or a suspended user, 404 when it does not exist.
   */
  public async editComment(
    userId: string,
    commentId: string,
    comment: string,
  ): Promise<void> {
    await this.access.requireActiveUser(userId);
    const existing = await this.requireComment(commentId);
    if (existing.userId !== userId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'You can only edit your own comments.',
      );
    }
    await this.db.social.updateComment(commentId, this.validComment(comment));
  }

  /**
   * Delete a comment: your own, or any on a release of an artist you manage.
   *
   * @throws ApiError 403 for someone else's comment on another artist's
   * release, 404 when it does not exist.
   */
  public async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.requireComment(commentId);
    if (comment.userId !== userId) {
      await this.access.requireReleaseManager(userId, comment.releaseId);
    }
    await this.db.social.deleteComment(commentId);
  }

  private async requireComment(commentId: string): Promise<ReleaseComment> {
    const comment = await this.db.social.getCommentById(commentId);
    if (!comment) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Comment not found.',
      );
    }
    return comment;
  }

  /**
   * Require a published release from an artist who is not suspended.
   */
  private async requireOpenRelease(releaseId: string): Promise<void> {
    const release = await this.db.releases.getById(releaseId);
    const artist = release && (await this.db.artists.getById(release.artistId));
    if (release?.status !== 'published' || !artist || artist.suspendedAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Release not found.',
      );
    }
  }

  private validComment(comment: string): string {
    const trimmed = comment.trim();
    if (!trimmed || trimmed.length > COMMENT_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Comments are 1 to ${COMMENT_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }
}
