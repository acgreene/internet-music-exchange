import { z } from 'zod';
import type { RouteContracts } from '../contract';
import {
  ackSchema,
  confirmUploadRequestSchema,
  pageQuerySchema,
  timestampSchema,
  uploadRequestSchema,
  uploadTargetSchema,
} from '../general';
import { HttpMethod } from '../http-method';
import {
  currencySchema,
  pricingModeSchema,
  setPricingRequestSchema,
} from './releases';
import { ApiRoute } from './routes';

/** The kinds of page a design can be built for. Only release pages for now. */
export const designSurfaceSchema = z.enum(['release']);

/**
 * A slot a design gives artists to fill in. Its name is the key the artist's
 * value is stored under.
 */
export const designSlotSchema = z.object({
  name: z.string(),
  kind: z.enum(['text', 'image']),
  /** What the slot is called in the artist's editor. */
  label: z.string(),
});

export type DesignSlot = z.infer<typeof designSlotSchema>;

/**
 * A design as the marketplace and an artist's licensed list show it.
 */
export const designSummarySchema = z.object({
  id: z.guid(),
  name: z.string(),
  description: z.string().nullable(),
  surface: designSurfaceSchema,
  pricingMode: pricingModeSchema,
  currency: currencySchema.nullable(),
  minimumPrice: z.number().int(),
  suggestedPrice: z.number().int().nullable(),
  publishedAt: timestampSchema.nullable(),
});

export type DesignSummary = z.infer<typeof designSummarySchema>;

/**
 * A design as its designer sees it.
 */
export const designSchema = designSummarySchema.extend({
  designerUserId: z.guid().nullable(),
  status: z.enum(['draft', 'published', 'archived', 'taken_down']),
  visibility: z.enum(['public', 'private']),
  /** Set while the designer's hosting is unpaid. */
  offSaleAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type DesignResponse = z.infer<typeof designSchema>;

export const designVersionSchema = z.object({
  id: z.guid(),
  designId: z.guid(),
  version: z.number().int(),
  byteSize: z.number().int(),
  slots: z.array(designSlotSchema),
  createdAt: timestampSchema,
});

export type DesignVersionResponse = z.infer<typeof designVersionSchema>;

/**
 * One of a designer's designs with its versions and how widely each is used.
 */
export const managedDesignSchema = z.object({
  design: designSchema,
  versions: z.array(designVersionSchema),
  usage: z.array(
    z.object({
      designVersionId: z.guid(),
      version: z.number().int(),
      /** How many releases render with this version. */
      releases: z.number().int(),
    }),
  ),
});

export type ManagedDesignResponse = z.infer<typeof managedDesignSchema>;

/**
 * A paid license, in a designer's sales.
 */
export const designSaleSchema = z.object({
  designId: z.guid(),
  designName: z.string(),
  artistId: z.guid(),
  amount: z.number().int().nullable(),
  currency: currencySchema.nullable(),
  refundedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type DesignSale = z.infer<typeof designSaleSchema>;

/**
 * A public design's marketplace page.
 */
export const marketplaceDesignSchema = z.object({
  design: designSummarySchema,
  /** The slots its latest version gives artists to fill in. */
  slots: z.array(designSlotSchema),
  latestVersion: z.number().int(),
});

export type MarketplaceDesignResponse = z.infer<typeof marketplaceDesignSchema>;

/**
 * How getting a design went: licensed at once, or a payment to make on the
 * designer's Stripe checkout page.
 */
export const designAcquisitionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('licensed') }),
  z.object({ status: z.literal('payment'), url: z.string() }),
]);

export type DesignAcquisition = z.infer<typeof designAcquisitionSchema>;

/**
 * The design a release renders with, as its managers edit it.
 */
export const releaseDesignSchema = z.object({
  /** The design and version it renders with, or null for the default layout. */
  applied: z
    .object({
      designId: z.guid(),
      designName: z.string(),
      designVersionId: z.guid(),
      version: z.number().int(),
      slots: z.array(designSlotSchema),
      /** Slot values: text, or the id of an image uploaded for the release. */
      customization: z.record(z.string(), z.string()),
    })
    .nullable(),
  /** The design's newest version, when it is newer than the applied one. */
  newerVersion: z.number().int().nullable(),
  images: z.array(z.object({ id: z.guid(), url: z.string() })),
});

export type ReleaseDesignResponse = z.infer<typeof releaseDesignSchema>;

export const slotImageSchema = z.object({ id: z.guid(), url: z.string() });

export type SlotImage = z.infer<typeof slotImageSchema>;

export const createDesignRequestSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  surface: designSurfaceSchema.optional(),
});

export type CreateDesignRequest = z.infer<typeof createDesignRequestSchema>;

export const designChangesRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

export type DesignChangesRequest = z.infer<typeof designChangesRequestSchema>;

export const confirmDesignVersionRequestSchema =
  confirmUploadRequestSchema.extend({
    slots: z.array(designSlotSchema),
  });

export type ConfirmDesignVersionRequest = z.infer<
  typeof confirmDesignVersionRequestSchema
>;

export const grantDesignRequestSchema = z.object({ artistHandle: z.string() });

export const acquireDesignRequestSchema = z.object({
  /** What to pay for a name-your-price design, or above a fixed price. */
  amount: z.number().int().optional(),
});

export const applyDesignRequestSchema = z.object({ designId: z.guid() });

export const customizeDesignRequestSchema = z.object({
  values: z.record(z.string(), z.string()),
});

export const marketplaceQuerySchema = pageQuerySchema.extend({
  surface: designSurfaceSchema.optional(),
});

export const marketplaceSearchQuerySchema = z.object({
  q: z.string().min(1),
  surface: designSurfaceSchema.optional(),
});

export const designContracts = {
  [ApiRoute.Designs]: {
    [HttpMethod.Post]: {
      request: createDesignRequestSchema,
      response: designSchema,
    },
  },
  [ApiRoute.MyDesigns]: {
    [HttpMethod.Get]: { response: z.array(designSchema) },
  },
  [ApiRoute.MyDesignSales]: {
    [HttpMethod.Get]: { response: z.array(designSaleSchema) },
  },
  [ApiRoute.Design]: {
    [HttpMethod.Get]: { response: managedDesignSchema },
    [HttpMethod.Patch]: {
      request: designChangesRequestSchema,
      response: designSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.DesignPricing]: {
    [HttpMethod.Put]: {
      request: setPricingRequestSchema,
      response: designSchema,
    },
  },
  [ApiRoute.DesignVersionUploads]: {
    [HttpMethod.Post]: {
      request: uploadRequestSchema,
      response: uploadTargetSchema,
    },
  },
  [ApiRoute.DesignVersions]: {
    [HttpMethod.Post]: {
      request: confirmDesignVersionRequestSchema,
      response: designVersionSchema,
    },
  },
  [ApiRoute.DesignPublish]: {
    [HttpMethod.Post]: { response: designSchema },
  },
  [ApiRoute.DesignArchive]: {
    [HttpMethod.Post]: { response: designSchema },
  },
  [ApiRoute.DesignGrants]: {
    [HttpMethod.Post]: {
      request: grantDesignRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.MarketplaceDesigns]: {
    [HttpMethod.Get]: {
      query: marketplaceQuerySchema,
      response: z.array(designSummarySchema),
    },
  },
  [ApiRoute.MarketplaceSearch]: {
    [HttpMethod.Get]: {
      query: marketplaceSearchQuerySchema,
      response: z.array(designSummarySchema),
    },
  },
  [ApiRoute.MarketplaceDesign]: {
    [HttpMethod.Get]: { response: marketplaceDesignSchema },
  },
  [ApiRoute.ArtistDesigns]: {
    [HttpMethod.Get]: { response: z.array(designSummarySchema) },
  },
  [ApiRoute.ArtistDesignAcquire]: {
    [HttpMethod.Post]: {
      request: acquireDesignRequestSchema,
      response: designAcquisitionSchema,
    },
  },
  [ApiRoute.ReleaseDesign]: {
    [HttpMethod.Get]: { response: releaseDesignSchema },
    [HttpMethod.Put]: {
      request: applyDesignRequestSchema,
      response: ackSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.ReleaseDesignUpdate]: {
    [HttpMethod.Post]: { response: ackSchema },
  },
  [ApiRoute.ReleaseDesignCustomization]: {
    [HttpMethod.Put]: {
      request: customizeDesignRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.ReleaseDesignImageUploads]: {
    [HttpMethod.Post]: {
      request: uploadRequestSchema,
      response: uploadTargetSchema,
    },
  },
  [ApiRoute.ReleaseDesignImages]: {
    [HttpMethod.Post]: {
      request: confirmUploadRequestSchema,
      response: slotImageSchema,
    },
  },
  [ApiRoute.DesignImage]: {
    [HttpMethod.Delete]: { response: ackSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
