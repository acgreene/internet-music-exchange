import { sql } from 'drizzle-orm';
import { index, jsonb, pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { users } from './users';

/**
 * A single checkout, the cart a buyer pays in one session. It groups one
 * `artist_orders` row per artist in the cart, since a multi-artist cart settles
 * as one direct charge per artist.
 *
 * Written only by the API under `service_role`. Buyers read their own orders
 * and managers never read this table. Artist managers can only see their own slice through
 * `artist_orders`, not a buyer's full multi-artist cart.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * The buyer. Nullable with ON DELETE SET NULL so deleting a buyer's account
     * anonymizes their orders instead of erasing the artists' sales.
     */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    /**
     * Snapshot of the shipping address Stripe collected at checkout, for the
     * artists to ship to. Null for a fully digital cart. The
     * `purge_order_pii_on_user_delete` trigger clears it when the buyer's
     * account is deleted (the same event that nulls `user_id`).
     */
    shippingAddress: jsonb('shipping_address'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Set by the API as the order's children advance through payment. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('orders_user_id_idx').on(table.userId),
    pgPolicy('Buyers can read their own orders', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.userId}`,
    }),
  ],
);

/**
 * Represents one checkout / cart.
 * The type returned by a select query to the orders table.
 */
export type Order = typeof orders.$inferSelect;

/**
 * The type used to insert a new order.
 */
export type NewOrder = typeof orders.$inferInsert;
