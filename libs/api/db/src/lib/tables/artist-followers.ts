import { index, pgPolicy, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { artists } from './artists';

/**
 * Junction table that allows users to follow an artist profile.
 */
export const artistFollowers = pgTable(
  'artist_followers',
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
    primaryKey({ columns: [table.userId, table.artistId] }),
    index('artist_followers_artist_id_idx').on(table.artistId),
    pgPolicy('Artist followers are publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy('Users can follow an artist', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${authUid} = ${table.userId}`,
    }),
    pgPolicy('Users can unfollow an artist', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.userId}`,
    }),
    pgPolicy('Artist managers can remove followers from the artist', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents a user that follows an artist profile.
 * The type returned by a select query to the artistFollowers table.
 */
export type ArtistFollower = typeof artistFollowers.$inferSelect;

/**
 * The type used to insert a new artist follower into the artistFollowers table.
 */
export type NewArtistFollower = typeof artistFollowers.$inferInsert;
