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
import { currencySchema } from './releases';
import { ApiRoute } from './routes';

export const productTypeSchema = z.enum([
  'vinyl',
  'cd',
  'cassette',
  'shirt',
  'hoodie',
  'sweatshirt',
  'hat',
  'beanie',
  'other',
]);

export type ProductType = z.infer<typeof productTypeSchema>;

/**
 * Where an order ships relative to the artist: their own country, or
 * anywhere else.
 */
export const shippingZoneSchema = z.enum(['domestic', 'international']);

export type ShippingZone = z.infer<typeof shippingZoneSchema>;

export const productSchema = z.object({
  id: z.guid(),
  artistId: z.guid(),
  /** The release this is an edition of, such as its vinyl pressing. */
  releaseId: z.guid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  type: productTypeSchema,
  status: z.enum(['draft', 'published', 'archived', 'taken_down']),
  currency: currencySchema,
  /** Buying it also grants the linked release's download. */
  includesDigital: z.boolean(),
  /** The option axes its variants differ on, such as Size and Color. */
  option1Name: z.string().nullable(),
  option2Name: z.string().nullable(),
  option3Name: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type ProductResponse = z.infer<typeof productSchema>;

export const variantSchema = z.object({
  id: z.guid(),
  productId: z.guid(),
  /** This variant's value on each of the product's option axes. */
  option1Value: z.string().nullable(),
  option2Value: z.string().nullable(),
  option3Value: z.string().nullable(),
  price: z.number().int(),
  stock: z.number().int(),
  sku: z.string().nullable(),
  createdAt: timestampSchema,
});

export type VariantResponse = z.infer<typeof variantSchema>;

export const productImageSchema = z.object({
  id: z.guid(),
  productId: z.guid(),
  /** The variant it shows, when it is specific to one. */
  variantId: z.guid().nullable(),
  altText: z.string().nullable(),
  position: z.number().int(),
  byteSize: z.number().int(),
  createdAt: timestampSchema,
});

export type ProductImageResponse = z.infer<typeof productImageSchema>;

export const shippingRateSchema = z.object({
  destination: shippingZoneSchema,
  /** What the first unit costs to ship, in minor units. */
  firstItemAmount: z.number().int(),
  /** What each unit after the first costs to ship. */
  additionalItemAmount: z.number().int(),
});

export type ShippingRateResponse = z.infer<typeof shippingRateSchema>;

/**
 * Everything a manager edits on a product.
 */
export const managedProductSchema = z.object({
  product: productSchema,
  variants: z.array(variantSchema),
  images: z.array(productImageSchema.extend({ url: z.string() })),
  shippingRates: z.array(shippingRateSchema),
});

export type ManagedProductResponse = z.infer<typeof managedProductSchema>;

/**
 * A product in a store grid, priced from its cheapest variant.
 */
export const storeItemSchema = z.object({
  id: z.guid(),
  name: z.string(),
  type: productTypeSchema,
  currency: currencySchema,
  releaseId: z.guid().nullable(),
  minPrice: z.number().int(),
  totalStock: z.number().int(),
  imageUrl: z.string().nullable(),
});

export type StoreItem = z.infer<typeof storeItemSchema>;

/**
 * A listener's product page.
 */
export const productPageSchema = z.object({
  product: z.object({
    id: z.guid(),
    name: z.string(),
    type: productTypeSchema,
    description: z.string().nullable(),
    currency: currencySchema,
    includesDigital: z.boolean(),
  }),
  artist: z.object({ id: z.guid(), name: z.string(), handle: z.string() }),
  release: z
    .object({ id: z.guid(), title: z.string(), slug: z.string() })
    .nullable(),
  /** The option axes, such as `['Size', 'Color']`. */
  options: z.array(z.string()),
  variants: z.array(
    z.object({
      id: z.guid(),
      /** One value per option axis, in order. */
      options: z.array(z.string()),
      price: z.number().int(),
      stock: z.number().int(),
    }),
  ),
  images: z.array(
    z.object({
      id: z.guid(),
      url: z.string(),
      altText: z.string().nullable(),
      variantId: z.guid().nullable(),
    }),
  ),
  shippingRates: z.array(shippingRateSchema),
});

export type ProductPageResponse = z.infer<typeof productPageSchema>;

export const createProductRequestSchema = z.object({
  name: z.string(),
  type: productTypeSchema,
  description: z.string().nullable().optional(),
  releaseId: z.guid().nullable().optional(),
  includesDigital: z.boolean().optional(),
  /** The option axes, such as `['Size', 'Color']`, at most three. */
  options: z.array(z.string()).optional(),
});

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;

export const updateProductRequestSchema = createProductRequestSchema.partial();

export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;

export const variantRequestSchema = z.object({
  price: z.number().int(),
  stock: z.number().int().optional(),
  sku: z.string().nullable().optional(),
  /** One value per option axis, in the product's order. */
  options: z.array(z.string()).optional(),
});

export type VariantRequest = z.infer<typeof variantRequestSchema>;

export const variantChangesRequestSchema = variantRequestSchema
  .omit({ stock: true })
  .partial();

export type VariantChangesRequest = z.infer<typeof variantChangesRequestSchema>;

export const stockRequestSchema = z.object({ stock: z.number().int() });

export const confirmProductImageRequestSchema =
  confirmUploadRequestSchema.extend({
    variantId: z.guid().nullable().optional(),
    altText: z.string().nullable().optional(),
  });

export type ConfirmProductImageRequest = z.infer<
  typeof confirmProductImageRequestSchema
>;

export const productImageChangesRequestSchema = z.object({
  variantId: z.guid().nullable().optional(),
  altText: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

export type ProductImageChangesRequest = z.infer<
  typeof productImageChangesRequestSchema
>;

export const shippingRateRequestSchema = shippingRateSchema.omit({
  destination: true,
});

export type ShippingRateRequest = z.infer<typeof shippingRateRequestSchema>;

export const merchContracts = {
  [ApiRoute.ArtistProducts]: {
    [HttpMethod.Post]: {
      request: createProductRequestSchema,
      response: productSchema,
    },
    [HttpMethod.Get]: { response: z.array(productSchema) },
  },
  [ApiRoute.Product]: {
    [HttpMethod.Get]: { response: managedProductSchema },
    [HttpMethod.Patch]: {
      request: updateProductRequestSchema,
      response: productSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.ProductPublish]: {
    [HttpMethod.Post]: { response: productSchema },
  },
  [ApiRoute.ProductArchive]: {
    [HttpMethod.Post]: { response: productSchema },
  },
  [ApiRoute.ProductVariants]: {
    [HttpMethod.Post]: {
      request: variantRequestSchema,
      response: variantSchema,
    },
  },
  [ApiRoute.Variant]: {
    [HttpMethod.Patch]: {
      request: variantChangesRequestSchema,
      response: ackSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.VariantStock]: {
    [HttpMethod.Put]: { request: stockRequestSchema, response: ackSchema },
  },
  [ApiRoute.ProductImageUploads]: {
    [HttpMethod.Post]: {
      request: uploadRequestSchema,
      response: uploadTargetSchema,
    },
  },
  [ApiRoute.ProductImages]: {
    [HttpMethod.Post]: {
      request: confirmProductImageRequestSchema,
      response: productImageSchema,
    },
  },
  [ApiRoute.ProductImage]: {
    [HttpMethod.Patch]: {
      request: productImageChangesRequestSchema,
      response: ackSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.ProductShippingRate]: {
    [HttpMethod.Put]: {
      request: shippingRateRequestSchema,
      response: shippingRateSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.CatalogStore]: {
    [HttpMethod.Get]: { response: z.array(storeItemSchema) },
  },
  [ApiRoute.CatalogEditions]: {
    [HttpMethod.Get]: { response: z.array(storeItemSchema) },
  },
  [ApiRoute.CatalogProduct]: {
    [HttpMethod.Get]: { response: productPageSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
