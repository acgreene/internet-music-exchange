import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * The kinds of thing that can be reported or moderated.
 */
export const moderationTargetEnum = pgEnum('moderation_target', [
  'release',
  'product',
  'comment',
  'design',
  'artist',
  'user',
]);

export type ModerationTarget = (typeof moderationTargetEnum.enumValues)[number];

export const reportReasonEnum = pgEnum('report_reason', [
  'hate_or_harassment',
  'copyright',
  'illegal_content',
  'harmful_design_code',
  'spam',
  'other',
]);

export type ReportReason = (typeof reportReasonEnum.enumValues)[number];

/**
 * `open` - waiting for an admin.
 * `dismissed` - reviewed, no action taken.
 * `actioned` - reviewed, and the item was taken down or its owner suspended.
 */
export const reportStatusEnum = pgEnum('report_status', [
  'open',
  'dismissed',
  'actioned',
]);

export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];

/**
 * A report that something breaks the rules. Signed-in users file reports
 * themselves; a rights holder without an account sends a copyright claim by
 * email, which an admin records here with the claimant's contact details.
 *
 * The target is stored by kind and id, without a foreign key, so a report
 * outlives content its author deletes. API-only: RLS is on with no policies.
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Null only for a copyright claim sent without an account. */
    reporterUserId: uuid('reporter_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    claimantName: text('claimant_name'),
    claimantEmail: text('claimant_email'),

    targetType: moderationTargetEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),

    reason: reportReasonEnum('reason').notNull(),
    note: text('note'),

    status: reportStatusEnum('status').notNull().default('open'),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // a user reports a given item once; claimants without accounts can repeat
    uniqueIndex('reports_reporter_target_unique').on(
      table.reporterUserId,
      table.targetType,
      table.targetId,
    ),
    // the admin queue reads open reports oldest first, grouped by item
    index('reports_status_created_at_idx').on(table.status, table.createdAt),
    index('reports_target_idx').on(table.targetType, table.targetId),
    check(
      'reports_reporter_or_claimant',
      sql`${table.reporterUserId} IS NOT NULL OR (${table.reason} = 'copyright' AND ${table.claimantEmail} IS NOT NULL)`,
    ),
    check(
      'reports_note_length',
      sql`${table.note} IS NULL OR length(${table.note}) <= 2000`,
    ),
    check(
      'reports_resolved_when_closed',
      sql`(${table.status} = 'open') = (${table.resolvedAt} IS NULL)`,
    ),
  ],
).enableRLS();

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
