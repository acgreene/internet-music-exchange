import {
  type Artist,
  DatabaseRepository,
  type Release,
  type ReleaseAsset,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { CloudStorageService } from '../storage';

const IMAGE_URL_EXPIRY_SECONDS = 3600;
/** Long enough to play a whole track from one URL. */
const PLAYBACK_URL_EXPIRY_SECONDS = 3600;
const DEFAULT_PAGE_SIZE = 24;

/**
 * An asset as a release page lists it. Gated assets are listed to everyone,
 * but only owners and managers get a URL to open them.
 */
export interface ReleasePageAsset {
  id: string;
  kind: ReleaseAsset['kind'];
  title: string | null;
  description: string | null;
  requiresPurchase: boolean;
  url: string | null;
}

/**
 * The listener's release page at `/artists/<handle>/<slug>`.
 */
export interface ReleasePage {
  release: Release;
  artist: Pick<Artist, 'id' | 'name' | 'handle'>;
  tracks: Awaited<ReturnType<DatabaseRepository['releases']['listTracks']>>;
  pricing: Awaited<ReturnType<DatabaseRepository['releases']['getPricing']>>;
  coverUrl: string | null;
  assets: ReleasePageAsset[];
  /** The viewer owns it and can stream and download everything. */
  owned: boolean;
  /** It can be bought or claimed right now. */
  onSale: boolean;
}

/**
 * The listener's side of releases: release pages, browsing and search, the
 * feed of followed artists, the library, and the URLs that stream, download,
 * and open what they may access.
 *
 * Every file served counts toward its artist's hosting usage.
 */
export class CatalogService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
  ) {}

  /**
   * Read a release page. The public sees published releases from artists in
   * good standing; owners and the artist's managers can always see it.
   *
   * @param artistHandle
   * @param slug
   * @param viewerUserId - The signed-in viewer, if any.
   * @throws ApiError 404 when the viewer cannot see the release.
   */
  public async getReleasePage(
    artistHandle: string,
    slug: string,
    viewerUserId?: string,
  ): Promise<ReleasePage> {
    const found = await this.db.releases.getBySlug(artistHandle, slug);
    const artist = found && (await this.db.artists.getById(found.artistId));
    if (!found || !artist)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Release not found.',
      );

    const access = await this.accessTo(found, artist, viewerUserId);
    if (!access.canView)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Release not found.',
      );

    const [tracks, pricing, cover, assets] = await Promise.all([
      this.db.releases.listTracks(found.id),
      this.db.releases.getPricing(found.id),
      this.db.releaseAssets.getCover(found.id),
      this.db.releaseAssets.listAllAssets(found.id),
    ]);

    const fullAccess = access.owns || access.isManager;
    const pageAssets = await Promise.all(
      assets
        .filter((asset) => asset.kind !== 'cover')
        .map(async (asset) => ({
          id: asset.id,
          kind: asset.kind,
          title: asset.title,
          description: asset.description,
          requiresPurchase: asset.requiresPurchase,
          url:
            !asset.requiresPurchase || fullAccess
              ? await this.signedUrl(asset.objectKey)
              : null,
        })),
    );

    return {
      release: found,
      artist: { id: artist.id, name: artist.name, handle: artist.handle },
      tracks,
      pricing,
      coverUrl: cover ? await this.signedUrl(cover.objectKey) : null,
      assets: pageAssets,
      owned: access.owns,
      onSale: access.onSale,
    };
  }

  /**
   * Browse the newest releases.
   */
  public async listRecent(limit = DEFAULT_PAGE_SIZE, offset = 0) {
    return this.withCovers(
      await this.db.releases.listRecentlyPublished(limit, offset),
      (release) => release.id,
    );
  }

  /**
   * Search artists by name and releases by title.
   */
  public async search(query: string) {
    const [artists, releases] = await Promise.all([
      this.db.artists.searchByName(query),
      this.db.releases.searchByTitle(query),
    ]);
    return {
      artists,
      releases: await this.withCovers(releases, (release) => release.id),
    };
  }

  /**
   * An artist's published releases, for their profile page.
   *
   * @throws ApiError 404 when no visible artist has that handle.
   */
  public async listDiscography(artistHandle: string) {
    const artist = await this.db.artists.getByHandle(artistHandle);
    if (!artist || artist.suspendedAt)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Artist not found.',
      );
    // nothing is for sale while the artist's hosting has lapsed
    if (artist.offSaleAt) return [];

    return this.withCovers(
      await this.db.releases.listPublishedByArtist(artist.id),
      (release) => release.id,
    );
  }

  /**
   * The releases a listener owns, newest first.
   */
  public async getLibrary(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ) {
    return this.withCovers(
      await this.db.entitlements.listLibrary(userId, limit, offset),
      (item) => item.releaseId,
    );
  }

  /**
   * New music from the artists a listener follows, most recently published
   * first.
   */
  public async getFeed(userId: string, limit = DEFAULT_PAGE_SIZE, offset = 0) {
    return this.withCovers(
      await this.db.social.listFeedReleases(userId, limit, offset),
      (release) => release.releaseId,
    );
  }

  /**
   * A URL that streams one track. Preview tracks of a release on sale stream
   * for anyone; everything else needs ownership.
   *
   * @throws ApiError 403 when the viewer may not stream it, 404 when the
   * release or track is not visible, 409 while the streaming copy is being
   * made.
   */
  public async getStreamUrl(
    releaseId: string,
    trackId: string,
    viewerUserId?: string,
  ): Promise<string> {
    const { release, access, track } = await this.requireTrack(
      releaseId,
      trackId,
      viewerUserId,
    );
    if (!(
      access.owns ||
      access.isManager ||
      (track.isPreview && access.onSale)
    )) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'Buy or claim this release to stream it.',
      );
    }

    // an MP3 upload streams as it is; lossless uploads stream from a copy
    const stream =
      (await this.db.releaseAssets.getAudioFile(trackId, 'stream')) ??
      (await this.db.releaseAssets.getAudioFile(trackId, 'original'));
    if (!stream || (stream.variant === 'original' && stream.format !== 'mp3')) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'This track is still being prepared for streaming.',
      );
    }

    await this.countRequest(release.artistId);
    return this.storage.getObjectSignedUrl(
      stream.objectKey,
      PLAYBACK_URL_EXPIRY_SECONDS,
    );
  }

  /**
   * A URL that downloads one track's original file, exactly as uploaded.
   *
   * @throws ApiError 403 when the viewer does not own the release.
   */
  public async getDownloadUrl(
    releaseId: string,
    trackId: string,
    viewerUserId: string,
  ): Promise<string> {
    const { release, access, track } = await this.requireTrack(
      releaseId,
      trackId,
      viewerUserId,
    );
    if (!(access.owns || access.isManager)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'Only owners can download this release.',
      );
    }

    const original = await this.db.releaseAssets.getAudioFile(
      trackId,
      'original',
    );
    if (!original) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'This track has no audio yet.',
      );
    }

    await this.countRequest(release.artistId);
    const extension = original.objectKey.split('.').pop();
    return this.storage.getObjectSignedUrl(
      original.objectKey,
      PLAYBACK_URL_EXPIRY_SECONDS,
      `${String(track.position).padStart(2, '0')} ${track.title}.${extension}`,
    );
  }

  /**
   * A URL that opens one of a release's assets. Assets reserved for owners
   * open only for owners and managers.
   *
   * @throws ApiError 403 for a reserved asset the viewer does not own, 404
   * when the release is not visible to them.
   */
  public async getAssetUrl(
    assetId: string,
    viewerUserId?: string,
  ): Promise<string> {
    const asset = await this.db.releaseAssets.getAssetById(assetId);
    const release = asset && (await this.db.releases.getById(asset.releaseId));
    const artist = release && (await this.db.artists.getById(release.artistId));
    if (!asset || !release || !artist)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Asset not found.',
      );

    const access = await this.accessTo(release, artist, viewerUserId);
    if (!access.canView)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Asset not found.',
      );
    if (asset.requiresPurchase && !(access.owns || access.isManager)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'This is included with the release for owners.',
      );
    }

    await this.countRequest(release.artistId);
    return this.storage.getObjectSignedUrl(
      asset.objectKey,
      PLAYBACK_URL_EXPIRY_SECONDS,
    );
  }

  /**
   * Work out what a viewer may do with a release.
   */
  private async accessTo(
    release: Release,
    artist: Artist,
    viewerUserId?: string,
  ) {
    const [owns, isManager] = viewerUserId
      ? await Promise.all([
          this.db.entitlements.owns(viewerUserId, release.id),
          this.db.artists.isManager(viewerUserId, release.artistId),
        ])
      : [false, false];

    const onSale =
      release.status === 'published' &&
      !artist.suspendedAt &&
      !artist.offSaleAt;

    return {
      owns,
      isManager,
      onSale,
      // owns() already leaves taken-down releases out
      canView: onSale || owns || (isManager && release.status !== 'taken_down'),
    };
  }

  private async requireTrack(
    releaseId: string,
    trackId: string,
    viewerUserId?: string,
  ) {
    const release = await this.db.releases.getById(releaseId);
    const artist = release && (await this.db.artists.getById(release.artistId));
    if (!release || !artist)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Release not found.',
      );

    const access = await this.accessTo(release, artist, viewerUserId);
    const track = access.canView
      ? (await this.db.releases.listTracks(releaseId)).find(
          (t) => t.trackId === trackId,
        )
      : undefined;
    if (!track)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Track not found.',
      );

    return { release, access, track };
  }

  /**
   * Attach a cover URL to each item in a list, looking the covers up in one
   * query.
   *
   * @param items
   * @param releaseIdOf - Which release an item is.
   */
  private async withCovers<T>(
    items: T[],
    releaseIdOf: (item: T) => string,
  ): Promise<(T & { coverUrl: string | null })[]> {
    const covers = new Map(
      (await this.db.releaseAssets.listCovers(items.map(releaseIdOf))).map(
        (cover) => [cover.releaseId, cover.objectKey],
      ),
    );

    return Promise.all(
      items.map(async (item) => {
        const key = covers.get(releaseIdOf(item));
        return { ...item, coverUrl: key ? await this.signedUrl(key) : null };
      }),
    );
  }

  private signedUrl(objectKey: string): Promise<string> {
    return this.storage.getObjectSignedUrl(objectKey, IMAGE_URL_EXPIRY_SECONDS);
  }

  /**
   * Count one served file toward the artist's usage this month.
   */
  private countRequest(artistId: string): Promise<void> {
    const month = `${new Date().toISOString().slice(0, 7)}-01`;
    return this.db.funding.addRequests(month, { artistId });
  }
}
