import { sql } from 'drizzle-orm';
import { date, index, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { artists } from './artists';

/**
 * Enum containing the variants of release kinds.
 */
export const releaseKindEnum = pgEnum('release_kind', [
  'single',
  'ep',
  'lp',
  'album',
  'compilation',
  'remaster',
  'soundtrack',
  'score',
  'demo',
  'other',
]);

export type ReleaseKind = (typeof releaseKindEnum.enumValues)[number];

/**
 * Table of artist releases, could be a single, EP, LP, compilation, or
 * other release kind.
 */
export const releases = pgTable(
  'releases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    artistId: uuid('artist_id')
      .notNull()
      .references(
        () => artists.id,
        // prevent deletion of any artist row who still has releases pointing at it
        { onDelete: 'restrict' },
      ),
    /** The date the music was released. */
    releasedAt: date('released_at'),

    /** The date the release was added to the database. */
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    kind: releaseKindEnum('kind').notNull(),
  },
  (table) => [
    index('releases_artist_id_idx').on(table.artistId),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy('Managers can write releases', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager(${table.artistId})`,
      withCheck: sql`public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents an artist release.
 * The type returned by a select query to the releases table.
 */
export type Release = typeof releases.$inferSelect;

/**
 * The type used to insert a new release into the releases table.
 */
export type NewRelease = typeof releases.$inferInsert;
