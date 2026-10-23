import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { crates } from './crates';
import { users } from './users';

/**
 * Someone saving another person's public crate, the way a playlist is saved.
 * How many saves a crate has ranks it among the most saved.
 *
 * API-only: RLS is on with no policies.
 */
export const crateSaves = pgTable(
  'crate_saves',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    crateId: uuid('crate_id')
      .notNull()
      .references(() => crates.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.crateId] }),
    // counting a crate's saves reads by crate
    index('crate_saves_crate_id_idx').on(table.crateId),
  ],
).enableRLS();

export type CrateSave = typeof crateSaves.$inferSelect;
