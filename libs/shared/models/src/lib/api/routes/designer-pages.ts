import { z } from 'zod';

const designerPageTrackSchema = z.object({
  position: z.number().int(),
  title: z.string(),
  durationMs: z.number().int().nullable(),
});

const designerPagePriceSchema = z.object({
  mode: z.enum(['free', 'fixed', 'name_your_price']),
  currency: z.string().nullable(),
  minimumPrice: z.number().int().nullable(),
  suggestedPrice: z.number().int().nullable(),
});

const designerPageReleaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  tracks: z.array(designerPageTrackSchema),
  price: designerPagePriceSchema,
});

/** Mirrors DesignerPageRenderResponse, which stays the source of truth. */
export const designerPageRenderResponseSchema = z.object({
  bundleUrl: z.string(),
  payload: z.object({
    release: designerPageReleaseSchema,
    customization: z.record(z.string(), z.string()),
  }),
});
