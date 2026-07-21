import { sql } from 'drizzle-orm';
import { check, index, integer, pgPolicy, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { productVariants } from './product-variants';
import { products } from './products';

/**
 * A photo of a product, shown in the store gallery. Images live in a public
 * cloud storage bucket.
 */
export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),

    /**
     * An image specific to one variant. Null for a
     * general product shot. Set null if the variant is removed.
     */
    variantId: uuid('variant_id').references(() => productVariants.id, {
      onDelete: 'set null',
    }),

    /** Cloud storage bucket holding the object (public). */
    bucket: text('bucket').notNull(),
    /** Path of the object within the bucket. */
    objectKey: text('object_key').notNull(),

    /** Alt text for accessibility. */
    altText: text('alt_text'),

    /** Ordering within the product's gallery. */
    position: integer('position').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('product_images_product_id_idx').on(table.productId),
    // two rows must never claim the same object
    unique('product_images_bucket_object_key_unique').on(
      table.bucket,
      table.objectKey,
    ),
    check('product_images_position_not_negative', sql`${table.position} >= 0`),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM public.products p WHERE p.id = ${table.productId} AND p.status = 'published')`,
    }),
    // managers see images on their own products, including drafts
    pgPolicy('Managers can read their product images', {
      for: 'select',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = ${table.productId}))`,
    }),
  ],
);

/**
 * Represents a product photo.
 * The type returned by a select query to the productImages table.
 */
export type ProductImage = typeof productImages.$inferSelect;

/**
 * The type used to insert a new product image.
 */
export type NewProductImage = typeof productImages.$inferInsert;
