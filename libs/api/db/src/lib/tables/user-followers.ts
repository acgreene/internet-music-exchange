import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * A listener following someone whose public crates they like, to see their
 * new ones.
 *
 * API-only: RLS is on with no policies.
 */
export const userFollowers = pgTable(
  'user_followers',
  {
    followerUserId: uuid('follower_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    followedUserId: uuid('followed_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerUserId, table.followedUserId] }),
    index('user_followers_followed_user_id_idx').on(table.followedUserId),
    check(
      'user_followers_not_self',
      sql`${table.followerUserId} <> ${table.followedUserId}`,
    ),
  ],
).enableRLS();

export type UserFollower = typeof userFollowers.$inferSelect;
