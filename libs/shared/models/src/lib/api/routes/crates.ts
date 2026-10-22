import * as z from 'zod';
import type { RouteContracts } from '../contract';
import { ackSchema, pageQuerySchema, timestampSchema } from '../general';
import { HttpMethod } from '../http-method';
import { releaseCardWithArtistSchema } from './catalog';
import { pricingSchema } from './releases';
import { ApiRoute } from './routes';

export const crateVisibilitySchema = z.enum(['private', 'public']);

export type CrateVisibility = z.infer<typeof crateVisibilitySchema>;

/**
 * A crate as lists show it, with a mosaic of its first covers.
 */
export const crateCardSchema = z.object({
  id: z.guid(),
  name: z.string(),
  note: z.string().nullable(),
  visibility: crateVisibilitySchema,
  makerUsername: z.string().nullable(),
  itemCount: z.number().int(),
  coverUrls: z.array(z.string()),
  updatedAt: timestampSchema,
});

export type CrateCard = z.infer<typeof crateCardSchema>;

/**
 * Who made a crate, and whether they make music or designs on IME too.
 */
export const crateMakerSchema = z.object({
  id: z.guid(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  /** Artists the maker manages. Empty for a listener. */
  artists: z.array(z.object({ name: z.string(), handle: z.string() })),
  /** The maker publishes designs. */
  designer: z.boolean(),
  followers: z.number().int(),
});

export type CrateMaker = z.infer<typeof crateMakerSchema>;

/**
 * A release in a crate, with the maker's line about why it is there.
 */
export const crateItemSchema = z.object({
  release: releaseCardWithArtistSchema,
  pricing: pricingSchema.nullable(),
  note: z.string().nullable(),
  /** False when it left the catalog. Only the maker sees those. */
  available: z.boolean(),
});

export type CrateItem = z.infer<typeof crateItemSchema>;

/**
 * A crate's page.
 */
export const cratePageSchema = z.object({
  crate: crateCardSchema,
  maker: crateMakerSchema,
  items: z.array(crateItemSchema),
  /** The viewer made it and may change it. */
  isMine: z.boolean(),
  followingMaker: z.boolean(),
});

export type CratePage = z.infer<typeof cratePageSchema>;

/**
 * One of the viewer's own crates, and whether it holds a given release.
 */
export const myCrateSchema = crateCardSchema.extend({
  holdsRelease: z.boolean(),
});

export type MyCrate = z.infer<typeof myCrateSchema>;

/**
 * A crate IME put together, by sound, from records someone loves, or from
 * their library for the day. It can be saved as one of their own.
 */
export const builtCrateSchema = z.object({
  name: z.string(),
  /** How IME chose what is in it. */
  reason: z.string(),
  items: z.array(crateItemSchema),
});

export type BuiltCrate = z.infer<typeof builtCrateSchema>;

export const createCrateRequestSchema = z.object({
  name: z.string(),
  note: z.string().nullable().optional(),
  visibility: crateVisibilitySchema.optional(),
  /** Releases to start it with, such as from a crate IME built. */
  releaseIds: z.array(z.guid()).max(200).optional(),
});

export type CreateCrateRequest = z.infer<typeof createCrateRequestSchema>;

export const updateCrateRequestSchema = z.object({
  name: z.string().optional(),
  note: z.string().nullable().optional(),
  visibility: crateVisibilitySchema.optional(),
});

export type UpdateCrateRequest = z.infer<typeof updateCrateRequestSchema>;

export const addCrateReleaseRequestSchema = z.object({
  releaseId: z.guid(),
  note: z.string().nullable().optional(),
});

export const crateReleaseNoteRequestSchema = z.object({
  note: z.string().nullable(),
});

export const reorderCrateRequestSchema = z.object({
  releaseIds: z.array(z.guid()).max(200),
});

export const myCratesQuerySchema = z.object({ releaseId: z.guid().optional() });

export const crateBySoundQuerySchema = z.object({
  genre: z.string().optional(),
  tag: z.string().optional(),
});

export const crateFromRecordsRequestSchema = z.object({
  releaseIds: z.array(z.guid()).min(1).max(5),
});

export const crateContracts = {
  [ApiRoute.Crates]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema.extend({ q: z.string().optional() }),
      response: z.array(crateCardSchema),
    },
    [HttpMethod.Post]: {
      request: createCrateRequestSchema,
      response: crateCardSchema,
    },
  },
  [ApiRoute.MyCrates]: {
    [HttpMethod.Get]: {
      query: myCratesQuerySchema,
      response: z.array(myCrateSchema),
    },
  },
  [ApiRoute.Crate]: {
    [HttpMethod.Get]: { response: cratePageSchema },
    [HttpMethod.Patch]: {
      request: updateCrateRequestSchema,
      response: crateCardSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.CrateReleases]: {
    [HttpMethod.Post]: {
      request: addCrateReleaseRequestSchema,
      response: ackSchema,
    },
    [HttpMethod.Put]: {
      request: reorderCrateRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.CrateRelease]: {
    [HttpMethod.Patch]: {
      request: crateReleaseNoteRequestSchema,
      response: ackSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.CrateBySound]: {
    [HttpMethod.Get]: {
      query: crateBySoundQuerySchema,
      response: builtCrateSchema,
    },
  },
  [ApiRoute.CrateFromRecords]: {
    [HttpMethod.Post]: {
      request: crateFromRecordsRequestSchema,
      response: builtCrateSchema,
    },
  },
  [ApiRoute.CrateOfTheDay]: {
    [HttpMethod.Get]: { response: builtCrateSchema.nullable() },
  },
  [ApiRoute.FollowedCrates]: {
    [HttpMethod.Get]: { response: z.array(crateCardSchema) },
  },
  [ApiRoute.UserCrates]: {
    [HttpMethod.Get]: { response: z.array(crateCardSchema) },
  },
  [ApiRoute.UserFollow]: {
    [HttpMethod.Put]: { response: ackSchema },
    [HttpMethod.Delete]: { response: ackSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
