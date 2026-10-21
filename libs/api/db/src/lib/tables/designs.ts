import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { currencyEnum } from './payout-accounts';
import { pricingModeEnum } from './release-pricing';
import { users } from './users';

/**
 * The kind of page a design is built for. Only release pages for now.
 */
export const designSurfaceEnum = pgEnum('design_surface', ['release']);

export type DesignSurface = (typeof designSurfaceEnum.enumValues)[number];

/**
 * `draft` - visible only to its designer.
 * `published` - available to artists, on the marketplace if public.
 * `archived` - withdrawn from the marketplace. Licenses and the releases
 *   using it are unaffected.
 * `taken_down` - removed by a platform admin. Releases using it fall back to
 *   the default layout.
 */
export const designStatusEnum = pgEnum('design_status', [
  'draft',
  'published',
  'archived',
  'taken_down',
]);

export type DesignStatus = (typeof designStatusEnum.enumValues)[number];

/**
 * `public` - listed on the marketplace.
 * `private` - visible only to artists the designer grants it to, as with a
 *   commission.
 */
export const designVisibilityEnum = pgEnum('design_visibility', [
  'public',
  'private',
]);

export type DesignVisibility = (typeof designVisibilityEnum.enumValues)[number];

/**
 * A page design built by a designer. Its code lives in its versions; this row
 * is what the marketplace lists and what an artist licenses.
 *
 * Priced like a release, in the designer's selling currency. Amounts are
 * integer minor units.
 */
export const designs = pgTable(
  'designs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Set null if the designer deletes their account; designs in use live on. */
    designerUserId: uuid('designer_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    name: text('name').notNull(),
    description: text('description'),

    surface: designSurfaceEnum('surface').notNull(),
    status: designStatusEnum('status').notNull().default('draft'),
    visibility: designVisibilityEnum('visibility').notNull().default('public'),

    pricingMode: pricingModeEnum('pricing_mode').notNull().default('free'),
    currency: currencyEnum('currency'),
    minimumPrice: integer('minimum_price').notNull().default(0),
    suggestedPrice: integer('suggested_price'),

    /** When the design first became available. Null while it is a draft. */
    publishedAt: timestamp('published_at', { withTimezone: true }),

    /**
     * When the design came off sale because its designer stopped paying their
     * hosting costs. Releases already using it keep it.
     */
    offSaleAt: timestamp('off_sale_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // the marketplace browses by surface, status, and visibility
    index('designs_marketplace_idx').on(
      table.surface,
      table.status,
      table.visibility,
    ),
    index('designs_designer_user_id_idx').on(table.designerUserId),
    check(
      'designs_published_at_required_when_published',
      sql`${table.status} <> 'published' OR ${table.publishedAt} IS NOT NULL`,
    ),
    // pricing rules match release_pricing
    check('designs_minimum_not_negative', sql`${table.minimumPrice} >= 0`),
    check(
      'designs_currency_required_when_paid',
      sql`${table.pricingMode} = 'free' OR ${table.currency} IS NOT NULL`,
    ),
    check(
      'designs_free_is_zero',
      sql`${table.pricingMode} <> 'free' OR (${table.minimumPrice} = 0 AND ${table.suggestedPrice} IS NULL)`,
    ),
    check(
      'designs_fixed_has_price',
      sql`${table.pricingMode} <> 'fixed' OR (${table.minimumPrice} > 0 AND ${table.suggestedPrice} IS NULL)`,
    ),
    check(
      'designs_suggested_gte_minimum',
      sql`${table.suggestedPrice} IS NULL OR ${table.suggestedPrice} >= ${table.minimumPrice}`,
    ),
    pgPolicy('Marketplace is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`${table.status} = 'published' AND ${table.visibility} = 'public'`,
    }),
    pgPolicy('Designers can read their own designs', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.designerUserId}`,
    }),
  ],
);

export type Design = typeof designs.$inferSelect;
export type NewDesign = typeof designs.$inferInsert;
