import { and, eq } from 'drizzle-orm';
import type { Db } from '../database-service';
import { jobRuns } from '../tables';

/**
 * Claims on scheduled work, so a job never does the same run twice even when
 * the worker restarts.
 */
export class JobRunRepository {
  constructor(private readonly db: Db) {}

  /**
   * Claim one run of a job.
   *
   * @param job - What kind of work.
   * @param runKey - Which run of it.
   * @returns True when this is the first claim and the caller should do the
   * work, false when it was already done.
   */
  public async claim(job: string, runKey: string): Promise<boolean> {
    const claimed = await this.db
      .insert(jobRuns)
      .values({ job, runKey })
      .onConflictDoNothing()
      .returning({ job: jobRuns.job });

    return claimed.length > 0;
  }

  /**
   * Give up a claim after the work failed, so the next attempt can retry it.
   *
   * @param job - What kind of work.
   * @param runKey - Which run of it.
   */
  public async release(job: string, runKey: string): Promise<void> {
    await this.db
      .delete(jobRuns)
      .where(and(eq(jobRuns.job, job), eq(jobRuns.runKey, runKey)));
  }
}
