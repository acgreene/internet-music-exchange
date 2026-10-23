import { sql } from 'drizzle-orm';
import {
  check,
  date,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { billingPeriods } from './billing-periods';
import { users } from './users';

/**
 * The inputs behind one usage line on a statement, so a seller can check the
 * math: one line per artist they pay for, or for their designs.
 */
export interface StatementLine {
  artistId: string | null;
  designerUserId: string | null;
  name: string;
  /** The seller's split of this artist, in hundredths of a percent. */
  shareBasisPoints: number;
  storageByteDays: number;
  requests: number;
  amount: number;
}

/**
 * One seller's share of one month's costs. Amounts are USD cents.
 * API-only: RLS is on with no policies.
 */
export const statements = pgTable(
  'statements',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Set null if the seller deletes their account; the record stays. */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    month: date('month')
      .notNull()
      .references(() => billingPeriods.month, { onDelete: 'restrict' }),

    usageAmount: integer('usage_amount').notNull(),
    sharedAmount: integer('shared_amount').notNull(),
    /**
     * What the reserve paid toward this seller's usage and shared costs, from
     * what it held past its target.
     */
    subsidyAmount: integer('subsidy_amount').notNull(),
    cardFeesAmount: integer('card_fees_amount').notNull(),
    totalAmount: integer('total_amount').notNull(),

    lines: jsonb('lines').$type<StatementLine[]>().notNull().default([]),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('statements_user_id_month_unique').on(table.userId, table.month),
    check(
      'statements_amounts_not_negative',
      sql`${table.usageAmount} >= 0 AND ${table.sharedAmount} >= 0 AND ${table.subsidyAmount} >= 0 AND ${table.cardFeesAmount} >= 0`,
    ),
    check(
      'statements_subsidy_within_share',
      sql`${table.subsidyAmount} <= ${table.usageAmount} + ${table.sharedAmount}`,
    ),
    check(
      'statements_total_adds_up',
      sql`${table.totalAmount} = ${table.usageAmount} + ${table.sharedAmount} - ${table.subsidyAmount} + ${table.cardFeesAmount}`,
    ),
  ],
).enableRLS();

export type Statement = typeof statements.$inferSelect;
export type NewStatement = typeof statements.$inferInsert;
