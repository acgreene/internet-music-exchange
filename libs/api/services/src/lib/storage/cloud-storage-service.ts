import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@ime/env';

/**
 * How long a presigned read URL stays valid, in seconds, when no override is
 * given.
 */
const DEFAULT_GET_EXPIRY_SECONDS = 300;

/**
 * Wraps object storage (Cloudflare R2, which uses the S3 API). It presigns
 * time-limited URLs to read and upload objects.
 */
export class CloudStorageService {
  constructor(
    private readonly bucket: string = env.R2_BUCKET,
    private readonly client: S3Client = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    }),
  ) {}

  /**
   * A time-limited URL to read an object by key.
   */
  public async getObjectSignedUrl(
    key: string,
    expiresInSeconds: number = DEFAULT_GET_EXPIRY_SECONDS,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  /**
   * Upload an object under a key with the given content type.
   */
  public async uploadObject(
    key: string,
    body: Uint8Array | string,
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
}
