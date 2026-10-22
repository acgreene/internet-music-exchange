import * as z from 'zod';
import type { RouteContracts } from '../contract';
import { ackSchema, pageQuerySchema, timestampSchema } from '../general';
import { HttpMethod } from '../http-method';
import { ApiRoute } from './routes';

export const followedArtistSchema = z.object({
  artistId: z.guid(),
  name: z.string(),
  handle: z.string(),
  followedAt: timestampSchema,
});

export type FollowedArtist = z.infer<typeof followedArtistSchema>;

export const followerSchema = z.object({
  userId: z.guid(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  followedAt: timestampSchema,
});

export type Follower = z.infer<typeof followerSchema>;

/**
 * Asks which of the artists on a page the signed-in user follows.
 */
export const filterFollowedRequestSchema = z.object({
  artistIds: z.array(z.guid()).max(100),
});

export const followedArtistIdsSchema = z.object({
  artistIds: z.array(z.guid()),
});

/**
 * A comment as a release lists it, with its author.
 */
export const commentSchema = z.object({
  id: z.guid(),
  userId: z.guid(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  comment: z.string(),
  /** Changed since it was first posted. */
  edited: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type CommentResponse = z.infer<typeof commentSchema>;

export const commentPageSchema = z.object({
  comments: z.array(commentSchema),
  /** How many comments the release has in all. */
  total: z.number().int(),
});

export type CommentPage = z.infer<typeof commentPageSchema>;

/**
 * A comment just posted.
 */
export const postedCommentSchema = z.object({
  id: z.guid(),
  releaseId: z.guid(),
  userId: z.guid(),
  comment: z.string(),
  createdAt: timestampSchema,
});

export type PostedComment = z.infer<typeof postedCommentSchema>;

export const commentRequestSchema = z.object({ comment: z.string() });

export const communityContracts = {
  [ApiRoute.ArtistFollow]: {
    [HttpMethod.Put]: { response: ackSchema },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.MyFollowing]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema,
      response: z.array(followedArtistSchema),
    },
  },
  [ApiRoute.MyFollowingFilter]: {
    [HttpMethod.Post]: {
      request: filterFollowedRequestSchema,
      response: followedArtistIdsSchema,
    },
  },
  [ApiRoute.ArtistFollowers]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema,
      response: z.array(followerSchema),
    },
  },
  [ApiRoute.ArtistFollower]: {
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.CatalogComments]: {
    [HttpMethod.Get]: { query: pageQuerySchema, response: commentPageSchema },
  },
  [ApiRoute.ReleaseComments]: {
    [HttpMethod.Post]: {
      request: commentRequestSchema,
      response: postedCommentSchema,
    },
  },
  [ApiRoute.Comment]: {
    [HttpMethod.Patch]: { request: commentRequestSchema, response: ackSchema },
    [HttpMethod.Delete]: { response: ackSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
