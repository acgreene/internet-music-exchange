import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
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

/**
 * Enum containing the variants of release kinds.
 */
export const releaseKindEnum = pgEnum('release_kind', [
  'single',
  'ep',
  'lp',
  'album',
  'compilation',
  'remaster',
  'soundtrack',
  'score',
  'demo',
  'other',
]);

export type ReleaseKind = (typeof releaseKindEnum.enumValues)[number];

/**
 * Lifecycle of a release.
 *
 * `draft` - visible only to the artist's managers, still being assembled.
 * `published` - visible to everyone and available to buy.
 * `archived` - withdrawn from the public catalog. Users who already own it
 *               keep access; see the entitlement policies.
 * `taken_down` - removed by a platform admin, from the catalog and from every
 *               library. Restorable until `takedown_final_at` is set.
 */
export const releaseStatusEnum = pgEnum('release_status', [
  'draft',
  'published',
  'archived',
  'taken_down',
]);

export type ReleaseStatus = (typeof releaseStatusEnum.enumValues)[number];

/**
 * Table of artist releases, could be a single, EP, LP, compilation, or
 * other release kind.
 */
export const releases = pgTable(
  'releases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),

    /** The release's address under its artist, `/artists/<handle>/<slug>`. Made from the title. */
    slug: text('slug').notNull(),

    artistId: uuid('artist_id')
      .notNull()
      .references(
        () => artists.id,
        // prevent deletion of any artist row who still has releases pointing at it
        { onDelete: 'restrict' },
      ),
    /** The date the music was released. */
    releasedAt: date('released_at'),

    /** The date the release was added to the database. */
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    kind: releaseKindEnum('kind').notNull(),

    /**
     * New releases start as drafts so nothing reaches the public catalog
     * before its managers say so.
     */
    status: releaseStatusEnum('status').notNull().default('draft'),

    /** When the release first went public. Null while it is still a draft. */
    publishedAt: timestamp('published_at', { withTimezone: true }),

    /**
     * When a takedown could no longer be contested. From then on its purchases
     * are refunded and its files deleted.
     */
    takedownFinalAt: timestamp('takedown_final_at', { withTimezone: true }),

    /** Up to three ids from IME's genre list, most fitting first. */
    genres: text('genres')
      .array()
      .notNull()
      .default(sql`'{}'`),

    /** Free-form words for the release's sound and mood, stored lowercase. */
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'`),

    /**
     * The track positions where sides B, C, and so on begin, ascending. Empty
     * when the release is not divided into sides.
     */
    sideStarts: integer('side_starts')
      .array()
      .notNull()
      .default(sql`'{}'`),

    /** What the artist says about the release, shown on its page. */
    description: text('description'),

    /** Who played, wrote, recorded, and made it, as the artist writes it. */
    credits: text('credits'),
  },
  (table) => [
    index('releases_artist_id_idx').on(table.artistId),
    unique('releases_artist_id_slug_unique').on(table.artistId, table.slug),
    // lowercase words joined by single hyphens
    check(
      'releases_slug_format',
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${table.slug}) <= 100`,
    ),
    check(
      'releases_genres_at_most_three',
      sql`cardinality(${table.genres}) <= 3`,
    ),
    check('releases_tags_at_most_ten', sql`cardinality(${table.tags}) <= 10`),
    check(
      'releases_side_starts_at_most_25',
      sql`cardinality(${table.sideStarts}) <= 25`,
    ),
    // `text` is unbounded, so cap the columns
    check(
      'releases_description_max_length',
      sql`length(${table.description}) <= 5000`,
    ),
    check(
      'releases_credits_max_length',
      sql`length(${table.credits}) <= 5000`,
    ),
    // browsing and search find releases by any of their genres or tags
    index('releases_genres_idx').using('gin', table.genres),
    index('releases_tags_idx').using('gin', table.tags),
    // the public catalog reads by status, so keep that lookup indexed
    index('releases_status_idx').on(table.status),
    // a release that claims to be public has to say when it went public
    check(
      'releases_published_at_required_when_published',
      sql`${table.status} <> 'published' OR ${table.publishedAt} IS NOT NULL`,
    ),
    pgPolicy('Catalog is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`${table.status} = 'published'`,
    }),
    pgPolicy('Managers can write releases', {
      for: 'all',
      to: authenticatedRole,
      using: sql`public.is_artist_manager(${table.artistId})`,
      withCheck: sql`public.is_artist_manager(${table.artistId})`,
    }),
  ],
);

/**
 * Represents an artist release.
 * The type returned by a select query to the releases table.
 */
export type Release = typeof releases.$inferSelect;

/**
 * The type used to insert a new release into the releases table.
 */
export type NewRelease = typeof releases.$inferInsert;
