import * as z from 'zod';
import type { RouteContracts } from '../contract';
import { pageQuerySchema, signedUrlSchema, timestampSchema } from '../general';
import { HttpMethod } from '../http-method';
import { artistSchema } from './artists';
import { productTypeSchema } from './merch';
import {
  currencySchema,
  pricingSchema,
  releaseAssetKindSchema,
  releaseKindSchema,
  releaseSchema,
  tracklistItemSchema,
} from './releases';
import {
  FORMAT_IDS,
  SEARCH_KINDS,
  SEARCH_SORTS,
  type SearchKindId,
  type SearchSort,
} from '../../music';
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

/**
 * One thing on a shelf: a release with its price, or a product priced from
 * its cheapest variant in stock.
 */
export const shelfItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('release'),
    release: releaseCardWithArtistSchema,
    pricing: pricingSchema.nullable(),
  }),
  z.object({
    kind: z.literal('product'),
    id: z.guid(),
    name: z.string(),
    productType: productTypeSchema,
    artistName: z.string(),
    artistHandle: z.string(),
    imageUrl: z.string().nullable(),
    currency: currencySchema,
    price: z.number().int(),
  }),
]);

export type ShelfItem = z.infer<typeof shelfItemSchema>;

/**
 * A row of records on the home page, with why it is there.
 */
export const shelfSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Why the shelf exists, as the listener reads it. */
  reason: z.string(),
  /** Where the whole shelf lives, such as the crate it comes from. */
  link: z.string().optional(),
  items: z.array(shelfItemSchema),
});

export type Shelf = z.infer<typeof shelfSchema>;

/**
 * The home page: today's shelves, a few designed releases, and how much of
 * each format is on offer.
 */
export const catalogHomeSchema = z.object({
  shelves: z.array(shelfSchema),
  /** A few releases with designed pages, to show what they are. */
  designed: z.array(shelfItemSchema),
  formats: z.object({
    releases: z.number().int(),
    products: z.array(
      z.object({ type: productTypeSchema, count: z.number().int() }),
    ),
  }),
});

export type CatalogHome = z.infer<typeof catalogHomeSchema>;

/**
 * A search of the catalog. `genres` is a comma-separated list; `under` is a
 * price ceiling in cents, exclusive; `year` is a year or a decade like
 * "1990s".
 */
export const catalogSearchQuerySchema = pageQuerySchema.extend({
  q: z.string().optional(),
  genres: z.string().optional(),
  format: z.enum(FORMAT_IDS).optional(),
  under: z.coerce.number().int().min(1).optional(),
  year: z
    .string()
    .regex(/^(19|20)\d(\d|0s)$/)
    .optional(),
  kind: z
    .enum(SEARCH_KINDS.map((kind) => kind.id) as [SearchKindId])
    .optional(),
  designed: z.literal('1').optional(),
  /** Where the artist is based: a two-letter country code, and a city in it. */
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  city: z.string().max(80).optional(),
  sort: z.enum(SEARCH_SORTS.map((sort) => sort.id) as [SearchSort]).optional(),
});

export type CatalogSearchQuery = z.infer<typeof catalogSearchQuerySchema>;

const facetCountSchema = <T extends z.ZodType>(value: T) =>
  z.object({ value, count: z.number().int() });

/**
 * A place artists are based: a country, and a city in it when they gave one.
 */
export const placeCountSchema = z.object({
  country: z.string(),
  city: z.string().nullable(),
  count: z.number().int(),
});

export type PlaceCount = z.infer<typeof placeCountSchema>;

/**
 * A release a search found, with every format it can be bought in.
 */
export const searchReleaseSchema = z.object({
  release: releaseCardWithArtistSchema,
  pricing: pricingSchema.nullable(),
  editions: z.array(
    z.object({
      productId: z.guid(),
      format: z.enum(['vinyl', 'cassette', 'cd']),
      currency: currencySchema,
      price: z.number().int(),
    }),
  ),
});

export type SearchRelease = z.infer<typeof searchReleaseSchema>;

/**
 * What a search finds, and how many releases each filter value would leave.
 */
export const searchResultsSchema = z.object({
  releases: z.array(searchReleaseSchema),
  /** How many releases match in all. */
  total: z.number().int(),
  artists: z.array(artistSchema),
  /** Merch that is not a record. */
  merch: z.array(shelfItemSchema),
  facets: z.object({
    genres: z.array(facetCountSchema(z.string())),
    formats: z.array(facetCountSchema(z.enum(FORMAT_IDS))),
    prices: z.array(facetCountSchema(z.number().int())),
    years: z.array(facetCountSchema(z.number().int())),
    kinds: z.array(facetCountSchema(releaseKindSchema)),
    designed: z.number().int(),
    /** Releases from each place artists are based, city by city. */
    places: z.array(placeCountSchema),
  }),
});

export type SearchResults = z.infer<typeof searchResultsSchema>;

/**
 * Quick suggestions while someone types in the search box.
 */
export const searchSuggestionsSchema = z.object({
  artists: z.array(z.object({ name: z.string(), handle: z.string() })),
  releases: z.array(
    z.object({
      title: z.string(),
      slug: z.string(),
      artistName: z.string(),
      artistHandle: z.string(),
      coverUrl: z.string().nullable(),
    }),
  ),
  tags: z.array(facetCountSchema(z.string())),
});

export type SearchSuggestions = z.infer<typeof searchSuggestionsSchema>;

export const catalogContracts = {
  [ApiRoute.CatalogHome]: {
    [HttpMethod.Get]: { response: catalogHomeSchema },
  },
  [ApiRoute.CatalogReleases]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema,
      response: z.array(releaseCardWithArtistSchema),
    },
  },
  [ApiRoute.CatalogSearch]: {
    [HttpMethod.Get]: {
      query: catalogSearchQuerySchema,
      response: searchResultsSchema,
    },
  },
  [ApiRoute.CatalogPlaces]: {
    [HttpMethod.Get]: { response: z.array(placeCountSchema) },
  },
  [ApiRoute.CatalogSuggest]: {
    [HttpMethod.Get]: {
      query: searchQuerySchema,
      response: searchSuggestionsSchema,
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
