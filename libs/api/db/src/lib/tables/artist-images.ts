import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { artists } from './artists';

export const artistImageKindEnum = pgEnum('artist_image_kind', [
  'avatar',
  'header',
]);

export type ArtistImageKind = (typeof artistImageKindEnum.enumValues)[number];

/**
 * An artist's avatar or header image, held in a public cloud storage bucket.
 * Written only by the API, which handles the upload.
 */
export const artistImages = pgTable(
  'artist_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),

    kind: artistImageKindEnum('kind').notNull(),

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
    // one avatar and one header per artist; replacing an image replaces the row
    unique('artist_images_artist_id_kind_unique').on(
      table.artistId,
      table.kind,
    ),
    unique('artist_images_bucket_object_key_unique').on(
      table.bucket,
      table.objectKey,
    ),
    check('artist_images_byte_size_positive', sql`${table.byteSize} > 0`),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
  ],
);

export type ArtistImage = typeof artistImages.$inferSelect;
export type NewArtistImage = typeof artistImages.$inferInsert;
