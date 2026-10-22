import { sql } from 'drizzle-orm';
import {
  check,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  anonRole,
  authenticatedRole,
  authUid,
  authUsers,
} from 'drizzle-orm/supabase';

/**
 * Usernames and artist handles end up in URLs, so they are lowercase letters,
 * digits, hyphens, and underscores, 3 to 30 characters, starting and ending
 * with a letter or digit. Lowercase-only also makes uniqueness case-insensitive.
 */
export const HANDLE_PATTERN = '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$';

/**
 * Public profile data for IME users.
 *
 * The primary key mirrors the Supabase `auth.users` id rather than being
 * generated here. Rows are created by the `on_auth_user_created` trigger.
 *
 * Note that user emails can be obtained via the supabase `auth.users` table.
 */
export const users = pgTable(
  'users',
  {
    /**
     * Tie each user row to its corresponding Supabase auth user entity.
     * Deleting an auth user removes the matching user row.
     */
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    username: text('username').unique(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Set by a platform admin. A suspended user keeps their library but cannot post, publish, or sell. */
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'users_username_format',
      sql`${table.username} ~ '${sql.raw(HANDLE_PATTERN)}'`,
    ),
    pgPolicy('User profiles are publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy('Users can update their own row', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.id}`,
      withCheck: sql`${authUid} = ${table.id}`,
    }),
  ],
);

/**
 * The type returned by a select query to the users table.
 */
export type User = typeof users.$inferSelect;

/**
 * The type used to insert a new user into the users table.
 */
export type NewUser = typeof users.$inferInsert;
