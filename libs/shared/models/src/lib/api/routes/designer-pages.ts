import { z } from 'zod';

/**
 * One entry of the tracklist a design renders.
 */
export const designerPageTrackSchema = z.object({
  position: z.number().int(),
  title: z.string(),
  durationMs: z.number().int().nullable(),
});

/**
 * How the release is priced, flattened for display.
 */
export const designerPagePriceSchema = z.object({
  mode: z.enum(['free', 'fixed', 'name_your_price']),
  currency: z.string().nullable(),
  minimumPrice: z.number().int().nullable(),
  suggestedPrice: z.number().int().nullable(),
});

/**
 * The release data injected into a design.
 */
export const designerPageReleaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  tracks: z.array(designerPageTrackSchema),
  price: designerPagePriceSchema,
});

/**
 * What the API returns for rendering a release as a designer page: where to
 * load the untrusted bundle from, and the data to inject into it.
 */
export const designerPageRenderResponseSchema = z.object({
  bundleUrl: z.string(),
  payload: z.object({
    release: designerPageReleaseSchema,
    customization: z.record(z.string(), z.string()),
  }),
});
