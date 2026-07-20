import { sql } from 'drizzle-orm';
import { index, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { artists } from './artists';

/**
 * Table of songs or musical tracks.
 */
export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    artistId: uuid('artist_id')
      .notNull()
      .references(
        () => artists.id,
        // prevent deletion of any artist row who still has tracks pointing at it
        { onDelete: 'restrict' },
      ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('tracks_artist_id_idx').on(table.artistId),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy('Managers can write tracks', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager(${table.artistId})`,
      withCheck: sql`public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents a song or musical track.
 * The type returned by a select query to the tracks table.
 */
export type Track = typeof tracks.$inferSelect;

/**
 * The type used to insert a new track into the tracks table.
 */
export type NewTrack = typeof tracks.$inferInsert;
