import { sql } from 'drizzle-orm';
import { boolean, check, index, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { artists } from './artists';
import { currencyEnum } from './artist-payout-accounts';
import { releases } from './releases';

/**
 * Category of physical merchandise.
 */
export const productTypeEnum = pgEnum('product_type', [
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

export type ProductType = (typeof productTypeEnum.enumValues)[number];

/**
 * Lifecycle of a product, `draft` is visible only to the
 * artist's managers, `published` is in the public store, `archived` is pulled
 * from sale but kept for the order records that reference it.
 */
export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'published',
  'archived',
]);

export type ProductStatus = (typeof productStatusEnum.enumValues)[number];

/**
 * A physical item an artist sells.
 * The buyable units with their own price and stock are its `product_variants`,
 * this row carries the shared metadata and names the variant axes.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** The selling artist. Restricted so an artist with products cannot be deleted. */
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'restrict' }),

    /**
     * The release this is a physical edition of, such as a vinyl or CD of an album.
     * Null for standalone merch like a logo tee. SET NULL so deleting a draft
     * release just unlinks the product rather than removing it.
     */
    releaseId: uuid('release_id').references(() => releases.id, {
      onDelete: 'set null',
    }),

    name: text('name').notNull(),
    description: text('description'),
    type: productTypeEnum('type').notNull(),
    status: productStatusEnum('status').notNull().default('draft'),

    /**
     * The artist's currency. Merch is always sold for cash, so this is never null.
     */
    currency: currencyEnum('currency').notNull(),

    /**
     * Whether buying this product also grants the buyer a digital entitlement to
     * its linked release, i.e. "buy the vinyl, get the download" bundle.
     */
    includesDigital: boolean('includes_digital').notNull().default(false),

    /**
     * Names of three variant axes, such as 'Size', 'Color'. Null means
     * the axis is unused. Each variant fills in the matching value columns.
     */
    option1Name: text('option1_name'),
    option2Name: text('option2_name'),
    option3Name: text('option3_name'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('products_artist_id_idx').on(table.artistId),
    index('products_release_id_idx').on(table.releaseId),
    index('products_status_idx').on(table.status),
    // option axes must be filled in order: option2 needs option1, option3 needs
    // option2. Keeps a variant from having a value on an axis the product skips.
    check(
      'products_option_names_gap_free',
      sql`(${table.option1Name} IS NOT NULL OR ${table.option2Name} IS NULL) AND (${table.option2Name} IS NOT NULL OR ${table.option3Name} IS NULL)`,
    ),
    // a bundle needs a release to grant the digital download of
    check(
      'products_includes_digital_needs_release',
      sql`NOT ${table.includesDigital} OR ${table.releaseId} IS NOT NULL`,
    ),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`${table.status} = 'published'`,
    }),
    pgPolicy('Managers can write products', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager(${table.artistId})`,
      withCheck: sql`public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents a physical product.
 * The type returned by a select query to the products table.
 */
export type Product = typeof products.$inferSelect;

/**
 * The type used to insert a new product.
 */
export type NewProduct = typeof products.$inferInsert;
