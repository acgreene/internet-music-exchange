import { setTimeout as sleep } from 'node:timers/promises';
import { TranscodeService } from '@ime/services';
import { Logger } from '@ime/utils';

/** How long to wait before looking again when there is nothing to do. */
const IDLE_SECONDS = 30;
const BATCH_SIZE = 10;

const log = new Logger('worker').child('transcoding');

/**
 * Make streaming copies of lossless uploads until told to stop.
 */
export async function runTranscoding(stop: AbortSignal): Promise<void> {
  const transcoder = new TranscodeService();
  // files ffmpeg could not read are skipped until the worker restarts, so a
  // corrupt upload is not retried every few seconds
  const failed = new Set<string>();

  log.info('watching for audio that needs a streaming copy');

  while (!stop.aborted) {
    const pending = (await transcoder.listPending(BATCH_SIZE)).filter(
      (original) => !failed.has(original.objectKey),
    );

    for (const original of pending) {
      if (stop.aborted) break;
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
      await sleep(IDLE_SECONDS * 1000, undefined, { signal: stop }).catch(
        () => undefined,
      );
    }
  }
}
