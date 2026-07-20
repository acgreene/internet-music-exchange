import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { currencyEnum } from './artist-payout-accounts';
import { releases } from './releases';
import { users } from './users';

/**
 * Lifecycle of a purchase.
 *
 * `pending` - payment started but not settled.
 * `completed` - paid and settled, the buyer's entitlement is active.
 * `refunded` - fully refunded, the entitlement is removed.
 * `failed` - payment did not go through.
 */
export const purchaseStatusEnum = pgEnum('purchase_status', [
  'pending',
  'completed',
  'refunded',
  'failed',
]);

export type PurchaseStatus = (typeof purchaseStatusEnum.enumValues)[number];

/**
 * An immutable record of a payment for a release.
 *
 * Written only by the API under `service_role`, from the Stripe webhook
 * handler. No client may write here: an insert policy for buyers would let
 * anyone record a purchase they never paid for. Buyers read their own rows for
 * receipts, and an artist's managers read sales of their releases.
 */
export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * The buyer. Nullable so deleting a buyer's account anonymizes
     * the sale instead of erasing it, keeping the artist's sales
     * history and earnings totals intact.
     */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    /**
     * What was bought. Restricted so a sold release cannot be deleted out from
     * under its own sales records.
     */
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'restrict' }),

    status: purchaseStatusEnum('status').notNull().default('pending'),

    /**
     * What the buyer actually paid, in minor units at or above the release
     * minimum, since fixed prices are a floor and buyers may overpay.
     */
    amount: integer('amount').notNull(),

    /** Currency used to make the purchase. */
    currency: currencyEnum('currency').notNull(),

    /**
     * The Stripe PaymentIntent behind this purchase. Unique, so one payment
     * cannot record two purchases even if its webhook is redelivered.
     */
    stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),

    /** When a refund was recorded, if any. */
    refundedAt: timestamp('refunded_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Set by the API as it advances the purchase through its lifecycle. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('purchases_user_id_idx').on(table.userId),
    index('purchases_release_id_idx').on(table.releaseId),
    // a purchase is a real payment. free acquisitions are entitlements, not
    // purchases, so the amount is always positive
    check('purchases_amount_positive', sql`${table.amount} > 0`),
    pgPolicy('Buyers can read their own purchases', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.userId}`,
    }),
    pgPolicy('Managers can read sales of their releases', {
      for: 'select',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
    }),
  ],
);

/**
 * Represents a payment for a release.
 * The type returned by a select query to the purchases table.
 */
export type Purchase = typeof purchases.$inferSelect;

/**
 * The type used to insert a new purchase.
 */
export type NewPurchase = typeof purchases.$inferInsert;
