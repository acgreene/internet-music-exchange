import type { RouteContracts } from '../contract';
import { HttpMethod } from '../http-method';
import { ApiRoute } from './routes';
import * as z from 'zod';

const artistPageTrackSchema = z.object({
  position: z.number().int(),
  title: z.string(),
  durationMs: z.number().int().nullable(),
  lyrics: z.string().nullable(),
  preview: z.boolean(),
});

const artistPagePriceSchema = z.object({
  mode: z.enum(['free', 'fixed', 'name_your_price']),
  currency: z.string().nullable(),
  minimumPrice: z.number().int().nullable(),
  suggestedPrice: z.number().int().nullable(),
});

const artistPageArtistSchema = z.object({
  name: z.string(),
  handle: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  headerUrl: z.string().nullable(),
});

const artistPageAssetSchema = z.object({
  kind: z.enum([
    'back_cover',
    'liner_notes',
    'photo',
    'video',
    'audio',
    'document',
    'other',
  ]),
  title: z.string().nullable(),
  description: z.string().nullable(),
  url: z.string(),
  mimeType: z.string(),
});

const artistPageEditionSchema = z.object({
  format: z.enum(['vinyl', 'cassette', 'cd']),
  name: z.string(),
  price: z.number().int(),
  currency: z.string(),
  inStock: z.boolean(),
});

const artistPageReleaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  artist: artistPageArtistSchema,
  kind: z.string(),
  releasedAt: z.string().nullable(),
  description: z.string().nullable(),
  credits: z.string().nullable(),
  genres: z.array(z.string()),
  tags: z.array(z.string()),
  coverUrl: z.string().nullable(),
  tracks: z.array(artistPageTrackSchema),
  sideStarts: z.array(z.number().int()),
  assets: z.array(artistPageAssetSchema),
  editions: z.array(artistPageEditionSchema),
  price: artistPagePriceSchema,
});

export const artistPageRenderResponseSchema = z.object({
  bundleUrl: z.string().nullable(),
  payload: z.object({
    release: artistPageReleaseSchema,
    customization: z.record(z.string(), z.string()),
  }),
});

export const artistPageContracts = {
  [ApiRoute.ArtistReleasePage]: {
    [HttpMethod.Get]: { response: artistPageRenderResponseSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
