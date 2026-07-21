import { sql } from 'drizzle-orm';
import { check, index, integer, pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { artistOrders } from './artist-orders';
import { releases } from './releases';

/**
 * A line item within an artist order.
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    artistOrderId: uuid('artist_order_id')
      .notNull()
      .references(() => artistOrders.id, { onDelete: 'cascade' }),

    /** The digital release bought. Restricted so a sold release cannot be deleted. */
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'restrict' }),

    quantity: integer('quantity').notNull().default(1),

    /** Price snapshot per unit, in minor units of the artist order's currency. */
    unitPrice: integer('unit_price').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('order_items_artist_order_id_idx').on(table.artistOrderId),
    index('order_items_release_id_idx').on(table.releaseId),
    check('order_items_quantity_positive', sql`${table.quantity} >= 1`),
    // a line item can be free, but never negative
    check('order_items_unit_price_not_negative', sql`${table.unitPrice} >= 0`),
    pgPolicy('Buyers can read their own order items', {
      for: 'select',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.artist_orders ao JOIN public.orders o ON o.id = ao.order_id WHERE ao.id = ${table.artistOrderId} AND o.user_id = ${authUid})`,
    }),
    pgPolicy('Managers can read their order items', {
      for: 'select',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.artist_orders ao WHERE ao.id = ${table.artistOrderId} AND public.is_artist_manager(ao.artist_id))`,
    }),
  ],
);

/**
 * Represents a line item within an artist order.
 * The type returned by a select query to the orderItems table.
 */
export type OrderItem = typeof orderItems.$inferSelect;

/**
 * The type used to insert a new order item.
 */
export type NewOrderItem = typeof orderItems.$inferInsert;
