import { sql } from 'drizzle-orm';
import { boolean, check, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { artists } from './artists';
import { users } from './users';

/**
 * Currencies the platform supports as lowercase ISO 4217 codes to
 * match Stripe. Defined here because a seller's currency originates from their
 * Stripe account.
 */
export const currencyEnum = pgEnum('currency', ['usd', 'eur']);

export type Currency = (typeof currencyEnum.enumValues)[number];

/**
 * A seller's connected Stripe account, used to take payment and to pay the
 * seller out. A seller is either an artist, selling releases and merch, or a
 * designer, selling designs.
 *
 * Payments run through Stripe Connect with direct charges: a buyer pays the
 * seller's connected account and Stripe handles the bank payout, so the
 * platform doesn't hold the cash. A row is created by the API when onboarding
 * begins and is refreshed from Stripe's `account.updated` webhook.
 *
 * Nothing here is client writable: the flags reflect Stripe's decisions, and
 * the API writes them under `service_role`.
 */
export const payoutAccounts = pgTable(
  'payout_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** The artist this account belongs to, when an artist is the seller. */
    artistId: uuid('artist_id')
      .unique()
      .references(() => artists.id, { onDelete: 'cascade' }),

    /** The designer this account belongs to, when a designer is the seller. */
    designerUserId: uuid('designer_user_id')
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The connected account identifier from Stripe. */
    stripeAccountId: text('stripe_account_id').notNull().unique(),

    /**
     * Whether the account can accept charges. Nothing paid can be put on sale
     * until this is true. Independent of `payoutsEnabled`: Stripe can clear an
     * account to charge while its payouts are still under review.
     */
    chargesEnabled: boolean('charges_enabled').notNull().default(false),

    /** Whether Stripe will pay the account out to its bank. */
    payoutsEnabled: boolean('payouts_enabled').notNull().default(false),

    /** Whether the seller has finished Stripe's onboarding form. */
    detailsSubmitted: boolean('details_submitted').notNull().default(false),
    defaultCurrency: currencyEnum('default_currency'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    /**
     * When the API last wrote Stripe's state onto this row. No trigger keeps it
     * fresh, unlike `release_comments`: this row has no untrusted writer to
     * guard against, so the webhook handler sets it as it syncs.
     */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // every account belongs to exactly one seller
    check(
      'payout_accounts_one_owner',
      sql`num_nonnulls(${table.artistId}, ${table.designerUserId}) = 1`,
    ),
    // no anon read, no write policy for anyone: sellers read their own
    // account's status, and only `service_role` can write it
    pgPolicy('Sellers can read their payout account', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.designerUserId} OR public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents a seller's connected Stripe account.
 * The type returned by a select query to the payoutAccounts table.
 */
export type PayoutAccount = typeof payoutAccounts.$inferSelect;

/**
 * The type used to insert a new payout account.
 */
export type NewPayoutAccount = typeof payoutAccounts.$inferInsert;
