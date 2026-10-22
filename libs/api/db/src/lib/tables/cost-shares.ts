import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { artists } from './artists';
import { users } from './users';

/**
 * How an artist's hosting costs are split between the managers paying them,
 * in hundredths of a percent. An artist's rows add up to 10000; the API keeps
 * that true, since a check cannot span rows. Its creator pays everything until
 * the managers agree otherwise.
 *
 * API-only: RLS is on with no policies.
 */
export const costShares = pgTable(
  'cost_shares',
  {
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    shareBasisPoints: integer('share_basis_points').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.artistId, table.userId] }),
    // a seller's statement reads every artist they pay for
    index('cost_shares_user_id_idx').on(table.userId),
    check(
      'cost_shares_basis_points_range',
      sql`${table.shareBasisPoints} BETWEEN 1 AND 10000`,
    ),
  ],
).enableRLS();

export type CostShare = typeof costShares.$inferSelect;
export type NewCostShare = typeof costShares.$inferInsert;

/**
 * A proposed new split of an artist's costs. Every manager offered a share has
 * to accept it; once all have, the offer replaces the current split. An
 * artist has at most one proposal at a time.
 *
 * API-only: RLS is on with no policies.
 */
export const costShareOffers = pgTable(
  'cost_share_offers',
  {
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    shareBasisPoints: integer('share_basis_points').notNull(),

    offeredByUserId: uuid('offered_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.artistId, table.userId] }),
    index('cost_share_offers_user_id_idx').on(table.userId),
    check(
      'cost_share_offers_basis_points_range',
      sql`${table.shareBasisPoints} BETWEEN 1 AND 10000`,
    ),
  ],
).enableRLS();

export type CostShareOffer = typeof costShareOffers.$inferSelect;
export type NewCostShareOffer = typeof costShareOffers.$inferInsert;
