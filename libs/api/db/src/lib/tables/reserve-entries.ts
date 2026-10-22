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
import { contributions } from './contributions';

/**
 * `donation` - a gift to the platform.
 * `surplus` - contributions left over after a month's bills.
 * `covered_costs` - spent on a month when costs spiked, lowering shares.
 * `credited_to_sellers` - surplus handed back once the reserve was full.
 */
export const reserveEntryKindEnum = pgEnum('reserve_entry_kind', [
  'donation',
  'surplus',
  'covered_costs',
  'credited_to_sellers',
]);

export type ReserveEntryKind = (typeof reserveEntryKindEnum.enumValues)[number];

/**
 * Append-only record of money in and out of the platform reserve; its balance
 * is the sum of `amount`. Amounts are signed USD cents. Developer support never
 * passes through here.
 *
 * API-only: RLS is on with no policies.
 */
export const reserveEntries = pgTable(
  'reserve_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    kind: reserveEntryKindEnum('kind').notNull(),
    amount: integer('amount').notNull(),

    /** The billing month this belongs to, when it belongs to one. */
    month: date('month'),
    contributionId: uuid('contribution_id')
      .unique()
      .references(() => contributions.id, { onDelete: 'restrict' }),

    note: text('note'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('reserve_entries_month_idx').on(table.month),
    check(
      'reserve_entries_kind_rules',
      sql`CASE ${table.kind}
        WHEN 'donation' THEN ${table.amount} > 0 AND ${table.contributionId} IS NOT NULL
        WHEN 'surplus' THEN ${table.amount} > 0 AND ${table.month} IS NOT NULL
        ELSE ${table.amount} < 0 AND ${table.month} IS NOT NULL
      END`,
    ),
  ],
).enableRLS();

export type ReserveEntry = typeof reserveEntries.$inferSelect;
export type NewReserveEntry = typeof reserveEntries.$inferInsert;
