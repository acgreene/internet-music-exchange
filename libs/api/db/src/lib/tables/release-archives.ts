import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { releases } from './releases';

/**
 * A whole release's original files in one zip, built by the worker when an
 * owner first asks for it and kept while owners keep downloading it.
 *
 * `fingerprint` names the tracks and files the zip holds, in running order,
 * so editing the tracklist or replacing a file asks for a new zip rather than
 * serving a stale one. A row is pending until `ready_at` is set.
 *
 * API-only: RLS is on with no policies.
 */
export const releaseArchives = pgTable(
  'release_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),

    /** Where the finished zip is, once it is built. */
    bucket: text('bucket'),
    objectKey: text('object_key'),
    byteSize: bigint('byte_size', { mode: 'number' }),

    /** The last time an owner asked for it, so unused zips can be cleared. */
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('release_archives_release_id_fingerprint_unique').on(
      table.releaseId,
      table.fingerprint,
    ),
    // the worker's queue: zips asked for and not built yet
    index('release_archives_pending_idx')
      .on(table.requestedAt)
      .where(sql`${table.readyAt} IS NULL`),
    check(
      'release_archives_ready_has_object',
      sql`${table.readyAt} IS NULL OR (${table.bucket} IS NOT NULL AND ${table.objectKey} IS NOT NULL AND ${table.byteSize} > 0)`,
    ),
  ],
).enableRLS();

export type ReleaseArchive = typeof releaseArchives.$inferSelect;

export type NewReleaseArchive = typeof releaseArchives.$inferInsert;
