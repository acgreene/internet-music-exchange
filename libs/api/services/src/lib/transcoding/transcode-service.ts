import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { DatabaseRepository, type TrackAudioFile } from '@ime/db';
import { env } from '@ime/env';
import { CloudStorageService } from '../storage';

const run = promisify(execFile);

/** Every streaming copy is AAC at this bitrate. */
const STREAM_BITRATE = '256k';
const STREAM_CONTENT_TYPE = 'audio/mp4';

/**
 * Makes the streaming copy of each lossless upload: a 256 kbps AAC file that
 * streams quickly, while owners still download the original. MP3 uploads
 * stream as they are and never need one.
 *
 * Meant to run in one worker process. If two ran at once, the worst case is a
 * track transcoded twice, with the later copy kept.
 */
export class TranscodeService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly ffmpegPath: string = env.FFMPEG_PATH,
    private readonly ffprobePath: string = env.FFPROBE_PATH,
  ) {}

  /**
   * List lossless originals still waiting on a streaming copy, oldest first.
   */
  public listPending(limit: number): Promise<TrackAudioFile[]> {
    return this.db.releaseAssets.listOriginalsNeedingStreamCopy(limit);
  }

  /**
   * Make and record the streaming copy of one original. Also fills in the
   * track's duration when it is not known yet.
   *
   * @returns False when the original was replaced while this ran, so the copy
   * was thrown away.
   * @throws When ffmpeg cannot read the file.
   */
  public async transcode(original: TrackAudioFile): Promise<boolean> {
    const workDir = await mkdtemp(join(tmpdir(), 'ime-transcode-'));
    const input = join(workDir, 'original');
    const output = join(workDir, 'stream.m4a');

    try {
      await this.storage.downloadToFile(original.objectKey, input);
      // prettier-ignore
      await run(this.ffmpegPath, [
        '-v', 'error',
        '-y',
        '-i', input,
        '-map', '0:a:0',
        '-c:a', 'aac',
        '-b:a', STREAM_BITRATE,
        // lets playback start before the whole file has loaded
        '-movflags', '+faststart',
        output,
      ]);

      const folder = original.objectKey.slice(
        0,
        original.objectKey.lastIndexOf('/') + 1,
      );
      const streamKey = `${folder}stream-${randomUUID()}.m4a`;
      await this.storage.uploadFile(streamKey, output, STREAM_CONTENT_TYPE);

      // the manager may have uploaded new audio while this one transcoded
      const current = await this.db.releaseAssets.getAudioFile(
        original.trackId,
        'original',
      );
      if (current?.objectKey !== original.objectKey) {
        await this.storage.deleteObject(streamKey);
        return false;
      }

      const replaced = await this.db.releaseAssets.getAudioFile(
        original.trackId,
        'stream',
      );
      await this.db.releaseAssets.upsertAudioFile({
        trackId: original.trackId,
        variant: 'stream',
        format: 'aac',
        bucket: this.storage.bucket,
        objectKey: streamKey,
        byteSize: (await stat(output)).size,
      });
      if (replaced) await this.storage.deleteObject(replaced.objectKey);

      await this.fillInDuration(original.trackId, input);
      return true;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async fillInDuration(trackId: string, input: string): Promise<void> {
    const track = await this.db.releases.getTrackById(trackId);
    if (!track || track.durationMs !== null) return;

    // prettier-ignore
    const { stdout } = await run(this.ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      input,
    ]);
    const seconds = Number.parseFloat(stdout);
    if (Number.isFinite(seconds)) {
      await this.db.releases.updateTrackById(trackId, {
        durationMs: Math.round(seconds * 1000),
      });
    }
  }
}
