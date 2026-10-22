import { DatabaseRepository } from '@ime/db';
import { CloudStorageService } from '../storage';

/**
 * Deletes everything a release stores: its assets, original audio, and
 * streaming copies. The rows go first, in one transaction, and the files
 * after, so nothing is ever left pointing at a missing file. Callers check
 * permission.
 */
export class ReleaseFilesService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
  ) {}

  /**
   * Delete a release's files, keeping the release itself.
   */
  public async deleteAll(releaseId: string): Promise<void> {
    const [assets, originals, streamCopies] = await Promise.all([
      this.db.releaseAssets.listAllAssets(releaseId),
      this.db.releaseAssets.listAudioFilesForRelease(releaseId, 'original'),
      this.db.releaseAssets.listAudioFilesForRelease(releaseId, 'stream'),
    ]);
    const files = [...originals, ...streamCopies];

    await this.db.transaction(async (repos) => {
      for (const asset of assets) {
        await repos.releaseAssets.deleteAssetById(asset.id);
      }
      for (const file of files) {
        await repos.releaseAssets.deleteAudioFile(file.trackId, file.variant);
      }
    });

    for (const { objectKey } of [...assets, ...files]) {
      await this.storage.deleteObject(objectKey);
    }
  }
}
