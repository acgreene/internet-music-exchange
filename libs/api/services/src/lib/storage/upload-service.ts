import { randomUUID } from 'node:crypto';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import {
  CloudStorageService,
  type StoredObject,
} from './cloud-storage-service';
import { FILE_EXTENSIONS, type UploadRules } from './media-types';

/**
 * Where a client uploads a file directly, and the key to confirm it with.
 */
export interface UploadTarget {
  uploadUrl: string;
  objectKey: string;
}

/**
 * Direct uploads. A client asks for a target, sends the file straight to
 * storage so large files never pass through the API, then confirms the key.
 * Keys are handed out under a prefix the caller owns, such as one release's
 * assets, so a confirm can only claim a file uploaded for the same thing.
 */
export class UploadService {
  constructor(
    private readonly storage: CloudStorageService = new CloudStorageService(),
  ) {}

  /**
   * Hand out a key under `prefix` and a URL to upload it to.
   *
   * @param name - What the file is, such as `cover`; the key adds a random
   * suffix and the extension.
   * @throws ApiError 400 when the rules do not allow that type of file.
   */
  public async createTarget(
    prefix: string,
    name: string,
    contentType: string,
    rules: UploadRules,
  ): Promise<UploadTarget> {
    if (!rules.types.includes(contentType)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        rules.message,
      );
    }

    const objectKey = `${prefix}${name}-${randomUUID()}.${FILE_EXTENSIONS[contentType]}`;
    return {
      uploadUrl: await this.storage.getUploadSignedUrl(objectKey, contentType),
      objectKey,
    };
  }

  /**
   * Check what a client uploaded under a key from `createTarget`. A file that
   * breaks the rules is deleted.
   *
   * @throws ApiError 400 when nothing was uploaded under that prefix, or the
   * file breaks the rules.
   */
  public async confirm(
    objectKey: string,
    prefix: string,
    rules: UploadRules,
  ): Promise<StoredObject> {
    const stored = objectKey.startsWith(prefix)
      ? await this.storage.getObjectInfo(objectKey)
      : null;
    if (!stored) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'No upload was found for that key.',
      );
    }

    if (
      !rules.types.includes(stored.contentType) ||
      stored.byteSize > rules.maxBytes
    ) {
      await this.storage.deleteObject(objectKey);
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        rules.message,
      );
    }
    return stored;
  }
}
