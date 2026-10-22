import { ImeServices } from '@ime/services';
import { Logger } from '@ime/utils';
import { runDailyJobs } from './daily-jobs';
import { runTranscoding } from './transcoding';

/**
 * The background worker: transcoding uploads and funding's daily work, side
 * by side, until it is stopped.
 */
const log = new Logger('worker');
const services = new ImeServices();

const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log.info(`${signal} received, finishing current work`);
    stop.abort();
  });
}

Promise.all([
  runTranscoding(services.transcode, stop.signal),
  runDailyJobs(
    { funding: services.fundingJobs, moderation: services.moderationJobs },
    stop.signal,
  ),
]).then(
  () => process.exit(0),
  (error) => {
    log.error('worker crashed', error);
    process.exit(1);
  },
);
