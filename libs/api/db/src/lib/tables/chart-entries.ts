import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { releases } from './releases';

/**
 * One release's place on a weekly chart, best selling or most downloaded,
 * for all of IME or one genre, counting every format. Kept week by week so
 * a release's peak and its weeks on the chart can be shown; the charts
 * themselves are counted when asked for.
 *
 * API-only: RLS is on with no policies.
 */
export const chartEntries = pgTable(
  'chart_entries',
  {
    /** `selling` or `downloads`. */
    chart: text('chart').notNull(),

    /** The Monday the chart's week starts, in UTC. */
    weekStart: date('week_start').notNull(),

    /** `all`, or a genre id. */
    scope: text('scope').notNull(),

    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),

    position: integer('position').notNull(),

    /** How many people bought it, or got its download, that week. */
    people: integer('people').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chart, table.weekStart, table.scope, table.releaseId],
    }),
    // a release's history on one chart
    index('chart_entries_chart_scope_release_id_idx').on(
      table.chart,
      table.scope,
      table.releaseId,
    ),
    check(
      'chart_entries_chart_known',
      sql`${table.chart} IN ('selling', 'downloads')`,
    ),
    check('chart_entries_position_positive', sql`${table.position} >= 1`),
    check('chart_entries_people_positive', sql`${table.people} >= 1`),
  ],
).enableRLS();

export type ChartEntry = typeof chartEntries.$inferSelect;
