import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { releases } from './releases';

/**
 * What a release asset depicts.
 */
export const releaseAssetKindEnum = pgEnum('release_asset_kind', [
  'cover',
  'back_cover',
  'liner_notes',
  'photo',
  'video',
  'audio',
  'document',
  'other',
]);

export type ReleaseAssetKind = (typeof releaseAssetKindEnum.enumValues)[number];

/**
 * Artwork, photos, documents and bonus material attached to a release.
 *
 * Assets split into two groups by `requires_purchase`. Public ones — cover art
 * above all — render on the release page for anybody, so their keys are
 * readable and are expected to live in a public bucket. Gated ones ship with a
 * purchase and stay unreadable to clients; the API serves them through signed
 * URLs once it has checked entitlement.
 *
 * Writes are `service_role` only, for the same reason as the audio files: a
 * client able to set `object_key` could attach somebody else's object to its
 * own release.
 */
export const releaseAssets = pgTable(
  'release_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),

    kind: releaseAssetKindEnum('kind').notNull(),

    /** Optional caption. */
    title: text('title'),
    description: text('description'),

    /** Cloud storage bucket holding the object. Public and gated assets differ here. */
    bucket: text('bucket').notNull(),
    /** Path of the object within the bucket. */
    objectKey: text('object_key').notNull(),
    /**
     * Content type for serving. Unlike the audio files, assets carry no format
     * enum to derive this from, so it is stored rather than looked up.
     */
    mimeType: text('mime_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),

    /**
     * Whether owning the release is required to fetch this asset. Defaults to
     * true so a newly attached asset isn't public by accident.
     */
    requiresPurchase: boolean('requires_purchase').notNull().default(true),

    /** Ordering within a kind, such as a sequence of session photos. */
    position: integer('position').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('release_assets_release_id_idx').on(table.releaseId),
    // two rows must never claim the same object
    unique('release_assets_bucket_object_key_unique').on(
      table.bucket,
      table.objectKey,
    ),
    // a release can only have one front cover
    uniqueIndex('release_assets_one_cover_per_release_idx')
      .on(table.releaseId)
      .where(sql`kind = 'cover'`),
    // a release can only have one back cover
    uniqueIndex('release_assets_one_back_cover_per_release_idx')
      .on(table.releaseId)
      .where(sql`kind = 'back_cover'`),
    check('release_assets_byte_size_positive', sql`${table.byteSize} > 0`),
    check('release_assets_position_not_negative', sql`${table.position} >= 0`),
    // cover art is how a release is shown in the catalog, so it can never be
    // the thing hidden behind buying the release
    check(
      'release_assets_cover_is_public',
      sql`${table.kind} <> 'cover' OR ${table.requiresPurchase} = false`,
    ),
    check(
      'release_assets_back_cover_is_public',
      sql`${table.kind} <> 'back_cover' OR ${table.requiresPurchase} = false`,
    ),
    // public assets on a published release follow the release into the catalog
    pgPolicy('Public release assets are publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`${table.requiresPurchase} = false AND EXISTS (SELECT 1 FROM public.releases r WHERE r.id = ${table.releaseId} AND r.status = 'published')`,
    }),
    // managers see every asset on their own releases, gated or not, and while
    // the release is still a draft
    pgPolicy('Managers can read their release assets', {
      for: 'select',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
    }),
  ],
);

/**
 * Represents an asset attached to a release.
 * The type returned by a select query to the releaseAssets table.
 */
export type ReleaseAsset = typeof releaseAssets.$inferSelect;

/**
 * The type used to insert a new release asset.
 */
export type NewReleaseAsset = typeof releaseAssets.$inferInsert;
