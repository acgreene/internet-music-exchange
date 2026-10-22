import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { designs } from './designs';
import { users } from './users';

/**
 * Someone asking a designer for a custom design, sent from a design in the
 * gallery. IME passes the request on by email; the commission itself is
 * arranged between them and delivered as a private design. Kept so a
 * requester cannot flood a designer.
 *
 * API-only: RLS is on with no policies.
 */
export const commissionRequests = pgTable(
  'commission_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    designerUserId: uuid('designer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    requesterUserId: uuid('requester_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The design the request was sent from. */
    designId: uuid('design_id').references(() => designs.id, {
      onDelete: 'set null',
    }),

    message: text('message').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // how many requests someone has sent lately, and to whom
    index('commission_requests_requester_idx').on(
      table.requesterUserId,
      table.createdAt,
    ),
    check(
      'commission_requests_message_length',
      sql`length(${table.message}) BETWEEN 1 AND 2000`,
    ),
  ],
).enableRLS();

export type CommissionRequest = typeof commissionRequests.$inferSelect;
