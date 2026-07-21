import { sql } from 'drizzle-orm';
import { check, integer, pgEnum, pgPolicy, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { products } from './products';

/**
 * Where an order ships relative to the selling artist.
 * `domestic` is the artist's own country, `international` is everywhere else.
 */
export const shippingZoneEnum = pgEnum('shipping_zone', [
  'domestic',
  'international',
]);

export type ShippingZone = (typeof shippingZoneEnum.enumValues)[number];

/**
 * What a product costs to ship, per destination zone. The platform does not
 * calculate shipping, so the artist sets these. The API charges
 * `first_item_amount` for the first unit and `additional_item_amount` for each
 * unit after, summing across the cart's products to the artist order's
 * `shipping_amount`, and hands the total to Stripe Checkout.
 */
export const productShippingRates = pgTable(
  'product_shipping_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),

    destination: shippingZoneEnum('destination').notNull(),

    /** Shipping for the first unit of this product, in minor units. */
    firstItemAmount: integer('first_item_amount').notNull(),

    /** Shipping for each additional unit, in minor units. */
    additionalItemAmount: integer('additional_item_amount').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // one rate per zone per product
    unique('product_shipping_rates_product_id_destination_unique').on(
      table.productId,
      table.destination,
    ),
    check(
      'product_shipping_rates_first_not_negative',
      sql`${table.firstItemAmount} >= 0`,
    ),
    check(
      'product_shipping_rates_additional_not_negative',
      sql`${table.additionalItemAmount} >= 0`,
    ),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM public.products p WHERE p.id = ${table.productId} AND p.status = 'published')`,
    }),
    pgPolicy('Managers can write shipping rates', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = ${table.productId}))`,
      withCheck: sql`public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = ${table.productId}))`,
    }),
  ],
);

/**
 * Represents a product's shipping rate for one destination zone.
 * The type returned by a select query to the productShippingRates table.
 */
export type ProductShippingRate = typeof productShippingRates.$inferSelect;

/**
 * The type used to insert a new product shipping rate.
 */
export type NewProductShippingRate = typeof productShippingRates.$inferInsert;
