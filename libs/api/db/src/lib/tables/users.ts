import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase';

/**
 * User data for IME users.
 *
 * The primary key mirrors the Supabase `auth.users` id rather than being
 * generated here. Rows are created by the `on_auth_user_created` trigger, which
 * is defined by hand in the migration because Drizzle has no trigger API.
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
    email: text('email').notNull().unique(),
    username: text('username').unique(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy('Users can read their own row', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.id}`,
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
