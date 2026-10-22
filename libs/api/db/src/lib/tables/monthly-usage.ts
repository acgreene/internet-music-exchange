import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { artists } from './artists';
import { users } from './users';

/**
 * What one artist's files, or one designer's designs, used in a month. A daily
 * job adds the bytes stored that day; the API counts each file it serves.
 * Priced at the period's rates when the month closes.
 *
 * API-only: RLS is on with no policies.
 */
export const monthlyUsage = pgTable(
  'monthly_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** The first day of the month. */
    month: date('month').notNull(),

    artistId: uuid('artist_id').references(() => artists.id, {
      onDelete: 'cascade',
    }),
    designerUserId: uuid('designer_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),

    /** Bytes stored, summed over each day of the month. */
    storageByteDays: bigint('storage_byte_days', { mode: 'number' })
      .notNull()
      .default(0),
    /** Files served to listeners or browsers. */
    requests: bigint('requests', { mode: 'number' }).notNull().default(0),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // one row per owner per month
    unique('monthly_usage_month_owner_unique')
      .on(table.month, table.artistId, table.designerUserId)
      .nullsNotDistinct(),
    check(
      'monthly_usage_one_owner',
      sql`num_nonnulls(${table.artistId}, ${table.designerUserId}) = 1`,
    ),
    check(
      'monthly_usage_month_is_first_day',
      sql`extract(day from ${table.month}) = 1`,
    ),
    check(
      'monthly_usage_not_negative',
      sql`${table.storageByteDays} >= 0 AND ${table.requests} >= 0`,
    ),
  ],
).enableRLS();

export type MonthlyUsage = typeof monthlyUsage.$inferSelect;
export type NewMonthlyUsage = typeof monthlyUsage.$inferInsert;
