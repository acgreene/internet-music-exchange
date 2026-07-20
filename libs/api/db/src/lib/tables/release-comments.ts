import { check, index, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { releases } from './releases';

/**
 * Junction table that allows users to comment on a release.
 */
export const releaseComments = pgTable(
  'release_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    comment: text('comment').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    /**
     * Bumped by the `set_release_comment_updated_at` trigger on every update,
     * so an edited comment can be told apart from an original.
     */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // comment feeds read one release, newest first
    index('release_comments_release_id_created_at_idx').on(
      table.releaseId,
      table.createdAt,
    ),
    index('release_comments_user_id_idx').on(table.userId),
    // a comment of only whitespace carries no content
    check(
      'release_comments_comment_not_empty',
      sql`length(trim(${table.comment})) > 0`,
    ),
    // `text` is unbounded, so cap the column
    check(
      'release_comments_comment_max_length',
      sql`length(${table.comment}) <= 2000`,
    ),
    pgPolicy('Release comments are publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy('Users can fully manage comments they leave on a release', {
      for: 'all',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.userId}`,
      withCheck: sql`${authUid} = ${table.userId}`,
    }),
    pgPolicy(
      'Artist managers can remove comments from a release that belongs to an artist they manage',
      {
        for: 'delete',
        to: authenticatedRole,
        using: sql`public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = ${table.releaseId}))`,
      },
    ),
  ],
);

/**
 * Represents a comment on a release.
 * The type returned by a select query to the releaseComments table.
 */
export type ReleaseComment = typeof releaseComments.$inferSelect;

/**
 * The type used to insert a new release comment into the releaseComments table.
 */
export type NewReleaseComment = typeof releaseComments.$inferInsert;
