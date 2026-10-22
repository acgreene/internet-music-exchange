import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '@ime/env';

/** Everything the demo stores lives under this prefix. */
export const DEMO_PREFIX = 'demo/';

/**
 * The demo's files in the R2 bucket the API reads.
 */
export class DemoStorage {
  public readonly bucket = env.R2_BUCKET;
  private readonly client = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  public async put(
    key: string,
    body: string | Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /** Copy an object inside the bucket, without downloading it. */
  public async copy(from: string, to: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${from}`,
        Key: to,
      }),
    );
  }

  /** Delete everything under the demo prefix. */
  public async deleteAll(): Promise<number> {
    let deleted = 0;
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: DEMO_PREFIX,
          ContinuationToken: token,
        }),
      );
      const keys = (page.Contents ?? []).flatMap((object) =>
        object.Key ? [{ Key: object.Key }] : [],
      );
      if (keys.length) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys, Quiet: true },
          }),
        );
        deleted += keys.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }
}

/** Run tasks with at most `limit` at once, reporting progress. */
export async function inParallel<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
  label: string,
): Promise<void> {
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      for (let attempt = 1; ; attempt++) {
        try {
          await task(item);
          break;
        } catch (error) {
          if (attempt >= 4) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
      done++;
      if (done % 250 === 0 || done === items.length) {
        process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  if (items.length) process.stdout.write('\n');
}
