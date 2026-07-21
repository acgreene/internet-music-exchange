import { sql } from 'drizzle-orm';
import { index, pgEnum, pgPolicy, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { users } from './users';

/**
 * The surface a design is built for.
 */
export const artistPageKindEnum = pgEnum('artist_page_kind', [
  'home',
  'release',
]);

export type artistPageKind = (typeof artistPageKindEnum.enumValues)[number];

export const artistPageStatusEnum = pgEnum('artist_page_status', [
  'draft',
  'published',
  'archived',
]);

export type artistPageStatus = (typeof artistPageStatusEnum.enumValues)[number];

/**
 * A design an artist can apply to one of their pages. The bundle itself is
 * untrusted third-party code living in object storage and is served to the
 * browser through a signed URL.
 */
export const artistPages = pgTable(
  'artist_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    name: text('name').notNull(),
    description: text('description'),

    kind: artistPageKindEnum('kind').notNull(),
    status: artistPageStatusEnum('status').notNull().default('draft'),

    bucket: text('bucket').notNull(),
    objectKey: text('object_key').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // the marketplace browses by surface and availability
    index('artist_pages_kind_status_idx').on(table.kind, table.status),
    index('artist_pages_created_by_user_id_idx').on(table.createdByUserId),
    unique('artist_pages_bucket_object_key_unique').on(
      table.bucket,
      table.objectKey,
    ),
    pgPolicy('artists can read their own designs', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.createdByUserId}`,
    }),
  ],
);

export type ArtistPage = typeof artistPages.$inferSelect;
export type NewArtistPage = typeof artistPages.$inferInsert;
