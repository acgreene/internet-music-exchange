import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { releases } from './releases';

/**
 * An image an artist uploaded to fill an image slot in their release's design.
 * Held in a public cloud storage bucket and written only by the API.
 */
export const releaseDesignImages = pgTable(
  'release_design_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),

    bucket: text('bucket').notNull(),
    objectKey: text('object_key').notNull(),
    mimeType: text('mime_type').notNull(),
    /** Counted toward the artist's storage costs. */
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('release_design_images_release_id_idx').on(table.releaseId),
    unique('release_design_images_bucket_object_key_unique').on(
      table.bucket,
      table.objectKey,
    ),
    check(
      'release_design_images_byte_size_positive',
      sql`${table.byteSize} > 0`,
    ),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM public.releases r WHERE r.id = ${table.releaseId} AND r.status = 'published')`,
    }),
  ],
);

export type ReleaseDesignImage = typeof releaseDesignImages.$inferSelect;
export type NewReleaseDesignImage = typeof releaseDesignImages.$inferInsert;
