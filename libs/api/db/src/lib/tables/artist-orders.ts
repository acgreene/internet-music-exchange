import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { artists } from './artists';
import { currencyEnum } from './artist-payout-accounts';
import { orders } from './orders';

/**
 * Payment lifecycle of an artist order.
 *
 * `pending` - charge started but not settled.
 * `completed` - paid and settled.
 * `refunded` - fully refunded, entitlements from it are removed.
 * `failed` - the charge did not go through.
 */
export const artistOrderStatusEnum = pgEnum('artist_order_status', [
  'pending',
  'completed',
  'refunded',
  'failed',
]);

export type ArtistOrderStatus =
  (typeof artistOrderStatusEnum.enumValues)[number];

/**
 * One artist's portion of an order: everything in a cart from a single artist,
 * paid as one Stripe direct charge to that artist's connected account, and
 * shipped by that artist as one package.
 *
 * Buyers read their own through the parent order; managers read their sales.
 */
export const artistOrders = pgTable(
  'artist_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

    /** The selling artist. Restricted so an artist with sales cannot be deleted. */
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'restrict' }),

    status: artistOrderStatusEnum('status').notNull().default('pending'),

    /**
     * Total charged, in minor units: items + shipping + tax. The API keeps it
     * equal to that sum, item subtotal is `amount - shipping_amount - tax_amount`.
     */
    amount: integer('amount').notNull(),

    /** Shipping collected, in minor units. Zero for a digital-only order. */
    shippingAmount: integer('shipping_amount').notNull().default(0),

    /** Tax collected, computed by Stripe Tax and recorded here. */
    taxAmount: integer('tax_amount').notNull().default(0),

    /** The currency of the order. */
    currency: currencyEnum('currency').notNull(),

    /**
     * The Stripe PaymentIntent for this artist's direct charge. Unique, so one
     * charge cannot record two artist orders even if its webhook redelivers.
     */
    stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),

    /** When a refund was recorded, if any. */
    refundedAt: timestamp('refunded_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Set by the API as the charge advances through its lifecycle. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('artist_orders_order_id_idx').on(table.orderId),
    index('artist_orders_artist_id_idx').on(table.artistId),
    // an artist order is a real charge; free acquisitions are entitlements,
    // not orders, so the amount is always positive
    check('artist_orders_amount_positive', sql`${table.amount} > 0`),
    check(
      'artist_orders_shipping_not_negative',
      sql`${table.shippingAmount} >= 0`,
    ),
    check('artist_orders_tax_not_negative', sql`${table.taxAmount} >= 0`),
    pgPolicy('Buyers can read their own artist orders', {
      for: 'select',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.orders o WHERE o.id = ${table.orderId} AND o.user_id = ${authUid})`,
    }),
    pgPolicy('Managers can read their artist orders', {
      for: 'select',
      to: authenticatedRole,
      using: sql`public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents one artist's portion of an order.
 * The type returned by a select query to the artistOrders table.
 */
export type ArtistOrder = typeof artistOrders.$inferSelect;

/**
 * The type used to insert a new artist order.
 */
export type NewArtistOrder = typeof artistOrders.$inferInsert;
