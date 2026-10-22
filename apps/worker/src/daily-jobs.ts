import { setTimeout as sleep } from 'node:timers/promises';
import type { FundingJobsService, ModerationJobsService } from '@ime/services';
import { Logger } from '@ime/utils';

/**
 * How often to check for daily work. Each day's work is claimed once, so
 * checking often only means it starts soon after midnight.
 */
const CHECK_MINUTES = 60;

const log = new Logger('worker').child('daily-jobs');

/**
 * Work that runs once a day, by name for the log.
 */
export interface DailyJobs {
  funding: FundingJobsService;
  moderation: ModerationJobsService;
}

/**
 * Run the daily work until told to stop: funding's (storage counts, lapse
 * warnings, taking lapsed sellers off sale, cleaning up long-off-sale files)
 * and moderation's (making uncontested copyright takedowns final). One
 * failing never holds up the others.
 */
export async function runDailyJobs(
  jobs: DailyJobs,
  stop: AbortSignal,
): Promise<void> {
  log.info(`checking for daily work every ${CHECK_MINUTES} minutes`);

  while (!stop.aborted) {
    for (const [name, job] of Object.entries(jobs)) {
      try {
        await job.runDaily();
      } catch (error) {
        log.error(`${name} daily work failed; it will be retried`, error);
      }
    }
    await sleep(CHECK_MINUTES * 60_000, undefined, { signal: stop }).catch(
      () => undefined,
    );
  }
}
