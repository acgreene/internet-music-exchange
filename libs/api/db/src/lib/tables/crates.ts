import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Who can see a crate. `private` is for its maker alone; `public` crates
 * show who made them and can be dug, followed, and featured.
 */
export const crateVisibilityEnum = pgEnum('crate_visibility', [
  'private',
  'public',
]);

export type CrateVisibility = (typeof crateVisibilityEnum.enumValues)[number];

/**
 * A list of releases someone put together, like a box of records at a store.
 *
 * API-only: RLS is on with no policies.
 */
export const crates = pgTable(
  'crates',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),

    /** A short note about what the crate is. */
    note: text('note'),

    visibility: crateVisibilityEnum('visibility').notNull().default('private'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** When its name, note, or records last changed. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('crates_owner_user_id_idx').on(table.ownerUserId),
    // public crates are listed newest first
    index('crates_visibility_updated_at_idx').on(
      table.visibility,
      table.updatedAt,
    ),
    check('crates_name_length', sql`length(${table.name}) BETWEEN 1 AND 80`),
    check(
      'crates_note_length',
      sql`${table.note} IS NULL OR length(${table.note}) BETWEEN 1 AND 500`,
    ),
  ],
).enableRLS();

export type Crate = typeof crates.$inferSelect;
export type NewCrate = typeof crates.$inferInsert;
