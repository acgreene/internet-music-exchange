import * as z from 'zod';
import type { RouteContracts } from '../contract';
import {
  ackSchema,
  confirmUploadRequestSchema,
  timestampSchema,
  uploadRequestSchema,
  uploadTargetSchema,
} from '../general';
import { HttpMethod } from '../http-method';
import { reportReasonSchema } from './moderation';
import { ApiRoute } from './routes';

export const currencySchema = z.enum(['usd', 'eur']);

export type Currency = z.infer<typeof currencySchema>;

export const releaseKindSchema = z.enum([
  'single',
  'ep',
  'lp',
  'album',
  'compilation',
  'remaster',
  'soundtrack',
  'score',
  'demo',
  'other',
]);

export type ReleaseKind = z.infer<typeof releaseKindSchema>;

export const releaseStatusSchema = z.enum([
  'draft',
  'published',
  'archived',
  'taken_down',
]);

export const pricingModeSchema = z.enum(['free', 'fixed', 'name_your_price']);

export type PricingMode = z.infer<typeof pricingModeSchema>;

export const releaseAssetKindSchema = z.enum([
  'cover',
  'back_cover',
  'liner_notes',
  'photo',
  'video',
  'audio',
  'document',
  'other',
]);

export type ReleaseAssetKind = z.infer<typeof releaseAssetKindSchema>;

export const releaseSchema = z.object({
  id: z.guid(),
  artistId: z.guid(),
  title: z.string(),
  slug: z.string(),
  kind: releaseKindSchema,
  status: releaseStatusSchema,
  /** The release date the artist gave, `YYYY-MM-DD`. */
  releasedAt: z.string().nullable(),
  publishedAt: timestampSchema.nullable(),
  /** Set once a takedown can no longer be contested. */
  takedownFinalAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type ReleaseResponse = z.infer<typeof releaseSchema>;

/**
 * A track as a release lists it.
 */
export const tracklistItemSchema = z.object({
  trackId: z.guid(),
  position: z.number().int(),
  title: z.string(),
  durationMs: z.number().int().nullable(),
  /** Anyone can stream it while the release is on sale. */
  isPreview: z.boolean(),
});

export type TracklistItem = z.infer<typeof tracklistItemSchema>;

export const trackSchema = z.object({
  id: z.guid(),
  artistId: z.guid(),
  title: z.string(),
  durationMs: z.number().int().nullable(),
  createdAt: timestampSchema,
});

export type TrackResponse = z.infer<typeof trackSchema>;

/**
 * A track's uploaded audio, as its managers see it.
 */
export const audioFileSchema = z.object({
  audioFileId: z.guid(),
  trackId: z.guid(),
  trackTitle: z.string(),
  position: z.number().int(),
  variant: z.enum(['original', 'stream']),
  format: z.enum(['flac', 'wav', 'aiff', 'alac', 'aac', 'mp3', 'opus']),
  byteSize: z.number().int(),
});

export type AudioFileResponse = z.infer<typeof audioFileSchema>;

export const pricingSchema = z.object({
  mode: pricingModeSchema,
  /** Null for a free release. */
  currency: currencySchema.nullable(),
  minimumPrice: z.number().int(),
  suggestedPrice: z.number().int().nullable(),
});

export type PricingResponse = z.infer<typeof pricingSchema>;

/**
 * A release asset, as its managers see it.
 */
export const releaseAssetSchema = z.object({
  id: z.guid(),
  releaseId: z.guid(),
  kind: releaseAssetKindSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  mimeType: z.string(),
  byteSize: z.number().int(),
  /** Only owners can open it. Covers are always public. */
  requiresPurchase: z.boolean(),
  position: z.number().int(),
  createdAt: timestampSchema,
});

export type ReleaseAssetResponse = z.infer<typeof releaseAssetSchema>;

/**
 * Everything a manager edits on a release.
 */
/**
 * Why a release was taken down, as its managers see it.
 */
export const releaseTakedownSchema = z.object({
  reason: reportReasonSchema,
  note: z.string().nullable(),
  takenDownAt: timestampSchema,
  /** The last day to contest a copyright takedown, while it can be. */
  contestBy: timestampSchema.nullable(),
  /** The managers' contest waiting on an admin. */
  contestPending: z.boolean(),
});

export type ReleaseTakedown = z.infer<typeof releaseTakedownSchema>;

export const managedReleaseSchema = z.object({
  release: releaseSchema,
  /** Set while the release is taken down. */
  takedown: releaseTakedownSchema.nullable(),
  tracks: z.array(tracklistItemSchema),
  originals: z.array(audioFileSchema),
  streamCopies: z.array(audioFileSchema),
  pricing: pricingSchema.nullable(),
  assets: z.array(releaseAssetSchema),
});

export type ManagedReleaseResponse = z.infer<typeof managedReleaseSchema>;

export const createReleaseRequestSchema = z.object({
  title: z.string(),
  kind: releaseKindSchema,
  releasedAt: z.iso.date().nullable().optional(),
});

export type CreateReleaseRequest = z.infer<typeof createReleaseRequestSchema>;

export const updateReleaseRequestSchema = z.object({
  title: z.string().optional(),
  kind: releaseKindSchema.optional(),
  releasedAt: z.iso.date().nullable().optional(),
  slug: z.string().optional(),
});

export type UpdateReleaseRequest = z.infer<typeof updateReleaseRequestSchema>;

export const setPricingRequestSchema = z.object({
  mode: pricingModeSchema,
  minimumPrice: z.number().int().optional(),
  suggestedPrice: z.number().int().nullable().optional(),
});

export type SetPricingRequest = z.infer<typeof setPricingRequestSchema>;

export const trackRequestSchema = z.object({
  title: z.string(),
  durationMs: z.number().int().nullable().optional(),
});

export type TrackRequest = z.infer<typeof trackRequestSchema>;

export const trackChangesRequestSchema = trackRequestSchema.partial();

export type TrackChangesRequest = z.infer<typeof trackChangesRequestSchema>;

export const reorderTracksRequestSchema = z.object({
  trackIds: z.array(z.guid()),
});

export const trackPreviewRequestSchema = z.object({ isPreview: z.boolean() });

export const confirmAudioRequestSchema = confirmUploadRequestSchema.extend({
  durationMs: z.number().int().nullable().optional(),
});

export type ConfirmAudioRequest = z.infer<typeof confirmAudioRequestSchema>;

export const assetUploadRequestSchema = uploadRequestSchema.extend({
  kind: releaseAssetKindSchema,
});

export const confirmAssetRequestSchema = confirmUploadRequestSchema.extend({
  kind: releaseAssetKindSchema,
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  requiresPurchase: z.boolean().optional(),
});

export type ConfirmAssetRequest = z.infer<typeof confirmAssetRequestSchema>;

export const assetChangesRequestSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  requiresPurchase: z.boolean().optional(),
  position: z.number().int().optional(),
});

export type AssetChangesRequest = z.infer<typeof assetChangesRequestSchema>;

export const giftRequestSchema = z.object({ username: z.string() });

export const releaseContracts = {
  [ApiRoute.ArtistReleases]: {
    [HttpMethod.Post]: {
      request: createReleaseRequestSchema,
      response: releaseSchema,
    },
    [HttpMethod.Get]: { response: z.array(releaseSchema) },
  },
  [ApiRoute.Release]: {
    [HttpMethod.Get]: { response: managedReleaseSchema },
    [HttpMethod.Patch]: {
      request: updateReleaseRequestSchema,
      response: releaseSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.ReleasePricing]: {
    [HttpMethod.Put]: {
      request: setPricingRequestSchema,
      response: pricingSchema,
    },
  },
  [ApiRoute.ReleasePublish]: {
    [HttpMethod.Post]: { response: releaseSchema },
  },
  [ApiRoute.ReleaseArchive]: {
    [HttpMethod.Post]: { response: releaseSchema },
  },
  [ApiRoute.ReleaseTracks]: {
    [HttpMethod.Post]: { request: trackRequestSchema, response: trackSchema },
    [HttpMethod.Put]: {
      request: reorderTracksRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.Track]: {
    [HttpMethod.Patch]: {
      request: trackChangesRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.ReleaseTrack]: {
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.ReleaseTrackPreview]: {
    [HttpMethod.Put]: {
      request: trackPreviewRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.TrackAudioUploads]: {
    [HttpMethod.Post]: {
      request: uploadRequestSchema,
      response: uploadTargetSchema,
    },
  },
  [ApiRoute.TrackAudio]: {
    [HttpMethod.Put]: {
      request: confirmAudioRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.ReleaseAssetUploads]: {
    [HttpMethod.Post]: {
      request: assetUploadRequestSchema,
      response: uploadTargetSchema,
    },
  },
  [ApiRoute.ReleaseAssets]: {
    [HttpMethod.Post]: {
      request: confirmAssetRequestSchema,
      response: releaseAssetSchema,
    },
  },
  [ApiRoute.ReleaseAsset]: {
    [HttpMethod.Patch]: {
      request: assetChangesRequestSchema,
      response: ackSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.ReleaseGifts]: {
    [HttpMethod.Post]: { request: giftRequestSchema, response: ackSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
