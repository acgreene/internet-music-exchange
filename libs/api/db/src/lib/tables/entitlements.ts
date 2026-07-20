import { sql } from 'drizzle-orm';
import { index, pgEnum, pgPolicy, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { purchases } from './purchases';
import { releases } from './releases';
import { users } from './users';

/**
 * How a user came to own a release.
 *
 * `purchase` - paid for it, `purchase_id` links the payment.
 * `free` - acquired a free release, or named a price of zero.
 * `gift` - granted directly by the artist's managers.
 */
export const entitlementSourceEnum = pgEnum('entitlement_source', [
  'purchase',
  'free',
  'gift',
]);

export type EntitlementSource =
  (typeof entitlementSourceEnum.enumValues)[number];

/**
 * A user's ownership of a release, also called their library.
 *
 * Granted only by the API under `service_role` after a payment settles, on a
 * free acquisition, or on an artist manager's gift. A refund removes the row.
 * No client can write here since a self-insert would be a user handing
 * themselves any album.
 */
export const entitlements = pgTable(
  'entitlements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),

    source: entitlementSourceEnum('source').notNull(),

    /**
     * The purchase that granted this when `source = 'purchase'`, null for free
     * and gifted access.
     */
    purchaseId: uuid('purchase_id').references(() => purchases.id, {
      onDelete: 'set null',
    }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // one entitlement per user per release; owning it once is enough
    primaryKey({ columns: [table.userId, table.releaseId] }),
    // reverse lookup: who owns a given release
    index('entitlements_release_id_idx').on(table.releaseId),
    pgPolicy('Users can read their own library', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.userId}`,
    }),
  ],
);

/**
 * Represents a user's ownership of a release.
 * The type returned by a select query to the entitlements table.
 */
export type Entitlement = typeof entitlements.$inferSelect;

/**
 * The type used to insert a new entitlement.
 */
export type NewEntitlement = typeof entitlements.$inferInsert;
