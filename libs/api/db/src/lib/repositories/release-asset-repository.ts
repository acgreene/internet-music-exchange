import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  type AudioFormat,
  type AudioVariant,
  type ReleaseAsset,
  type ReleaseAssetKind,
  releaseAssets,
  releaseTracks,
  type TrackAudioFile,
  trackAudioFiles,
  tracks,
} from '../tables';

/**
 * The asset kinds a release may hold only one of.
 */
export type CoverAssetKind = Extract<ReleaseAssetKind, 'cover' | 'back_cover'>;

/**
 * A release's cover art, carrying the release id so a batch of them can be
 * keyed back to the releases they belong to.
 */
export interface ReleaseCover {
  releaseId: string;
  bucket: string;
  objectKey: string;
  title: string | null;
}

/**
 * One stored audio file with the track it belongs to and that track's slot on
 * the release.
 */
export interface ReleaseAudioFile {
  audioFileId: string;
  trackId: string;
  trackTitle: string;
  position: number;
  variant: AudioVariant;
  format: AudioFormat;
  bucket: string;
  objectKey: string;
  byteSize: number;
}

export interface CreateAssetParams {
  releaseId: string;
  kind: ReleaseAssetKind;
  bucket: string;
  objectKey: string;
  mimeType: string;
  byteSize: number;
  title?: string | null;
  description?: string | null;
  requiresPurchase?: boolean;
  position?: number;
}

export interface SetCoverParams {
  kind: CoverAssetKind;
  bucket: string;
  objectKey: string;
  mimeType: string;
  byteSize: number;
  title?: string | null;
  description?: string | null;
}

export interface UpdateAssetParams {
  title?: string | null;
  description?: string | null;
  requiresPurchase?: boolean;
  position?: number;
}

export interface UpsertAudioFileParams {
  trackId: string;
  variant: AudioVariant;
  format: AudioFormat;
  bucket: string;
  objectKey: string;
  byteSize: number;
  sampleRateHz?: number | null;
  bitDepth?: number | null;
}

/**
 * Queries for the stored objects a release is made of: its artwork and extras,
 * and the audio files behind its tracks. Callers get the bucket and key they
 * need to sign a URL, never the object itself.
 */
export class ReleaseAssetRepository {
  constructor(private readonly db: Db) {}

  /**
   * Find a release asset by its id.
   *
   * @param assetId - The id of the asset to look up.
   * @returns The asset row, or null when no asset has that id.
   */
  public async getAssetById(assetId: string): Promise<ReleaseAsset | null> {
    const [asset] = await this.db
      .select()
      .from(releaseAssets)
      .where(eq(releaseAssets.id, assetId))
      .limit(1);

    return asset ?? null;
  }

  /**
   * Read a release's front cover art.
   *
   * @param releaseId - The id of the release whose cover to read.
   * @returns The cover asset row, or null when the release has no cover.
   */
  public async getCover(releaseId: string): Promise<ReleaseAsset | null> {
    const [cover] = await this.db
      .select()
      .from(releaseAssets)
      .where(
        and(
          eq(releaseAssets.releaseId, releaseId),
          eq(releaseAssets.kind, 'cover'),
        ),
      )
      .limit(1);

    return cover ?? null;
  }

  /**
   * Read the cover art for many releases at once, so a catalog grid resolves
   * its artwork in a single query.
   *
   * @param releaseIds - The ids of the releases whose covers to read.
   * @returns One entry per release that has a cover, keyed by release id.
   * Releases without cover art are absent.
   */
  public async listCovers(releaseIds: string[]): Promise<ReleaseCover[]> {
    if (releaseIds.length === 0) return [];

    return this.db
      .select({
        releaseId: releaseAssets.releaseId,
        bucket: releaseAssets.bucket,
        objectKey: releaseAssets.objectKey,
        title: releaseAssets.title,
      })
      .from(releaseAssets)
      .where(
        and(
          inArray(releaseAssets.releaseId, releaseIds),
          eq(releaseAssets.kind, 'cover'),
        ),
      );
  }

  /**
   * List the assets on a release that anyone may see.
   *
   * @param releaseId - The id of the release whose assets to list.
   * @returns The release's ungated assets in display order.
   */
  public async listPublicAssets(releaseId: string): Promise<ReleaseAsset[]> {
    return this.db
      .select()
      .from(releaseAssets)
      .where(
        and(
          eq(releaseAssets.releaseId, releaseId),
          eq(releaseAssets.requiresPurchase, false),
        ),
      )
      .orderBy(asc(releaseAssets.position), asc(releaseAssets.createdAt));
  }

  /**
   * List every asset on a release, gated ones included, for its owners and
   * managers.
   *
   * @param releaseId - The id of the release whose assets to list.
   * @returns The release's assets in display order.
   */
  public async listAllAssets(releaseId: string): Promise<ReleaseAsset[]> {
    return this.db
      .select()
      .from(releaseAssets)
      .where(eq(releaseAssets.releaseId, releaseId))
      .orderBy(asc(releaseAssets.position), asc(releaseAssets.createdAt));
  }

  /**
   * Attach a stored object to a release as an asset.
   *
   * @param params - The release, what the asset depicts, where the object lives
   * and how it is served.
   * @returns The newly created asset row.
   */
  public async createAsset(params: CreateAssetParams): Promise<ReleaseAsset> {
    const [asset] = await this.db
      .insert(releaseAssets)
      .values(params)
      .returning();

    return asset;
  }

  /**
   * Set a release's front or back cover, replacing the one it already had.
   *
   * @param releaseId - The id of the release to set the cover on.
   * @param params - Which cover it is, where the object lives and how it is
   * served.
   * @returns The newly created cover asset row.
   */
  public async setCoverAsset(
    releaseId: string,
    params: SetCoverParams,
  ): Promise<ReleaseAsset> {
    return this.db.transaction(async (tx) => {
      // a release carries at most one cover of each kind, so the old row goes
      // before the new one lands
      await tx
        .delete(releaseAssets)
        .where(
          and(
            eq(releaseAssets.releaseId, releaseId),
            eq(releaseAssets.kind, params.kind),
          ),
        );

      const [cover] = await tx
        .insert(releaseAssets)
        .values({
          releaseId,
          kind: params.kind,
          bucket: params.bucket,
          objectKey: params.objectKey,
          mimeType: params.mimeType,
          byteSize: params.byteSize,
          title: params.title,
          description: params.description,
          requiresPurchase: false,
        })
        .returning();

      return cover;
    });
  }

  /**
   * Update an asset's caption, gating or display order.
   *
   * @param assetId - The id of the asset to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateAssetById(
    assetId: string,
    params: UpdateAssetParams,
  ): Promise<void> {
    await this.db
      .update(releaseAssets)
      .set(params)
      .where(eq(releaseAssets.id, assetId));
  }

  /**
   * Detach an asset from its release. The stored object itself is untouched.
   *
   * @param assetId - The id of the asset to delete.
   */
  public async deleteAssetById(assetId: string): Promise<void> {
    await this.db.delete(releaseAssets).where(eq(releaseAssets.id, assetId));
  }

  /**
   * Find a stored audio file by its id.
   *
   * @param audioFileId - The id of the audio file to look up.
   * @returns The audio file row, or null when no file has that id.
   */
  public async getAudioFileById(
    audioFileId: string,
  ): Promise<TrackAudioFile | null> {
    const [audioFile] = await this.db
      .select()
      .from(trackAudioFiles)
      .where(eq(trackAudioFiles.id, audioFileId))
      .limit(1);

    return audioFile ?? null;
  }

  /**
   * Resolve the object behind one track in one quality.
   *
   * @param trackId - The id of the track to read audio for.
   * @param variant - Whether to resolve the uploaded master or the transcode.
   * @returns The audio file row, or null when that variant has not been stored.
   */
  public async getAudioFile(
    trackId: string,
    variant: AudioVariant,
  ): Promise<TrackAudioFile | null> {
    const [audioFile] = await this.db
      .select()
      .from(trackAudioFiles)
      .where(
        and(
          eq(trackAudioFiles.trackId, trackId),
          eq(trackAudioFiles.variant, variant),
        ),
      )
      .limit(1);

    return audioFile ?? null;
  }

  /**
   * List every stored file for a track, so the artist hub can show upload and
   * transcode state.
   *
   * @param trackId - The id of the track whose files to list.
   * @returns The track's audio file rows.
   */
  public async listAudioFilesForTrack(
    trackId: string,
  ): Promise<TrackAudioFile[]> {
    return this.db
      .select()
      .from(trackAudioFiles)
      .where(eq(trackAudioFiles.trackId, trackId))
      .orderBy(asc(trackAudioFiles.variant));
  }

  /**
   * Resolve every object needed to serve a whole release in one quality, such
   * as building an album download.
   *
   * @param releaseId - The id of the release whose audio to resolve.
   * @param variant - Whether to resolve the uploaded masters or the transcodes.
   * @returns One entry per track that has that variant stored, in running
   * order. Tracks missing the variant are absent.
   */
  public async listAudioFilesForRelease(
    releaseId: string,
    variant: AudioVariant,
  ): Promise<ReleaseAudioFile[]> {
    return this.db
      .select({
        audioFileId: trackAudioFiles.id,
        trackId: tracks.id,
        trackTitle: tracks.title,
        position: releaseTracks.position,
        variant: trackAudioFiles.variant,
        format: trackAudioFiles.format,
        bucket: trackAudioFiles.bucket,
        objectKey: trackAudioFiles.objectKey,
        byteSize: trackAudioFiles.byteSize,
      })
      .from(releaseTracks)
      .innerJoin(tracks, eq(tracks.id, releaseTracks.trackId))
      .innerJoin(
        trackAudioFiles,
        and(
          eq(trackAudioFiles.trackId, tracks.id),
          eq(trackAudioFiles.variant, variant),
        ),
      )
      .where(eq(releaseTracks.releaseId, releaseId))
      .orderBy(asc(releaseTracks.position));
  }

  /**
   * Record a stored audio file for a track, replacing that track's existing
   * file of the same variant.
   *
   * @param params - The track, quality, format, where the object lives and what
   * probing it revealed.
   * @returns The stored audio file row.
   */
  public async upsertAudioFile(
    params: UpsertAudioFileParams,
  ): Promise<TrackAudioFile> {
    const [audioFile] = await this.db
      .insert(trackAudioFiles)
      .values(params)
      .onConflictDoUpdate({
        target: [trackAudioFiles.trackId, trackAudioFiles.variant],
        set: {
          format: params.format,
          bucket: params.bucket,
          objectKey: params.objectKey,
          byteSize: params.byteSize,
          sampleRateHz: params.sampleRateHz ?? null,
          bitDepth: params.bitDepth ?? null,
        },
      })
      .returning();

    return audioFile;
  }

  /**
   * Remove a track's stored file of one variant. The stored object itself is
   * untouched.
   *
   * @param trackId - The id of the track whose file to remove.
   * @param variant - Which quality to remove.
   */
  public async deleteAudioFile(
    trackId: string,
    variant: AudioVariant,
  ): Promise<void> {
    await this.db
      .delete(trackAudioFiles)
      .where(
        and(
          eq(trackAudioFiles.trackId, trackId),
          eq(trackAudioFiles.variant, variant),
        ),
      );
  }
}
