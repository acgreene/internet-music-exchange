import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { moderationTargetEnum, reportReasonEnum } from './reports';
import { users } from './users';

/**
 * What an admin did.
 *
 * `take_down` deletes a comment, and hides a release, product, or design.
 * `finalize_takedown` ends the window to contest a release takedown.
 * `restore` undoes a takedown. `suspend` and `unsuspend` apply to an artist or
 * a user. `clear_profile` clears an offensive username or display name.
 */
export const moderationActionKindEnum = pgEnum('moderation_action_kind', [
  'dismiss',
  'take_down',
  'finalize_takedown',
  'restore',
  'suspend',
  'unsuspend',
  'clear_profile',
]);

export type ModerationActionKind =
  (typeof moderationActionKindEnum.enumValues)[number];

/**
 * Append-only record of every admin action: who took it, on what, when, and
 * why. API-only: RLS is on with no policies.
 */
export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    adminUserId: uuid('admin_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    action: moderationActionKindEnum('action').notNull(),
    targetType: moderationTargetEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),

    /** The rule the action enforces, when it enforces one. */
    reason: reportReasonEnum('reason'),
    /** The admin's explanation, sent to the people affected. */
    note: text('note'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('moderation_actions_target_idx').on(table.targetType, table.targetId),
  ],
).enableRLS();

export type ModerationAction = typeof moderationActions.$inferSelect;
export type NewModerationAction = typeof moderationActions.$inferInsert;
