import { sql } from 'drizzle-orm';
import { check, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { HANDLE_PATTERN } from './users';

/**
 * Artist profile data.
 */
export const artists = pgTable(
  'artists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),

    /** The artist's address on IME, `/artists/<handle>`. Separate from usernames. */
    handle: text('handle').notNull().unique(),

    bio: text('bio'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'artists_handle_format',
      sql`${table.handle} ~ '${sql.raw(HANDLE_PATTERN)}'`,
    ),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    /**
     * Any signed-in user may create an artist. The `on_artist_created` trigger
     * in the migration records the creator as its first manager.
     */
    pgPolicy('Authenticated can create artists', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`true`,
    }),
    pgPolicy('Managers can update their artist', {
      for: 'update',
      to: authenticatedRole,
      // `public.is_artist_manager` is defined by hand in the 0000 migration
      using: sql`public.is_artist_manager(${table.id})`,
      withCheck: sql`public.is_artist_manager(${table.id})`,
    }),
    pgPolicy('Managers can delete their artist', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`public.is_artist_manager(${table.id})`,
    }),
  ],
);

/**
 * Represents an artist profile.
 * The type returned by a select query to the artists table.
 */
export type Artist = typeof artists.$inferSelect;

/**
 * The type used to insert a new artist into the artists table.
 */
export type NewArtist = typeof artists.$inferInsert;
