import { sql } from 'drizzle-orm';
import { check, integer, pgEnum, pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { currencyEnum } from './artist-payout-accounts';
import { releases } from './releases';

/**
 * How a release is priced.
 *
 * `free` - no charge; the release drops straight into a buyer's library.
 * `fixed` - a set price the buyer must meet and may choose to exceed.
 * `name_your_price` - the buyer names an amount, down to a floor of
 *   `minimum_price`.
 */
export const pricingModeEnum = pgEnum('pricing_mode', [
  'free',
  'fixed',
  'name_your_price',
]);

export type PricingMode = (typeof pricingModeEnum.enumValues)[number];

/**
 * The price of a release. One row per release, a release with no row has not
 * been priced and cannot be published.
 *
 * The `currency` here is a copy of the artist's `default_currency`, stamped by
 * the API so the public catalog can display it (the payout account is private)
 * and so it stays bound to the amounts it denominates. Amounts are integer
 * minor units (cents); money is never a float.
 */
export const releasePricing = pgTable(
  'release_pricing',
  {
    /** One pricing row per release. */
    releaseId: uuid('release_id')
      .primaryKey()
      .references(() => releases.id, { onDelete: 'cascade' }),

    mode: pricingModeEnum('mode').notNull(),

    /**
     * Currency the amounts below are denominated in. Null only for a free
     * release, which never takes a payment, required for any paid mode.
     */
    currency: currencyEnum('currency'),

    /**
     * Floor the buyer must pay, in minor units (i.e., cents).
     * Zero for free or for "name your price".
     * */
    minimumPrice: integer('minimum_price').notNull().default(0),

    /** Optional amount shown to the buyer as a suggestion. */
    suggestedPrice: integer('suggested_price'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'release_pricing_minimum_not_negative',
      sql`${table.minimumPrice} >= 0`,
    ),
    // a paid release has to say what currency its amounts are in; a free one
    // never takes a payment, so it needs no currency
    check(
      'release_pricing_currency_required_when_paid',
      sql`${table.mode} = 'free' OR ${table.currency} IS NOT NULL`,
    ),
    // a free release costs nothing and suggests nothing
    check(
      'release_pricing_free_is_zero',
      sql`${table.mode} <> 'free' OR (${table.minimumPrice} = 0 AND ${table.suggestedPrice} IS NULL)`,
    ),
    // a fixed price is a real, single amount, with no separate suggestion
    check(
      'release_pricing_fixed_has_price',
      sql`${table.mode} <> 'fixed' OR (${table.minimumPrice} > 0 AND ${table.suggestedPrice} IS NULL)`,
    ),
    // a suggestion can never sit below the floor the buyer must clear
    check(
      'release_pricing_suggested_gte_minimum',
      sql`${table.suggestedPrice} IS NULL OR ${table.suggestedPrice} >= ${table.minimumPrice}`,
    ),
    // pricing follows the visibility of the release it belongs to
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM public.releases r WHERE r.id = ${table.releaseId} AND r.status = 'published')`,
    }),
    pgPolicy('Managers can write pricing', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
      withCheck: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
    }),
  ],
);

/**
 * Represents the price of a release.
 * The type returned by a select query to the releasePricing table.
 */
export type ReleasePricing = typeof releasePricing.$inferSelect;

/**
 * The type used to insert a new release pricing row.
 */
export type NewReleasePricing = typeof releasePricing.$inferInsert;
