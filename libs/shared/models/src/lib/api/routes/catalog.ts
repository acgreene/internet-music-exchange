import { z } from 'zod';
import type { RouteContracts } from '../contract';
import { pageQuerySchema, signedUrlSchema, timestampSchema } from '../general';
import { HttpMethod } from '../http-method';
import { artistSchema } from './artists';
import {
  pricingSchema,
  releaseAssetKindSchema,
  releaseKindSchema,
  releaseSchema,
  tracklistItemSchema,
} from './releases';
import { ApiRoute } from './routes';

/**
 * A release as a grid or list shows it, with its cover.
 */
export const releaseCardSchema = z.object({
  id: z.guid(),
  artistId: z.guid(),
  title: z.string(),
  slug: z.string(),
  kind: releaseKindSchema,
  releasedAt: z.string().nullable(),
  publishedAt: timestampSchema.nullable(),
  coverUrl: z.string().nullable(),
});

export type ReleaseCard = z.infer<typeof releaseCardSchema>;

/**
 * A release card that also names its artist, for lists that mix artists.
 */
export const releaseCardWithArtistSchema = releaseCardSchema.extend({
  artistName: z.string(),
  artistHandle: z.string(),
});

export type ReleaseCardWithArtist = z.infer<typeof releaseCardWithArtistSchema>;

/**
 * What a search finds.
 */
export const searchResultsSchema = z.object({
  artists: z.array(artistSchema),
  releases: z.array(releaseCardWithArtistSchema),
});

export type SearchResults = z.infer<typeof searchResultsSchema>;

export const searchQuerySchema = z.object({ q: z.string().min(1) });

/**
 * An asset on a release page. Every listener sees it is there; only those
 * who may open it get a URL.
 */
export const releasePageAssetSchema = z.object({
  id: z.guid(),
  kind: releaseAssetKindSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  requiresPurchase: z.boolean(),
  url: z.string().nullable(),
});

/**
 * A listener's release page, `/artists/<handle>/<slug>`.
 */
export const releasePageSchema = z.object({
  release: releaseSchema,
  artist: z.object({ id: z.guid(), name: z.string(), handle: z.string() }),
  tracks: z.array(tracklistItemSchema),
  pricing: pricingSchema.nullable(),
  coverUrl: z.string().nullable(),
  assets: z.array(releasePageAssetSchema),
  /** The viewer owns it and can stream and download everything. */
  owned: z.boolean(),
  /** It can be bought or claimed right now. */
  onSale: z.boolean(),
});

export type ReleasePageResponse = z.infer<typeof releasePageSchema>;

/**
 * A release a listener owns, newest acquisition first.
 */
export const libraryItemSchema = z.object({
  releaseId: z.guid(),
  artistId: z.guid(),
  title: z.string(),
  slug: z.string(),
  kind: releaseKindSchema,
  artistName: z.string(),
  artistHandle: z.string(),
  /** How they came to own it. */
  source: z.enum(['purchase', 'free', 'gift']),
  acquiredAt: timestampSchema,
  coverUrl: z.string().nullable(),
});

export type LibraryItem = z.infer<typeof libraryItemSchema>;

/**
 * New music from an artist the listener follows.
 */
export const feedItemSchema = z.object({
  releaseId: z.guid(),
  artistId: z.guid(),
  title: z.string(),
  slug: z.string(),
  kind: releaseKindSchema,
  artistName: z.string(),
  artistHandle: z.string(),
  publishedAt: timestampSchema.nullable(),
  coverUrl: z.string().nullable(),
});

export type FeedItem = z.infer<typeof feedItemSchema>;

export const catalogContracts = {
  [ApiRoute.CatalogReleases]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema,
      response: z.array(releaseCardWithArtistSchema),
    },
  },
  [ApiRoute.CatalogSearch]: {
    [HttpMethod.Get]: {
      query: searchQuerySchema,
      response: searchResultsSchema,
    },
  },
  [ApiRoute.CatalogDiscography]: {
    [HttpMethod.Get]: { response: z.array(releaseCardSchema) },
  },
  [ApiRoute.CatalogReleasePage]: {
    [HttpMethod.Get]: { response: releasePageSchema },
  },
  [ApiRoute.CatalogTrackStream]: {
    [HttpMethod.Get]: { response: signedUrlSchema },
  },
  [ApiRoute.CatalogTrackDownload]: {
    [HttpMethod.Get]: { response: signedUrlSchema },
  },
  [ApiRoute.CatalogAsset]: {
    [HttpMethod.Get]: { response: signedUrlSchema },
  },
  [ApiRoute.MyLibrary]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema,
      response: z.array(libraryItemSchema),
    },
  },
  [ApiRoute.MyFeed]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema,
      response: z.array(feedItemSchema),
    },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
