import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { givingDestinationEnum } from './contributions';
import { users } from './users';

/**
 * `off` - the seller tops up by hand.
 * `monthly` - a set amount is charged every month.
 * `below_threshold` - a set amount is charged whenever the balance drops below
 *   the alert threshold.
 */
export const autoTopUpModeEnum = pgEnum('auto_top_up_mode', [
  'off',
  'monthly',
  'below_threshold',
]);

export type AutoTopUpMode = (typeof autoTopUpModeEnum.enumValues)[number];

/**
 * How a seller pays their share of hosting costs: their card, alert and auto
 * top-up settings, and whether their balance has lapsed. The balance itself is
 * the sum of their `balance_entries`. Amounts are USD cents.
 *
 * API-only: RLS is on with no policies.
 */
export const sellerBilling = pgTable(
  'seller_billing',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The seller as a customer of the platform's own Stripe account. */
    stripeCustomerId: text('stripe_customer_id').notNull().unique(),
    /** The card on file. Required before anything can be put on sale. */
    stripePaymentMethodId: text('stripe_payment_method_id'),

    /** Email the seller when the balance drops below this amount. */
    alertThresholdAmount: integer('alert_threshold_amount'),
    /** Or when it drops below this percentage of their last top-up. */
    alertThresholdPercent: integer('alert_threshold_percent'),

    autoTopUpMode: autoTopUpModeEnum('auto_top_up_mode')
      .notNull()
      .default('off'),
    autoTopUpAmount: integer('auto_top_up_amount'),
    /** An optional extra added to each auto top-up. Always defaults to zero. */
    autoTopUpExtraAmount: integer('auto_top_up_extra_amount')
      .notNull()
      .default(0),
    autoTopUpExtraDestination: givingDestinationEnum(
      'auto_top_up_extra_destination',
    ),

    /**
     * When a monthly charge left the balance below zero and no top-up covered
     * it. The grace period runs from here; null while the seller is paid up.
     */
    lapsedAt: timestamp('lapsed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'seller_billing_one_alert_threshold',
      sql`${table.alertThresholdAmount} IS NULL OR ${table.alertThresholdPercent} IS NULL`,
    ),
    check(
      'seller_billing_alert_threshold_amount_positive',
      sql`${table.alertThresholdAmount} IS NULL OR ${table.alertThresholdAmount} > 0`,
    ),
    check(
      'seller_billing_alert_threshold_percent_range',
      sql`${table.alertThresholdPercent} IS NULL OR ${table.alertThresholdPercent} BETWEEN 1 AND 100`,
    ),
    // auto top-up needs an amount and a card to charge
    check(
      'seller_billing_auto_top_up_ready',
      sql`${table.autoTopUpMode} = 'off' OR (${table.autoTopUpAmount} > 0 AND ${table.stripePaymentMethodId} IS NOT NULL)`,
    ),
    // topping up below a threshold needs a threshold to watch
    check(
      'seller_billing_below_threshold_has_threshold',
      sql`${table.autoTopUpMode} <> 'below_threshold' OR ${table.alertThresholdAmount} IS NOT NULL OR ${table.alertThresholdPercent} IS NOT NULL`,
    ),
    check(
      'seller_billing_extra_has_destination',
      sql`${table.autoTopUpExtraAmount} >= 0 AND (${table.autoTopUpExtraAmount} = 0 OR ${table.autoTopUpExtraDestination} IS NOT NULL)`,
    ),
  ],
).enableRLS();

export type SellerBilling = typeof sellerBilling.$inferSelect;
export type NewSellerBilling = typeof sellerBilling.$inferInsert;
