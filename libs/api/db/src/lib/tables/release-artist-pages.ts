import { sql } from 'drizzle-orm';
import { index, jsonb, pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { artistPages } from './artist-pages';
import { releases } from './releases';

/**
 * The design a release renders with, and the artist's values for that design's
 * slots. A release with no row falls back to the default layout.
 */
export const releaseArtistPages = pgTable(
  'release_artist_pages',
  {
    releaseId: uuid('release_id')
      .primaryKey()
      .references(() => releases.id, { onDelete: 'cascade' }),

    /** Restricted so a design cannot be deleted out from under the pages using it. */
    artistPageId: uuid('artist_page_id')
      .notNull()
      .references(() => artistPages.id, { onDelete: 'restrict' }),

    /** Text and asset URL overrides, keyed by the design's slot names. */
    customization: jsonb('customization')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('release_artist_pages_artist_page_id_idx').on(table.artistPageId),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM public.releases r WHERE r.id = ${table.releaseId} AND r.status = 'published')`,
    }),
    pgPolicy('Managers can write release designs', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
      withCheck: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
    }),
  ],
);

export type ReleaseArtistPage = typeof releaseArtistPages.$inferSelect;
export type NewReleaseArtistPage = typeof releaseArtistPages.$inferInsert;
