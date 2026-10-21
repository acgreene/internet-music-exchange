import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { env } from '@ime/env';

/**
 * How long a presigned read URL stays valid, in seconds, when no override is
 * given.
 */
const DEFAULT_GET_EXPIRY_SECONDS = 300;

/**
 * How long a client has to start an upload after asking for its URL.
 */
const UPLOAD_EXPIRY_SECONDS = 900;

/**
 * What storage reports about an uploaded object.
 */
export interface StoredObject {
  byteSize: number;
  contentType: string;
}

/**
 * Wraps object storage (Cloudflare R2, which uses the S3 API). It presigns
 * time-limited URLs to read and upload objects, and uploads, inspects, and
 * deletes them.
 */
export class CloudStorageService {
  constructor(
    public readonly bucket: string = env.R2_BUCKET,
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
    downloadFilename?: string,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        // makes the browser save the file under this name instead of playing it
        ResponseContentDisposition: downloadFilename
          ? `attachment; filename="${downloadFilename.replace(/"/g, '')}"`
          : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  /**
   * A time-limited URL a client uploads one object to directly, so large files
   * never pass through the API. The client must send the same content type.
   */
  public async getUploadSignedUrl(
    key: string,
    contentType: string,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_EXPIRY_SECONDS },
    );
  }

  /**
   * Read an object's size and content type, as when confirming an upload.
   *
   * @returns What storage holds, or null when nothing was uploaded there.
   */
  public async getObjectInfo(key: string): Promise<StoredObject | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        byteSize: head.ContentLength ?? 0,
        contentType: head.ContentType ?? '',
      };
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
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

  /**
   * Download an object to a local file, streaming it so large files never sit
   * in memory.
   */
  public async downloadToFile(key: string, path: string): Promise<void> {
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    await pipeline(object.Body as Readable, createWriteStream(path));
  }

  /**
   * Upload a local file under a key with the given content type.
   */
  public async uploadFile(
    key: string,
    path: string,
    contentType: string,
  ): Promise<void> {
    await this.uploadObject(key, await readFile(path), contentType);
  }

  /**
   * Delete an object by key. Deleting one that does not exist is not an error.
   */
  public async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
