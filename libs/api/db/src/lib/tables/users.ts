import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * User data for IME users.
 *
 * The primary key mirrors the Supabase `auth.users` id rather than being
 * generated here. Rows are created by the `on_auth_user_created` trigger; the
 * foreign key to `auth.users` lives in the migration because Drizzle only
 * manages the `public` schema.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * The type returned by a query to the users table.
 */
export type User = typeof users.$inferSelect;

/**
 * The type used to insert a new user into the users table.
 */
export type NewUser = typeof users.$inferInsert;
