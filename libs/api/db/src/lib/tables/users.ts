import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase';

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
  },
  (table) => [
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
