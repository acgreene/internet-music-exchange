import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * `open` - usage is still being counted.
 * `closed` - statements are out and balances charged.
 */
export const billingPeriodStatusEnum = pgEnum('billing_period_status', [
  'open',
  'closed',
]);

export type BillingPeriodStatus =
  (typeof billingPeriodStatusEnum.enumValues)[number];

/**
 * One month of platform costs and how they were split. The source of the
 * public costs page. Amounts are USD cents; provider rates are in millionths
 * of a dollar, since they are fractions of a cent.
 *
 * API-only: RLS is on with no policies.
 */
export const billingPeriods = pgTable(
  'billing_periods',
  {
    /** The first day of the month. */
    month: date('month').primaryKey(),

    /** What storage costs, per GB stored for a month. */
    storageMicrodollarsPerGbMonth: integer(
      'storage_microdollars_per_gb_month',
    ).notNull(),
    /** What serving costs, per million requests. */
    requestMicrodollarsPerMillion: integer(
      'request_microdollars_per_million',
    ).notNull(),

    status: billingPeriodStatusEnum('status').notNull().default('open'),

    /** Set when the period closes. */
    sellerCount: integer('seller_count'),
    /** The month's costs that belong to no one seller. */
    sharedCostsTotal: integer('shared_costs_total'),
    /** How much of the shared costs IME's creators covered. */
    subsidyTotal: integer('subsidy_total'),
    closedAt: timestamp('closed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'billing_periods_month_is_first_day',
      sql`extract(day from ${table.month}) = 1`,
    ),
    check(
      'billing_periods_rates_not_negative',
      sql`${table.storageMicrodollarsPerGbMonth} >= 0 AND ${table.requestMicrodollarsPerMillion} >= 0`,
    ),
    // a closed period has all its totals; an open one has none yet
    check(
      'billing_periods_totals_when_closed',
      sql`CASE WHEN ${table.status} = 'closed'
        THEN ${table.closedAt} IS NOT NULL AND ${table.sellerCount} >= 0 AND ${table.sharedCostsTotal} >= 0 AND ${table.subsidyTotal} >= 0
        ELSE ${table.closedAt} IS NULL
      END`,
    ),
  ],
).enableRLS();

export type BillingPeriod = typeof billingPeriods.$inferSelect;
export type NewBillingPeriod = typeof billingPeriods.$inferInsert;

/**
 * The groups costs are shown in on the public costs page.
 * `ownership_guarantee` is the cost of keeping files listeners own online
 * after their seller stopped paying.
 */
export const platformCostCategoryEnum = pgEnum('platform_cost_category', [
  'storage_and_delivery',
  'hosting',
  'database',
  'other_services',
  'ownership_guarantee',
]);

export type PlatformCostCategory =
  (typeof platformCostCategoryEnum.enumValues)[number];

/**
 * One bill the platform paid in a month, such as the database plan.
 * API-only: RLS is on with no policies.
 */
export const platformCosts = pgTable(
  'platform_costs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    month: date('month')
      .notNull()
      .references(() => billingPeriods.month, { onDelete: 'cascade' }),

    category: platformCostCategoryEnum('category').notNull(),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('platform_costs_month_idx').on(table.month),
    check('platform_costs_amount_positive', sql`${table.amount} > 0`),
  ],
).enableRLS();

export type PlatformCost = typeof platformCosts.$inferSelect;
export type NewPlatformCost = typeof platformCosts.$inferInsert;
