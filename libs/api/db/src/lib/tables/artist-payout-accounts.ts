import { sql } from 'drizzle-orm';
import { boolean, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';
import { artists } from './artists';

/**
 * An artist's connected Stripe account, used to take payment for their releases
 * and to pay the artist out.
 *
 * Payments run through Stripe Connect with direct/destination charges: a buyer
 * pays the artist's connected account and Stripe handles the bank payout, so
 * the platform doesn't hold the cash. A row is created by the API when an
 * artist begins onboarding and is refreshed from Stripe's `account.updated` webhook.
 *
 * Nothing here is client writable: the flags reflect Stripe's decisions, and
 * the API writes them under `service_role`.
 */
export const artistPayoutAccounts = pgTable(
  'artist_payout_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** One connected account per artist. */
    artistId: uuid('artist_id')
      .notNull()
      .unique()
      .references(() => artists.id, { onDelete: 'cascade' }),

    /** The connected account identifier from Stripe. */
    stripeAccountId: text('stripe_account_id').notNull().unique(),

    /**
     * Whether the account can accept charges. A release cannot be listed for
     * sale until this is true. Independent of `payoutsEnabled`: Stripe can
     * clear an account to charge while its payouts are still under review.
     */
    chargesEnabled: boolean('charges_enabled').notNull().default(false),

    /** Whether Stripe will pay the account out to its bank. */
    payoutsEnabled: boolean('payouts_enabled').notNull().default(false),

    /** Whether the artist has finished Stripe's onboarding form. */
    detailsSubmitted: boolean('details_submitted').notNull().default(false),

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
    // no anon read, no write policy for anyone: managers read their own
    // account's status, and only `service_role` can write it
    pgPolicy('Managers can read their payout account', {
      for: 'select',
      to: authenticatedRole,
      using: sql`public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents an artist's connected Stripe account.
 * The type returned by a select query to the artistPayoutAccounts table.
 */
export type ArtistPayoutAccount = typeof artistPayoutAccounts.$inferSelect;

/**
 * The type used to insert a new artist payout account.
 */
export type NewArtistPayoutAccount = typeof artistPayoutAccounts.$inferInsert;
