import { sql } from 'drizzle-orm';
import { check, index, integer, pgPolicy, pgTable, primaryKey, unique, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { releases } from './releases';
import { tracks } from './tracks';

/**
 * Junction table that connects tracks to a release.
 */
export const releaseTracks = pgTable(
  'release_tracks',
  {
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),

    /** The position of the track within the release. */
    position: integer('position').notNull(),
  },
  (table) => [
    // composite primary key
    primaryKey({ columns: [table.releaseId, table.trackId] }),
    // two tracks cannot occupy the same slot on a release
    unique('release_tracks_release_id_position_unique').on(
      table.releaseId,
      table.position,
    ),
    // index by which releases include a specific track
    index('release_tracks_track_id_idx').on(table.trackId),
    // track positions are 1-based, so 0 and negatives are not valid slots
    check('release_tracks_position_positive', sql`${table.position} >= 1`),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy('Managers can write release tracks', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
      withCheck: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
    }),
  ],
);

/**
 * Represents a track that is part of a release.
 * The type returned by a select query to the releaseTracks table.
 */
export type ReleaseTrack = typeof releaseTracks.$inferSelect;

/**
 * The type used to insert a new release track into the releaseTracks table.
 */
export type NewReleaseTrack = typeof releaseTracks.$inferInsert;
