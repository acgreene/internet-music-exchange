import { Logger } from '@ime/utils';
import { runDailyJobs } from './daily-jobs';
import { runTranscoding } from './transcoding';

/**
 * The background worker: transcoding uploads and funding's daily work, side
 * by side, until it is stopped.
 */
const log = new Logger('worker');

const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log.info(`${signal} received, finishing current work`);
    stop.abort();
  });
}

Promise.all([runTranscoding(stop.signal), runDailyJobs(stop.signal)]).then(
  () => process.exit(0),
  (error) => {
    log.error('worker crashed', error);
    process.exit(1);
  },
);
