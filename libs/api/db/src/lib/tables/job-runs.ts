import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Scheduled work that has already been done, so it is never done twice: a
 * day's storage counted, a warning email sent. A job claims a run by its key
 * before doing it, and a run that already exists is skipped.
 *
 * API-only: RLS is on with no policies.
 */
export const jobRuns = pgTable(
  'job_runs',
  {
    /** What kind of work, such as `storage_snapshot`. */
    job: text('job').notNull(),
    /** Which run of it, such as a date or a seller and a date. */
    runKey: text('run_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.job, table.runKey] })],
).enableRLS();

export type JobRun = typeof jobRuns.$inferSelect;
