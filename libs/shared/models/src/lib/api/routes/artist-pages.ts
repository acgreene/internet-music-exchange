import { z } from 'zod';

const artistPageTrackSchema = z.object({
  position: z.number().int(),
  title: z.string(),
  durationMs: z.number().int().nullable(),
});

const artistPagePriceSchema = z.object({
  mode: z.enum(['free', 'fixed', 'name_your_price']),
  currency: z.string().nullable(),
  minimumPrice: z.number().int().nullable(),
  suggestedPrice: z.number().int().nullable(),
});

const artistPageReleaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  tracks: z.array(artistPageTrackSchema),
  price: artistPagePriceSchema,
});

export const artistPageRenderResponseSchema = z.object({
  bundleUrl: z.string(),
  payload: z.object({
    release: artistPageReleaseSchema,
    customization: z.record(z.string(), z.string()),
  }),
});
