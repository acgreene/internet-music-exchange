import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { releases } from './releases';
import { users } from './users';

/**
 * `upheld` - the artist was right; the release is restored.
 * `rejected` - the takedown stands.
 */
export const copyrightContestOutcomeEnum = pgEnum(
  'copyright_contest_outcome',
  ['upheld', 'rejected'],
);

export type CopyrightContestOutcome =
  (typeof copyrightContestOutcomeEnum.enumValues)[number];

/**
 * An artist's challenge to a copyright takedown of one of their releases.
 * API-only: RLS is on with no policies.
 */
export const copyrightContests = pgTable(
  'copyright_contests',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),

    /** The manager who filed it. */
    contestedByUserId: uuid('contested_by_user_id').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    statement: text('statement').notNull(),

    outcome: copyrightContestOutcomeEnum('outcome'),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('copyright_contests_release_id_idx').on(table.releaseId),
    // one contest at a time per release
    uniqueIndex('copyright_contests_one_open_per_release')
      .on(table.releaseId)
      .where(sql`${table.resolvedAt} IS NULL`),
    check(
      'copyright_contests_statement_length',
      sql`length(${table.statement}) BETWEEN 1 AND 5000`,
    ),
    check(
      'copyright_contests_outcome_when_resolved',
      sql`(${table.outcome} IS NULL) = (${table.resolvedAt} IS NULL)`,
    ),
  ],
).enableRLS();

export type CopyrightContest = typeof copyrightContests.$inferSelect;
export type NewCopyrightContest = typeof copyrightContests.$inferInsert;
