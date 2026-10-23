import * as z from 'zod';
import type { RouteContracts } from '../contract';
import { HttpMethod } from '../http-method';
import { releaseCardWithArtistSchema } from './catalog';
import { currencySchema, pricingSchema, tracklistItemSchema } from './releases';
import { ApiRoute } from './routes';

/** A dig goes through the whole crate unless told to stop sooner. */
export const digQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(200).optional(),
});

export const digSoundQuerySchema = digQuerySchema.extend({
  genre: z.string().optional(),
  tag: z.string().optional(),
});

/**
 * A physical edition of a record, as its cheapest variant in stock, ready to
 * go in a cart.
 */
export const digEditionSchema = z.object({
  productId: z.guid(),
  productName: z.string(),
  format: z.enum(['vinyl', 'cassette', 'cd']),
  currency: currencySchema,
  variantId: z.guid(),
  variantLabel: z.string().nullable(),
  price: z.number().int(),
  stock: z.number().int(),
});

export type DigEdition = z.infer<typeof digEditionSchema>;

/**
 * One record in a dig: what it is, why it is in the crate, its whole
 * tracklist, and which tracks the listener may hear.
 */
export const digRecordSchema = z.object({
  release: releaseCardWithArtistSchema,
  pricing: pricingSchema.nullable(),
  note: z.string().nullable(),
  /** Every track; previews are the ones the artist shares with anyone. */
  tracks: z.array(tracklistItemSchema),
  /** The listener owns it, so every track plays. */
  owned: z.boolean(),
  /** It has a designed page to dig through. */
  designed: z.boolean(),
  editions: z.array(digEditionSchema),
});

export type DigRecord = z.infer<typeof digRecordSchema>;

/**
 * A dig: a crate's records, as many as the listener chose to go through.
 */
export const digSessionSchema = z.object({
  name: z.string(),
  reason: z.string().nullable(),
  /** The crate dug, when it is one someone made. */
  crateId: z.guid().nullable(),
  /** How many records the crate holds, however deep this dig goes. */
  available: z.number().int(),
  records: z.array(digRecordSchema),
});

export type DigSession = z.infer<typeof digSessionSchema>;

export const digContracts = {
  [ApiRoute.DigCrate]: {
    [HttpMethod.Get]: { query: digQuerySchema, response: digSessionSchema },
  },
  [ApiRoute.DigSound]: {
    [HttpMethod.Get]: {
      query: digSoundQuerySchema,
      response: digSessionSchema,
    },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
