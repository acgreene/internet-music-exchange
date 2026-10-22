import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { artists } from './artists';
import { designs } from './designs';
import { currencyEnum } from './payout-accounts';
import { users } from './users';

/**
 * How an artist came to hold a license for a design.
 *
 * `purchase` - a manager paid the designer for it.
 * `free` - claimed a free design, or named a price of zero.
 * `grant` - the designer granted a private design, as with a commission.
 */
export const designLicenseSourceEnum = pgEnum('design_license_source', [
  'purchase',
  'free',
  'grant',
]);

export type DesignLicenseSource =
  (typeof designLicenseSourceEnum.enumValues)[number];

/**
 * An artist's permanent right to use a design, every version of it, on any of
 * its releases.
 *
 * A purchase is paid directly to the designer's connected account, outside the
 * listener cart, so the payment is recorded here. A refunded purchase keeps its
 * row as a sales record; the license is valid only while `refunded_at` is null.
 *
 * API-only: RLS is on with no policies.
 */
export const designLicenses = pgTable(
  'design_licenses',
  {
    designId: uuid('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'restrict' }),

    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),

    source: designLicenseSourceEnum('source').notNull(),

    /** The manager who bought or claimed it. Null for grants. */
    acquiredByUserId: uuid('acquired_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    /** What was paid, in minor units, for a purchase. */
    amount: integer('amount'),
    currency: currencyEnum('currency'),
    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),

    refundedAt: timestamp('refunded_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // an artist licenses a design once; it covers every release and version
    primaryKey({ columns: [table.designId, table.artistId] }),
    index('design_licenses_artist_id_idx').on(table.artistId),
    // a purchase records its payment; free and granted licenses have none
    check(
      'design_licenses_payment_matches_source',
      sql`CASE WHEN ${table.source} = 'purchase'
        THEN ${table.amount} > 0 AND ${table.currency} IS NOT NULL AND ${table.stripePaymentIntentId} IS NOT NULL
        ELSE ${table.amount} IS NULL AND ${table.currency} IS NULL AND ${table.stripePaymentIntentId} IS NULL AND ${table.refundedAt} IS NULL
      END`,
    ),
  ],
).enableRLS();

export type DesignLicense = typeof designLicenses.$inferSelect;
export type NewDesignLicense = typeof designLicenses.$inferInsert;
