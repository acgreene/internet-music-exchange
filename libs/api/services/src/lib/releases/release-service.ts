import {
  type Currency,
  DatabaseRepository,
  getPostgresErrorCode,
  PostgresErrorCode,
  type PricingMode,
  type Release,
  type ReleaseAsset,
  type ReleaseAssetKind,
  type ReleaseKind,
  type Track,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';
import { ReportService } from '../moderation/report-service';
import { SellingGateService } from '../selling';
import {
  firstAvailable,
  isValidSlug,
  SLUG_MAX_LENGTH,
  toSlug,
} from '../naming/naming-utils';
import {
  CloudStorageService,
  UploadService,
  type UploadTarget,
} from '../storage';
import {
  RELEASE_ASSET_RULES,
  TRACK_AUDIO_FORMATS,
  TRACK_AUDIO_RULES,
} from '../storage/media-types';

const TITLE_MAX_LENGTH = 200;

export interface CreateReleaseInput {
  title: string;
  kind: ReleaseKind;
  releasedAt?: string | null;
}

export interface UpdateReleaseInput {
  title?: string;
  kind?: ReleaseKind;
  releasedAt?: string | null;
  slug?: string;
}

export interface PricingInput {
  mode: PricingMode;
  minimumPrice?: number;
  suggestedPrice?: number | null;
}

export interface TrackInput {
  title?: string;
  durationMs?: number | null;
}

export interface AssetInput {
  kind: ReleaseAssetKind;
  objectKey: string;
  title?: string | null;
  description?: string | null;
  requiresPurchase?: boolean;
}

export interface AssetChanges {
  title?: string | null;
  description?: string | null;
  requiresPurchase?: boolean;
  position?: number;
}

/**
 * Release authoring for an artist's managers: drafts, tracks, audio, artwork,
 * pricing, publishing, and gifting.
 *
 * Files are uploaded straight to storage. A manager asks for an upload target,
 * sends the file there, then confirms it, and only a confirmed file is
 * recorded.
 */
export class ReleaseService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly access: AccessService = new AccessService(db),
    private readonly gate: SellingGateService = new SellingGateService(db),
    private readonly uploads: UploadService = new UploadService(storage),
    private readonly reports: ReportService = new ReportService(db, access),
  ) {}

  /**
   * Start a draft release. Its slug is made from the title.
   *
   * @throws ApiError 400 for an invalid title, 403 when the user does not
   * manage the artist.
   */
  public async create(
    userId: string,
    artistId: string,
    input: CreateReleaseInput,
  ): Promise<Release> {
    await this.access.requireManager(userId, artistId);
    const title = this.validTitle(input.title);

    const slug = await firstAvailable(
      toSlug(title) || 'release',
      SLUG_MAX_LENGTH,
      async (candidate) =>
        isValidSlug(candidate) &&
        this.db.releases.isSlugAvailable(artistId, candidate),
    );

    return this.db.releases.create({
      artistId,
      title,
      slug,
      kind: input.kind,
      releasedAt: input.releasedAt,
    });
  }

  /**
   * List every release of an artist, drafts included, for its managers.
   */
  public async listForManager(
    userId: string,
    artistId: string,
  ): Promise<Release[]> {
    await this.access.requireManager(userId, artistId);
    return this.db.releases.listAllByArtist(artistId);
  }

  /**
   * Everything a manager edits on a release: its tracks and their audio, its
   * price, and its artwork and assets, and why it was taken down if it was.
   */
  public async getForManager(userId: string, releaseId: string) {
    const release = await this.access.requireReleaseManager(userId, releaseId);

    const [tracks, originals, streamCopies, pricing, assets, takedown] =
      await Promise.all([
        this.db.releases.listTracks(releaseId),
        this.db.releaseAssets.listAudioFilesForRelease(releaseId, 'original'),
        this.db.releaseAssets.listAudioFilesForRelease(releaseId, 'stream'),
        this.db.releases.getPricing(releaseId),
        this.db.releaseAssets.listAllAssets(releaseId),
        this.reports.getTakedown(release),
      ]);

    return {
      release,
      takedown,
      tracks,
      originals,
      streamCopies,
      pricing,
      assets,
    };
  }

  /**
   * Edit a release's title, kind, release date, or slug.
   *
   * @throws ApiError 400 for invalid fields, 409 when the slug is taken.
   */
  public async update(
    userId: string,
    releaseId: string,
    input: UpdateReleaseInput,
  ): Promise<Release> {
    const release = await this.access.requireReleaseManager(userId, releaseId);

    if (input.slug !== undefined) {
      if (!isValidSlug(input.slug)) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          'Slugs are lowercase words joined by hyphens, and cannot be a reserved word like "merch".',
        );
      }
      if (
        !(await this.db.releases.isSlugAvailable(
          release.artistId,
          input.slug,
          releaseId,
        ))
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'Another release by this artist uses that slug.',
        );
      }
    }

    try {
      await this.db.releases.updateById(releaseId, {
        title:
          input.title === undefined ? undefined : this.validTitle(input.title),
        kind: input.kind,
        releasedAt: input.releasedAt,
        slug: input.slug,
      });
    } catch (error) {
      if (getPostgresErrorCode(error) === PostgresErrorCode.UniqueViolation) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'Another release by this artist uses that slug.',
        );
      }
      throw error;
    }

    return (await this.db.releases.getById(releaseId)) as Release;
  }

  /**
   * Delete a draft release and its files. A release that was ever published is
   * archived instead.
   *
   * @throws ApiError 409 when the release is not a draft.
   */
  public async delete(userId: string, releaseId: string): Promise<void> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    if (release.status !== 'draft') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only drafts can be deleted. Archive a published release instead.',
      );
    }

    const [assets, originals, streamCopies] = await Promise.all([
      this.db.releaseAssets.listAllAssets(releaseId),
      this.db.releaseAssets.listAudioFilesForRelease(releaseId, 'original'),
      this.db.releaseAssets.listAudioFilesForRelease(releaseId, 'stream'),
    ]);

    try {
      await this.db.releases.deleteById(releaseId);
    } catch (error) {
      if (
        getPostgresErrorCode(error) === PostgresErrorCode.ForeignKeyViolation
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'This release has sales on record, so it can only be archived.',
        );
      }
      throw error;
    }

    for (const file of [...assets, ...originals, ...streamCopies]) {
      await this.storage.deleteObject(file.objectKey);
    }
  }

  /**
   * Set how a release is priced. Paid prices are in the artist's selling
   * currency, so the artist needs a payment account first.
   *
   * @throws ApiError 400 for an invalid price, 409 when a paid price is set
   * before the artist has a payment account.
   */
  public async setPricing(
    userId: string,
    releaseId: string,
    input: PricingInput,
  ) {
    const release = await this.access.requireReleaseManager(userId, releaseId);

    let currency: Currency | null = null;
    if (input.mode !== 'free') {
      const account = await this.db.payments.getAccountByArtistId(
        release.artistId,
      );
      if (!account?.defaultCurrency) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'Connect a payment account before setting a paid price.',
        );
      }
      currency = account.defaultCurrency;
    }

    try {
      return await this.db.releases.upsertPricing(releaseId, {
        mode: input.mode,
        currency,
        minimumPrice: input.minimumPrice,
        suggestedPrice: input.suggestedPrice,
      });
    } catch (error) {
      if (getPostgresErrorCode(error) === PostgresErrorCode.CheckViolation) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          'A fixed price must be above zero, a free release has no price, and a suggestion cannot be below the minimum.',
        );
      }
      throw error;
    }
  }

  /**
   * Publish a release. It needs at least one track with audio, cover art, and
   * a price; a paid release also needs a payment account that can take
   * charges; and the artist's hosting must be paid for.
   *
   * @throws ApiError 403 when the user or artist is suspended, 409 naming what
   * is still missing.
   */
  public async publish(userId: string, releaseId: string): Promise<Release> {
    await this.access.requireActiveUser(userId);
    const release = await this.access.requireReleaseManager(userId, releaseId);
    const artist = await this.db.artists.getById(release.artistId);

    if (release.status === 'published') return release;
    if (release.status === 'taken_down') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'This release was taken down and cannot be published.',
      );
    }
    if (artist?.suspendedAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'This artist is suspended.',
      );
    }

    const missing = await this.missingForPublish(release);
    if (missing.length > 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        `Before publishing: ${missing.join('; ')}.`,
      );
    }

    await this.db.releases.publish(releaseId);
    return (await this.db.releases.getById(releaseId)) as Release;
  }

  /**
   * Withdraw a published release from the catalog. Owners keep it.
   *
   * @throws ApiError 409 when the release is not published.
   */
  public async archive(userId: string, releaseId: string): Promise<Release> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    if (release.status !== 'published') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a published release can be archived.',
      );
    }

    await this.db.releases.archive(releaseId);
    return (await this.db.releases.getById(releaseId)) as Release;
  }

  /**
   * Add a new track to the end of a release's tracklist.
   */
  public async addTrack(
    userId: string,
    releaseId: string,
    input: { title: string; durationMs?: number | null },
  ): Promise<Track> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    const title = this.validTitle(input.title);

    return this.db.transaction(async (repos) => {
      const tracks = await repos.releases.listTracks(releaseId);
      const lastPosition = Math.max(0, ...tracks.map((t) => t.position));

      const track = await repos.releases.createTrack({
        artistId: release.artistId,
        title,
        durationMs: input.durationMs,
      });
      await repos.releases.addTrackToRelease(
        releaseId,
        track.id,
        lastPosition + 1,
      );
      return track;
    });
  }

  /**
   * Rename a track or record its duration.
   */
  public async updateTrack(
    userId: string,
    trackId: string,
    input: TrackInput,
  ): Promise<void> {
    const track = await this.access.requireTrackManager(userId, trackId);

    await this.db.releases.updateTrackById(track.id, {
      title:
        input.title === undefined ? undefined : this.validTitle(input.title),
      durationMs: input.durationMs,
    });
  }

  /**
   * Take a track off a release's tracklist. The track itself is kept.
   */
  public async removeTrack(
    userId: string,
    releaseId: string,
    trackId: string,
  ): Promise<void> {
    await this.access.requireReleaseManager(userId, releaseId);
    await this.db.releases.removeTrackFromRelease(releaseId, trackId);
  }

  /**
   * Put a release's tracks in a new running order.
   *
   * @param userId
   * @param releaseId
   * @param trackIds - Every track on the release, in the new order.
   * @throws ApiError 400 when the ids are not exactly the release's tracks.
   */
  public async reorderTracks(
    userId: string,
    releaseId: string,
    trackIds: string[],
  ): Promise<void> {
    await this.access.requireReleaseManager(userId, releaseId);

    const current = (await this.db.releases.listTracks(releaseId))
      .map((track) => track.trackId)
      .sort();
    if (
      trackIds.length !== current.length ||
      [...trackIds].sort().some((id, i) => id !== current[i])
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'The new order must list every track on the release exactly once.',
      );
    }

    await this.db.releases.reorderTracks(
      releaseId,
      trackIds.map((trackId, i) => ({ trackId, position: i + 1 })),
    );
  }

  /**
   * Let anyone stream a track without owning the release, or stop letting them.
   */
  public async setTrackPreview(
    userId: string,
    releaseId: string,
    trackId: string,
    isPreview: boolean,
  ): Promise<void> {
    await this.access.requireReleaseManager(userId, releaseId);
    await this.requireTrackOnRelease(releaseId, trackId);
    await this.db.releases.setTrackPreview(releaseId, trackId, isPreview);
  }

  /**
   * Get somewhere to upload a track's audio.
   *
   * @throws ApiError 400 when the format is not accepted.
   */
  public async createAudioUpload(
    userId: string,
    releaseId: string,
    trackId: string,
    contentType: string,
  ): Promise<UploadTarget> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    await this.access.requireUploadsAllowed(release.artistId);
    await this.requireTrackOnRelease(releaseId, trackId);
    return this.uploads.createTarget(
      this.trackPrefix(releaseId, trackId),
      'original',
      contentType,
      TRACK_AUDIO_RULES,
    );
  }

  /**
   * Record an uploaded track's audio as its original, replacing any earlier
   * one along with the streaming copy made from it.
   *
   * @throws ApiError 400 when nothing valid was uploaded to that key.
   */
  public async confirmAudioUpload(
    userId: string,
    releaseId: string,
    trackId: string,
    objectKey: string,
    durationMs?: number | null,
  ): Promise<void> {
    await this.access.requireReleaseManager(userId, releaseId);
    await this.requireTrackOnRelease(releaseId, trackId);

    const stored = await this.uploads.confirm(
      objectKey,
      this.trackPrefix(releaseId, trackId),
      TRACK_AUDIO_RULES,
    );
    const format = TRACK_AUDIO_FORMATS[stored.contentType];

    const [previous, stream] = await Promise.all([
      this.db.releaseAssets.getAudioFile(trackId, 'original'),
      this.db.releaseAssets.getAudioFile(trackId, 'stream'),
    ]);

    await this.db.transaction(async (repos) => {
      await repos.releaseAssets.upsertAudioFile({
        trackId,
        variant: 'original',
        format,
        bucket: this.storage.bucket,
        objectKey,
        byteSize: stored.byteSize,
      });
      if (durationMs !== undefined) {
        await repos.releases.updateTrackById(trackId, { durationMs });
      }
      // the streaming copy was made from the old original
      if (stream) await repos.releaseAssets.deleteAudioFile(trackId, 'stream');
    });

    // files go only once nothing points at them
    if (previous && previous.objectKey !== objectKey) {
      await this.storage.deleteObject(previous.objectKey);
    }
    if (stream) await this.storage.deleteObject(stream.objectKey);
  }

  /**
   * Get somewhere to upload artwork or another release asset.
   *
   * @throws ApiError 400 when that kind of asset cannot be that type of file.
   */
  public async createAssetUpload(
    userId: string,
    releaseId: string,
    kind: ReleaseAssetKind,
    contentType: string,
  ): Promise<UploadTarget> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    await this.access.requireUploadsAllowed(release.artistId);
    return this.uploads.createTarget(
      this.assetPrefix(releaseId),
      kind,
      contentType,
      RELEASE_ASSET_RULES[kind],
    );
  }

  /**
   * Record an uploaded asset. A new front or back cover replaces the old one.
   * Covers are always public; other assets are reserved for owners unless the
   * manager says otherwise.
   *
   * @throws ApiError 400 when nothing valid was uploaded to that key.
   */
  public async confirmAssetUpload(
    userId: string,
    releaseId: string,
    input: AssetInput,
  ): Promise<ReleaseAsset> {
    await this.access.requireReleaseManager(userId, releaseId);

    const stored = await this.uploads.confirm(
      input.objectKey,
      this.assetPrefix(releaseId),
      RELEASE_ASSET_RULES[input.kind],
    );

    const file = {
      bucket: this.storage.bucket,
      objectKey: input.objectKey,
      mimeType: stored.contentType,
      byteSize: stored.byteSize,
      title: input.title,
      description: input.description,
    };

    if (input.kind === 'cover' || input.kind === 'back_cover') {
      const assets = await this.db.releaseAssets.listAllAssets(releaseId);
      const replaced = assets.find((asset) => asset.kind === input.kind);
      const cover = await this.db.releaseAssets.setCoverAsset(releaseId, {
        ...file,
        kind: input.kind,
      });
      if (replaced) await this.storage.deleteObject(replaced.objectKey);
      return cover;
    }

    return this.db.releaseAssets.createAsset({
      ...file,
      releaseId,
      kind: input.kind,
      requiresPurchase: input.requiresPurchase,
    });
  }

  /**
   * Change an asset's caption, order, or whether only owners can open it.
   *
   * @throws ApiError 400 when trying to reserve a cover for owners.
   */
  public async updateAsset(
    userId: string,
    assetId: string,
    changes: AssetChanges,
  ): Promise<void> {
    const asset = await this.access.requireAssetManager(userId, assetId);
    if (
      changes.requiresPurchase &&
      (asset.kind === 'cover' || asset.kind === 'back_cover')
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Covers are always public.',
      );
    }

    await this.db.releaseAssets.updateAssetById(assetId, changes);
  }

  /**
   * Delete an asset and its file. A published release keeps its cover.
   *
   * @throws ApiError 409 when deleting a published release's cover.
   */
  public async deleteAsset(userId: string, assetId: string): Promise<void> {
    const asset = await this.access.requireAssetManager(userId, assetId);
    if (asset.kind === 'cover') {
      const release = await this.db.releases.getById(asset.releaseId);
      if (release?.status === 'published') {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'A published release must keep its cover. Upload a new one to replace it.',
        );
      }
    }

    await this.db.releaseAssets.deleteAssetById(assetId);
    await this.storage.deleteObject(asset.objectKey);
  }

  /**
   * Give a listener, found by username, ownership of a release.
   *
   * @throws ApiError 404 when nobody has that username, 409 when the release
   * is not out.
   */
  public async gift(
    userId: string,
    releaseId: string,
    username: string,
  ): Promise<void> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    if (release.status !== 'published' && release.status !== 'archived') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a published or archived release can be gifted.',
      );
    }

    const recipient = await this.db.users.getByUsername(username);
    if (!recipient) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'No user has that username.',
      );
    }

    await this.db.entitlements.grant({
      userId: recipient.id,
      releaseId,
      source: 'gift',
    });
  }

  private async missingForPublish(release: Release): Promise<string[]> {
    const missing: string[] = [];

    const [tracks, originals, cover, pricing] = await Promise.all([
      this.db.releases.listTracks(release.id),
      this.db.releaseAssets.listAudioFilesForRelease(release.id, 'original'),
      this.db.releaseAssets.getCover(release.id),
      this.db.releases.getPricing(release.id),
    ]);

    const withAudio = new Set(originals.map((file) => file.trackId));
    if (tracks.length === 0) {
      missing.push('add at least one track');
    } else if (tracks.some((track) => !withAudio.has(track.trackId))) {
      missing.push('upload audio for every track');
    }
    if (!cover) missing.push('upload cover art');

    if (!pricing) missing.push('set a price');

    missing.push(
      ...(await this.gate.missingToSell(
        { artistId: release.artistId },
        pricing?.currency ?? null,
      )),
    );
    return missing;
  }

  private async requireTrackOnRelease(
    releaseId: string,
    trackId: string,
  ): Promise<void> {
    const tracks = await this.db.releases.listTracks(releaseId);
    if (!tracks.some((track) => track.trackId === trackId)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'That track is not on this release.',
      );
    }
  }

  private trackPrefix(releaseId: string, trackId: string): string {
    return `releases/${releaseId}/tracks/${trackId}/`;
  }

  private assetPrefix(releaseId: string): string {
    return `releases/${releaseId}/assets/`;
  }

  private validTitle(title: string): string {
    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed.length > TITLE_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Titles are 1 to ${TITLE_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }
}
