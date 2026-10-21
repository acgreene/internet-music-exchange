import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Users who can review reports and take content down. API-only: RLS is on
 * with no policies, so clients can never read or grant admin rights.
 */
export const platformAdmins = pgTable('platform_admins', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
