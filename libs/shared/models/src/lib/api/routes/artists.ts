import * as z from 'zod';
import type { RouteContracts } from '../contract';
import {
  ackSchema,
  confirmUploadRequestSchema,
  signedUrlSchema,
  timestampSchema,
  uploadRequestSchema,
  uploadTargetSchema,
} from '../general';
import { HttpMethod } from '../http-method';
import { ApiRoute } from './routes';

/**
 * Which of an artist's two profile images.
 */
export const artistImageKindSchema = z.enum(['avatar', 'header']);

export type ArtistImageKind = z.infer<typeof artistImageKindSchema>;

export const artistSchema = z.object({
  id: z.guid(),
  name: z.string(),
  handle: z.string(),
  bio: z.string().nullable(),
  createdAt: timestampSchema,
  /** Set when an admin suspended the artist. */
  suspendedAt: timestampSchema.nullable(),
  /** Set while the artist's hosting is unpaid and nothing is for sale. */
  offSaleAt: timestampSchema.nullable(),
});

export type ArtistResponse = z.infer<typeof artistSchema>;

export const artistLinkSchema = z.object({
  id: z.guid(),
  label: z.string(),
  url: z.string(),
  position: z.number().int(),
});

export type ArtistLinkResponse = z.infer<typeof artistLinkSchema>;

/**
 * An artist's public profile, `/artists/<handle>`.
 */
export const artistProfileSchema = z.object({
  artist: artistSchema,
  avatarUrl: z.string().nullable(),
  headerUrl: z.string().nullable(),
  links: z.array(artistLinkSchema),
  followerCount: z.number().int(),
});

export type ArtistProfileResponse = z.infer<typeof artistProfileSchema>;

export const artistManagerSchema = z.object({
  userId: z.guid(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  createdAt: timestampSchema,
});

export type ArtistManagerResponse = z.infer<typeof artistManagerSchema>;

export const createArtistRequestSchema = z.object({
  name: z.string(),
  /** Made from the name when left out. */
  handle: z.string().optional(),
  bio: z.string().nullable().optional(),
});

export type CreateArtistRequest = z.infer<typeof createArtistRequestSchema>;

export const updateArtistRequestSchema = z.object({
  name: z.string().optional(),
  handle: z.string().optional(),
  bio: z.string().nullable().optional(),
});

export type UpdateArtistRequest = z.infer<typeof updateArtistRequestSchema>;

export const setLinksRequestSchema = z.object({
  links: z.array(z.object({ label: z.string(), url: z.string() })),
});

export type SetLinksRequest = z.infer<typeof setLinksRequestSchema>;

export const addManagerRequestSchema = z.object({ username: z.string() });

export type AddManagerRequest = z.infer<typeof addManagerRequestSchema>;

export const artistContracts = {
  [ApiRoute.Artists]: {
    [HttpMethod.Post]: {
      request: createArtistRequestSchema,
      response: artistSchema,
    },
  },
  [ApiRoute.MyArtists]: {
    [HttpMethod.Get]: { response: z.array(artistSchema) },
  },
  [ApiRoute.Artist]: {
    [HttpMethod.Patch]: {
      request: updateArtistRequestSchema,
      response: artistSchema,
    },
  },
  [ApiRoute.CatalogArtist]: {
    [HttpMethod.Get]: { response: artistProfileSchema },
  },
  [ApiRoute.ArtistLinks]: {
    [HttpMethod.Put]: {
      request: setLinksRequestSchema,
      response: z.array(artistLinkSchema),
    },
  },
  [ApiRoute.ArtistImageUploads]: {
    [HttpMethod.Post]: {
      request: uploadRequestSchema,
      response: uploadTargetSchema,
    },
  },
  [ApiRoute.ArtistImage]: {
    [HttpMethod.Put]: {
      request: confirmUploadRequestSchema,
      response: signedUrlSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.ArtistManagers]: {
    [HttpMethod.Get]: { response: z.array(artistManagerSchema) },
    [HttpMethod.Post]: {
      request: addManagerRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.ArtistManager]: {
    [HttpMethod.Delete]: { response: ackSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
