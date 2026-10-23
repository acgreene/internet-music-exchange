import { ApiRoute, HttpMethod } from '@ime/models';
import type { CommentService, FollowService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Following artists, and comments on releases.
 */
export class CommunityRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly follows: FollowService,
    private readonly comments: CommentService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(
      HttpMethod.Put,
      ApiRoute.ArtistFollow,
      'user',
      ({ userId, params }) => this.follows.follow(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ArtistFollow,
      'user',
      ({ userId, params }) => this.follows.unfollow(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.MyFollowing,
      'user',
      ({ userId, query }) =>
        this.follows.listFollowing(userId, query.limit, query.offset),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.MyFollowingFilter,
      'user',
      async ({ userId, body }) => ({
        artistIds: await this.follows.filterFollowed(userId, body.artistIds),
      }),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistFollowers,
      'user',
      ({ userId, params, query }) =>
        this.follows.listFollowers(
          userId,
          params.artistId,
          query.limit,
          query.offset,
        ),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ArtistFollower,
      'user',
      ({ userId, params }) =>
        this.follows.removeFollower(userId, params.artistId, params.userId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogComments,
      'public',
      ({ params, query }) =>
        this.comments.listComments(params.releaseId, query.limit, query.offset),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogSupporters,
      'public',
      ({ params }) => this.comments.listSupporters(params.releaseId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseComments,
      'user',
      ({ userId, params, body }) =>
        this.comments.addComment(userId, params.releaseId, body.comment),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.Comment,
      'user',
      ({ userId, params, body }) =>
        this.comments.editComment(userId, params.commentId, body.comment),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.Comment,
      'user',
      ({ userId, params }) =>
        this.comments.deleteComment(userId, params.commentId),
    );
  }
}
