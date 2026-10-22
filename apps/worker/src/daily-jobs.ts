import { setTimeout as sleep } from 'node:timers/promises';
import type { FundingJobsService } from '@ime/services';
import { Logger } from '@ime/utils';

/**
 * How often to check for daily work. Each day's work is claimed once, so
 * checking often only means it starts soon after midnight.
 */
const CHECK_MINUTES = 60;

const log = new Logger('worker').child('daily-jobs');

/**
 * Run funding's daily work (storage counts, lapse warnings, taking lapsed
 * sellers off sale, cleaning up long-off-sale files) until told to stop.
 */
export async function runDailyJobs(
  jobs: FundingJobsService,
  stop: AbortSignal,
): Promise<void> {
  log.info(`checking for daily work every ${CHECK_MINUTES} minutes`);

  while (!stop.aborted) {
    try {
      await jobs.runDaily();
    } catch (error) {
      log.error('daily work failed; it will be retried', error);
    }
    await sleep(CHECK_MINUTES * 60_000, undefined, { signal: stop }).catch(
      () => undefined,
    );
  }
}
