import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { artists } from './artists';

/**
 * A link on an artist's profile, such as their website or a social profile.
 * Written only by the API.
 */
export const artistLinks = pgTable(
  'artist_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),

    label: text('label').notNull(),
    url: text('url').notNull(),

    /** Ordering on the profile. */
    position: integer('position').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('artist_links_artist_id_idx').on(table.artistId),
    check(
      'artist_links_label_length',
      sql`length(${table.label}) BETWEEN 1 AND 50`,
    ),
    check(
      'artist_links_url_https',
      sql`${table.url} ~ '^https://' AND length(${table.url}) <= 2048`,
    ),
    check('artist_links_position_not_negative', sql`${table.position} >= 0`),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
  ],
);

export type ArtistLink = typeof artistLinks.$inferSelect;
export type NewArtistLink = typeof artistLinks.$inferInsert;
