import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { statements } from './statements';
import { users } from './users';

/**
 * `top_up` - the seller added money; `card_fee` records what the card
 *   processor kept.
 * `monthly_charge` - a month's statement deducted.
 * `credit` - surplus handed back once the reserve is full.
 * `withdrawal` - unused balance refunded to the seller's card.
 * `adjustment` - a correction made by an admin, with a note.
 */
export const balanceEntryKindEnum = pgEnum('balance_entry_kind', [
  'top_up',
  'monthly_charge',
  'credit',
  'withdrawal',
  'adjustment',
]);

export type BalanceEntryKind = (typeof balanceEntryKindEnum.enumValues)[number];

/**
 * Append-only record of every change to a seller's prepaid balance; the
 * balance is the sum of `amount`. Amounts are signed USD cents.
 *
 * API-only: RLS is on with no policies.
 */
export const balanceEntries = pgTable(
  'balance_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Set null if the seller deletes their account; the record stays. */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    kind: balanceEntryKindEnum('kind').notNull(),
    amount: integer('amount').notNull(),
    cardFee: integer('card_fee'),

    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
    stripeRefundId: text('stripe_refund_id').unique(),
    statementId: uuid('statement_id')
      .unique()
      .references(() => statements.id, { onDelete: 'restrict' }),

    note: text('note'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('balance_entries_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    // each kind carries the reference that proves it, and moves money the
    // right way
    check(
      'balance_entries_kind_rules',
      sql`CASE ${table.kind}
        WHEN 'top_up' THEN ${table.amount} > 0 AND ${table.stripePaymentIntentId} IS NOT NULL AND ${table.cardFee} >= 0
        WHEN 'monthly_charge' THEN ${table.amount} <= 0 AND ${table.statementId} IS NOT NULL
        WHEN 'credit' THEN ${table.amount} > 0
        WHEN 'withdrawal' THEN ${table.amount} < 0 AND ${table.stripeRefundId} IS NOT NULL
        ELSE ${table.note} IS NOT NULL
      END`,
    ),
    check(
      'balance_entries_card_fee_only_on_top_up',
      sql`${table.kind} = 'top_up' OR ${table.cardFee} IS NULL`,
    ),
  ],
).enableRLS();

export type BalanceEntry = typeof balanceEntries.$inferSelect;
export type NewBalanceEntry = typeof balanceEntries.$inferInsert;
