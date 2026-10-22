import { z } from 'zod';
import type { RouteContracts } from '../contract';
import { ackSchema, pageQuerySchema, timestampSchema } from '../general';
import { HttpMethod } from '../http-method';
import { currencySchema } from './releases';
import { ApiRoute } from './routes';

/**
 * One thing in a cart: a digital release, optionally with what the buyer
 * chose to pay, or units of a merch variant. Strict, so an item is exactly
 * one of the two.
 */
export const cartItemSchema = z.union([
  z.strictObject({
    releaseId: z.guid(),
    /** For name-your-price releases, or paying above a fixed price. */
    amount: z.number().int().optional(),
  }),
  z.strictObject({ variantId: z.guid(), quantity: z.number().int() }),
]);

export type CartItem = z.infer<typeof cartItemSchema>;

/**
 * Where physical items ship. `country` is an ISO 3166-1 alpha-2 code.
 */
export const shippingAddressSchema = z.object({
  name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().nullable().optional(),
  city: z.string().min(1),
  state: z.string().nullable().optional(),
  postalCode: z.string().min(1),
  country: z.string().length(2),
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const checkoutRequestSchema = z.object({
  items: z.array(cartItemSchema),
  /** Required when the cart has anything physical. */
  shippingAddress: shippingAddressSchema.nullable().optional(),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

/**
 * A started checkout. Free releases are already in the buyer's library; each
 * artist with something to pay for has a payment, made in turn on Stripe's
 * checkout page.
 */
export const startedCheckoutSchema = z.object({
  orderId: z.guid(),
  claimedReleaseIds: z.array(z.guid()),
  payments: z.array(
    z.object({
      artistId: z.guid(),
      artistName: z.string(),
      currency: currencySchema,
      /** Items, before shipping and tax. */
      subtotal: z.number().int(),
      shipping: z.number().int(),
      url: z.string(),
    }),
  ),
});

export type StartedCheckout = z.infer<typeof startedCheckoutSchema>;

export const artistOrderStatusSchema = z.enum([
  'pending',
  'completed',
  'refunded',
  'failed',
]);

export const fulfillmentStatusSchema = z.enum([
  'unfulfilled',
  'shipped',
  'delivered',
]);

/**
 * One artist's portion of an order.
 */
export const artistOrderSchema = z.object({
  id: z.guid(),
  orderId: z.guid(),
  artistId: z.guid(),
  status: artistOrderStatusSchema,
  /** Items, shipping, and tax, in minor units. */
  amount: z.number().int(),
  shippingAmount: z.number().int(),
  taxAmount: z.number().int(),
  currency: currencySchema,
  refundedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type ArtistOrderResponse = z.infer<typeof artistOrderSchema>;

export const orderLineSchema = z.object({
  id: z.guid(),
  releaseId: z.guid().nullable(),
  productVariantId: z.guid().nullable(),
  name: z.string(),
  /** The variant's options, such as `L / Black`. */
  variantLabel: z.string().nullable(),
  quantity: z.number().int(),
  unitPrice: z.number().int(),
});

export type OrderLine = z.infer<typeof orderLineSchema>;

export const fulfillmentSchema = z.object({
  status: fulfillmentStatusSchema,
  trackingNumber: z.string().nullable(),
  carrier: z.string().nullable(),
  shippedAt: timestampSchema.nullable(),
});

export type FulfillmentResponse = z.infer<typeof fulfillmentSchema>;

/**
 * A purchase in the buyer's history.
 */
export const purchaseListItemSchema = z.object({
  artistOrderId: z.guid(),
  orderId: z.guid(),
  artistId: z.guid(),
  artistName: z.string(),
  status: artistOrderStatusSchema,
  amount: z.number().int(),
  currency: currencySchema,
  createdAt: timestampSchema,
  fulfillmentStatus: fulfillmentStatusSchema.nullable(),
  trackingNumber: z.string().nullable(),
  carrier: z.string().nullable(),
});

export type PurchaseListItem = z.infer<typeof purchaseListItemSchema>;

export const purchaseDetailSchema = z.object({
  purchase: artistOrderSchema,
  artist: z
    .object({ id: z.guid(), name: z.string(), handle: z.string() })
    .nullable(),
  items: z.array(orderLineSchema),
  fulfillment: fulfillmentSchema.nullable(),
});

export type PurchaseDetail = z.infer<typeof purchaseDetailSchema>;

export const refundRequestSchema = z.object({ message: z.string() });

/**
 * A sale as its artist's managers list it.
 */
export const saleListItemSchema = z.object({
  artistOrderId: z.guid(),
  orderId: z.guid(),
  status: artistOrderStatusSchema,
  amount: z.number().int(),
  shippingAmount: z.number().int(),
  taxAmount: z.number().int(),
  currency: currencySchema,
  createdAt: timestampSchema,
  buyerName: z.string().nullable(),
  shippingAddress: shippingAddressSchema.nullable(),
  fulfillmentStatus: fulfillmentStatusSchema.nullable(),
  trackingNumber: z.string().nullable(),
});

export type SaleListItem = z.infer<typeof saleListItemSchema>;

/**
 * An artist's settled sales in one currency.
 */
export const salesTotalsSchema = z.object({
  currency: currencySchema,
  orderCount: z.number().int(),
  grossAmount: z.number().int(),
  shippingAmount: z.number().int(),
  taxAmount: z.number().int(),
});

export type SalesTotals = z.infer<typeof salesTotalsSchema>;

export const saleDetailSchema = z.object({
  sale: artistOrderSchema,
  items: z.array(orderLineSchema),
  fulfillment: fulfillmentSchema.nullable(),
  buyerName: z.string().nullable(),
  shippingAddress: shippingAddressSchema.nullable(),
});

export type SaleDetail = z.infer<typeof saleDetailSchema>;

export const shipmentRequestSchema = z.object({
  trackingNumber: z.string().nullable().optional(),
  carrier: z.string().nullable().optional(),
});

export type ShipmentRequest = z.infer<typeof shipmentRequestSchema>;

export const orderContracts = {
  [ApiRoute.Checkout]: {
    [HttpMethod.Post]: {
      request: checkoutRequestSchema,
      response: startedCheckoutSchema,
    },
  },
  [ApiRoute.MyPurchases]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema,
      response: z.array(purchaseListItemSchema),
    },
  },
  [ApiRoute.Purchase]: {
    [HttpMethod.Get]: { response: purchaseDetailSchema },
  },
  [ApiRoute.PurchaseRefundRequest]: {
    [HttpMethod.Post]: { request: refundRequestSchema, response: ackSchema },
  },
  [ApiRoute.ArtistSales]: {
    [HttpMethod.Get]: {
      query: pageQuerySchema,
      response: z.array(saleListItemSchema),
    },
  },
  [ApiRoute.ArtistSalesToShip]: {
    [HttpMethod.Get]: { response: z.array(saleListItemSchema) },
  },
  [ApiRoute.ArtistSalesTotals]: {
    [HttpMethod.Get]: { response: z.array(salesTotalsSchema) },
  },
  [ApiRoute.Sale]: {
    [HttpMethod.Get]: { response: saleDetailSchema },
  },
  [ApiRoute.SaleShipment]: {
    [HttpMethod.Post]: { request: shipmentRequestSchema, response: ackSchema },
  },
  [ApiRoute.SaleDelivered]: {
    [HttpMethod.Post]: { response: ackSchema },
  },
  [ApiRoute.SaleRefund]: {
    [HttpMethod.Post]: { response: ackSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
