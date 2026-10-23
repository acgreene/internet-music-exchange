import {
  type AckResponse,
  ApiRoute,
  type CommentPage,
  type Supporters,
  type FollowedArtist,
  type Follower,
  type PageQuery,
  type PostedComment,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Following artists, and comments on releases.
 */
export class CommunityClient {
  constructor(private readonly transport: ApiTransport) {}

  public follow(artistId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.ArtistFollow, { params: { artistId } });
  }

  public unfollow(artistId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ArtistFollow, {
      params: { artistId },
    });
  }

  /**
   * The artists the signed-in user follows, most recently followed first.
   */
  public listFollowing(page?: PageQuery): Promise<ApiResult<FollowedArtist[]>> {
    return this.transport.get(ApiRoute.MyFollowing, { query: page });
  }

  /**
   * Which of these artists the signed-in user follows, so a page can show
   * every follow button at once.
   */
  public async filterFollowed(
    artistIds: string[],
  ): Promise<ApiResult<string[]>> {
    const result = await this.transport.post(ApiRoute.MyFollowingFilter, {
      body: { artistIds },
    });
    return result.ok ? { ok: true, data: result.data.artistIds } : result;
  }

  /**
   * Who follows an artist, for its managers.
   */
  public listFollowers(
    artistId: string,
    page?: PageQuery,
  ): Promise<ApiResult<Follower[]>> {
    return this.transport.get(ApiRoute.ArtistFollowers, {
      params: { artistId },
      query: page,
    });
  }

  public removeFollower(
    artistId: string,
    userId: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ArtistFollower, {
      params: { artistId, userId },
    });
  }

  /**
   * A release's comments, newest first.
   */
  public listComments(
    releaseId: string,
    page?: PageQuery,
  ): Promise<ApiResult<CommentPage>> {
    return this.transport.get(ApiRoute.CatalogComments, {
      params: { releaseId },
      query: page,
    });
  }

  public listSupporters(releaseId: string): Promise<ApiResult<Supporters>> {
    return this.transport.get(ApiRoute.CatalogSupporters, {
      params: { releaseId },
    });
  }

  public addComment(
    releaseId: string,
    comment: string,
  ): Promise<ApiResult<PostedComment>> {
    return this.transport.post(ApiRoute.ReleaseComments, {
      params: { releaseId },
      body: { comment },
    });
  }

  public editComment(
    commentId: string,
    comment: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.patch(ApiRoute.Comment, {
      params: { commentId },
      body: { comment },
    });
  }

  public deleteComment(commentId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.Comment, { params: { commentId } });
  }
}
