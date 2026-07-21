import { sql } from 'drizzle-orm';
import { check, index, integer, pgPolicy, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { products } from './products';

/**
 * A buyable unit of a product: one combination of the product's option axes,
 * with its own price and stock. A product with no options still has one default
 * variant (all option values null).
 */
export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),

    /**
     * This variant's value on each of the product's option axes, such as
     * option1='L', option2='Black'. Null on axes the product does not use. The
     * app keeps these consistent with the product's option names.
     */
    option1Value: text('option1_value'),
    option2Value: text('option2_value'),
    option3Value: text('option3_value'),

    /** Variant price in minor units of the product's currency. */
    price: integer('price').notNull(),

    /** Units in stock; 0 is sold out. */
    stock: integer('stock').notNull().default(0),

    /** Optional artist-supplied stock-keeping unit. */
    sku: text('sku'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('product_variants_product_id_idx').on(table.productId),
    // no two variants of a product may share the same option combination.
    unique('product_variants_combination_unique')
      .on(
        table.productId,
        table.option1Value,
        table.option2Value,
        table.option3Value,
      )
      .nullsNotDistinct(),
    check('product_variants_price_not_negative', sql`${table.price} >= 0`),
    check('product_variants_stock_not_negative', sql`${table.stock} >= 0`),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM public.products p WHERE p.id = ${table.productId} AND p.status = 'published')`,
    }),
    pgPolicy('Managers can write variants', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = ${table.productId}))`,
      withCheck: sql`public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = ${table.productId}))`,
    }),
  ],
);

/**
 * Represents a buyable variant of a product.
 * The type returned by a select query to the productVariants table.
 */
export type ProductVariant = typeof productVariants.$inferSelect;

/**
 * The type used to insert a new product variant.
 */
export type NewProductVariant = typeof productVariants.$inferInsert;
