import { sql } from 'drizzle-orm';
import { index, pgPolicy, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { artists } from './artists';
import { users } from './users';

/**
 * Junction table that connects users to an artist profile, allowing
 * the user to manage the artist profile.
 */
export const artistManagers = pgTable(
  'artist_managers',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // composite primary key
    primaryKey({ columns: [table.userId, table.artistId] }),
    // index by which users manage a specific artist profile
    index('artist_managers_artist_id_idx').on(table.artistId),
    // a user can see the other users that manage an artist profile that they also manage
    pgPolicy('Managers can read grants', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.userId} OR public.is_artist_manager(${table.artistId})`,
    }),
    // only an existing manager can add another.
    // the first manager is created by the `on_artist_created` trigger
    pgPolicy('Managers can add managers', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`public.is_artist_manager(${table.artistId})`,
    }),
    // a manager can remove themselves as manager or be removed by another manager
    pgPolicy('Managers can remove managers', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.userId} OR public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents a user that manages an artist profile.
 * The type returned by a select query to the artistManagers table.
 */
export type ArtistManager = typeof artistManagers.$inferSelect;

/**
 * The type used to insert a new artist manager into the artistManagers table.
 */
export type NewArtistManager = typeof artistManagers.$inferInsert;
