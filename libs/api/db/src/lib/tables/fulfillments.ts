import { sql } from 'drizzle-orm';
import { check, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { artistOrders } from './artist-orders';

/**
 * Shipping progress of an artist order.
 * Flow is `unfulfilled` -> `shipped` (tracking entered) -> `delivered`.
 */
export const fulfillmentStatusEnum = pgEnum('fulfillment_status', [
  'unfulfilled',
  'shipped',
  'delivered',
]);

export type FulfillmentStatus =
  (typeof fulfillmentStatusEnum.enumValues)[number];

/**
 * The shipping side of an artist order.
 */
export const fulfillments = pgTable(
  'fulfillments',
  {
    /** One fulfillment per artist order; the artist order id is the key. */
    artistOrderId: uuid('artist_order_id')
      .primaryKey()
      .references(() => artistOrders.id, { onDelete: 'cascade' }),

    status: fulfillmentStatusEnum('status').notNull().default('unfulfilled'),

    /** Tracking number the artist entered, once shipped. */
    trackingNumber: text('tracking_number'),
    /** Carrier the artist shipped with, e.g. 'USPS'. */
    carrier: text('carrier'),

    /** When the artist marked it shipped. */
    shippedAt: timestamp('shipped_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // once shipped or delivered, it must carry the ship date
    check(
      'fulfillments_shipped_has_date',
      sql`${table.status} = 'unfulfilled' OR ${table.shippedAt} IS NOT NULL`,
    ),
    // the buyer of the parent order can track their package
    pgPolicy('Buyers can read their own fulfillments', {
      for: 'select',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.artist_orders ao JOIN public.orders o ON o.id = ao.order_id WHERE ao.id = ${table.artistOrderId} AND o.user_id = ${authUid})`,
    }),
    // managers read and update fulfillment for their own artist orders — this
    // table holds no money, so full write is safe
    pgPolicy('Managers can manage their fulfillments', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT ao.artist_id FROM public.artist_orders ao WHERE ao.id = ${table.artistOrderId}))`,
      withCheck: sql`public.is_artist_manager((SELECT ao.artist_id FROM public.artist_orders ao WHERE ao.id = ${table.artistOrderId}))`,
    }),
  ],
);

/**
 * Represents the shipping progress of an artist order.
 * The type returned by a select query to the fulfillments table.
 */
export type Fulfillment = typeof fulfillments.$inferSelect;

/**
 * The type used to insert a new fulfillment.
 */
export type NewFulfillment = typeof fulfillments.$inferInsert;
