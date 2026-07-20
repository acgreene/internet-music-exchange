import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * A record of Stripe webhook events we have processed.
 */
export const stripeEvents = pgTable('stripe_events', {
  /**
   * The Stripe event id. Being the primary key is what prevents
   * re-processing the same event twice.
   */
  id: text('id').primaryKey(),

  /** The event type, i.e. `checkout.session.completed`, kept for filtering. */
  type: text('type').notNull(),

  /** The raw event, retained for reconciliation and debugging disputes. */
  payload: jsonb('payload'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS(); // enable RLS but don't use any policies so that only service_role can access

/**
 * Represents a processed Stripe webhook event.
 * The type returned by a select query to the stripeEvents table.
 */
export type StripeEvent = typeof stripeEvents.$inferSelect;

/**
 * The type used to insert a new stripe event.
 */
export type NewStripeEvent = typeof stripeEvents.$inferInsert;
