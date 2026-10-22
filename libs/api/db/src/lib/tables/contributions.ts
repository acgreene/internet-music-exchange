import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Where money given beyond a seller's share goes.
 *
 * `platform` - into the reserve, lowering every seller's share.
 * `developers` - to the people building IME. Private: never shown publicly.
 */
export const givingDestinationEnum = pgEnum('giving_destination', [
  'platform',
  'developers',
]);

export type GivingDestination =
  (typeof givingDestinationEnum.enumValues)[number];

export const givingCadenceEnum = pgEnum('giving_cadence', [
  'one_time',
  'monthly',
]);

export type GivingCadence = (typeof givingCadenceEnum.enumValues)[number];

/**
 * `donation_page` - anyone giving on the donation page.
 * `top_up` - a seller's optional extra on a top-up or auto top-up.
 */
export const contributionSourceEnum = pgEnum('contribution_source', [
  'donation_page',
  'top_up',
]);

export type ContributionSource =
  (typeof contributionSourceEnum.enumValues)[number];

/**
 * One payment given to the platform or the developers, beyond anyone's share
 * of hosting costs. A monthly gift records a row per charge. Amounts are USD
 * cents. API-only: RLS is on with no policies.
 */
export const contributions = pgTable(
  'contributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Null for a donor without an account. */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** The donor asked not to be named. */
    isAnonymous: boolean('is_anonymous').notNull().default(false),

    destination: givingDestinationEnum('destination').notNull(),
    cadence: givingCadenceEnum('cadence').notNull(),
    source: contributionSourceEnum('source').notNull(),

    amount: integer('amount').notNull(),

    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
    /** Set for every charge of a monthly gift. */
    stripeSubscriptionId: text('stripe_subscription_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('contributions_destination_created_at_idx').on(
      table.destination,
      table.createdAt,
    ),
    check('contributions_amount_positive', sql`${table.amount} > 0`),
    check(
      'contributions_subscription_when_monthly',
      sql`(${table.cadence} = 'monthly') = (${table.stripeSubscriptionId} IS NOT NULL)`,
    ),
  ],
).enableRLS();

export type Contribution = typeof contributions.$inferSelect;
export type NewContribution = typeof contributions.$inferInsert;
