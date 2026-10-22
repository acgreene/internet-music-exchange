import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { crates } from './crates';
import { releases } from './releases';

/**
 * A release in a crate, in the crate's order, with an optional line about
 * why it is there.
 *
 * API-only: RLS is on with no policies.
 */
export const crateReleases = pgTable(
  'crate_releases',
  {
    crateId: uuid('crate_id')
      .notNull()
      .references(() => crates.id, { onDelete: 'cascade' }),

    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),

    /** Its place in the crate, from 1. */
    position: integer('position').notNull(),

    /** Why it is in the crate, in the maker's words. */
    note: text('note'),

    addedAt: timestamp('added_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.crateId, table.releaseId] }),
    unique('crate_releases_crate_id_position_unique').on(
      table.crateId,
      table.position,
    ),
    // the crates a release appears in
    index('crate_releases_release_id_idx').on(table.releaseId),
    check('crate_releases_position_positive', sql`${table.position} >= 1`),
    check(
      'crate_releases_note_length',
      sql`${table.note} IS NULL OR length(${table.note}) BETWEEN 1 AND 280`,
    ),
  ],
).enableRLS();

export type CrateRelease = typeof crateReleases.$inferSelect;
