import { setTimeout as sleep } from 'node:timers/promises';
import { TranscodeService } from '@ime/services';
import { Logger } from '@ime/utils';

/** How long to wait before looking again when there is nothing to do. */
const IDLE_SECONDS = 30;
const BATCH_SIZE = 10;

const log = new Logger('transcoder');
const transcoder = new TranscodeService();

/**
 * Files ffmpeg could not read. They are skipped until the worker restarts, so a
 * corrupt upload is not retried every few seconds.
 */
const failed = new Set<string>();

const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log.info(`${signal} received, stopping after the current file`);
    stop.abort();
  });
}

async function main(): Promise<void> {
  log.info('watching for audio that needs a streaming copy');

  while (!stop.signal.aborted) {
    const pending = (await transcoder.listPending(BATCH_SIZE)).filter(
      (original) => !failed.has(original.objectKey),
    );

    for (const original of pending) {
      if (stop.signal.aborted) break;
      try {
        const kept = await transcoder.transcode(original);
        log.info(
          kept
            ? `made a streaming copy of ${original.objectKey}`
            : `discarded a copy of ${original.objectKey}; it was replaced meanwhile`,
        );
      } catch (error) {
        failed.add(original.objectKey);
        log.error(`could not transcode ${original.objectKey}`, error);
      }
    }

    if (pending.length === 0) {
      // a stop signal ends the wait early
      await sleep(IDLE_SECONDS * 1000, undefined, {
        signal: stop.signal,
      }).catch(() => undefined);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  log.error('transcoder crashed', error);
  process.exit(1);
});
