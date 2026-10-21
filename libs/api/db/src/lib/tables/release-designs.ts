import { sql } from 'drizzle-orm';
import { index, jsonb, pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { designVersions } from './design-versions';
import { releases } from './releases';

/**
 * The design version a release renders with, and the artist's values for its
 * slots. A release with no row falls back to the default layout.
 */
export const releaseDesigns = pgTable(
  'release_designs',
  {
    releaseId: uuid('release_id')
      .primaryKey()
      .references(() => releases.id, { onDelete: 'cascade' }),

    /** Restricted so a version cannot be deleted out from under the pages using it. */
    designVersionId: uuid('design_version_id')
      .notNull()
      .references(() => designVersions.id, { onDelete: 'restrict' }),

    /**
     * The artist's slot values, keyed by slot name. Text slots hold the text;
     * image slots hold the id of a `release_design_images` row.
     */
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
    index('release_designs_design_version_id_idx').on(table.designVersionId),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM public.releases r WHERE r.id = ${table.releaseId} AND r.status = 'published')`,
    }),
  ],
);

export type ReleaseDesign = typeof releaseDesigns.$inferSelect;
export type NewReleaseDesign = typeof releaseDesigns.$inferInsert;
