import { DatabaseRepository, type ReleaseDesignDetails } from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  HttpStatus,
  type ArtistPageCustomization,
  type ArtistPagePrice,
  type ArtistPageRenderResponse,
} from '@ime/models';
import { CloudStorageService } from '../storage';

/** Long enough to load the page, short enough that a leaked link soon dies. */
const URL_EXPIRY_SECONDS = 300;

/** A release with no pricing row still has to render as something. */
const UNPRICED: ArtistPagePrice = {
  mode: 'free',
  currency: null,
  minimumPrice: null,
  suggestedPrice: null,
};

/**
 * Assembles what a client needs to render a release page: the release data,
 * and when the artist applied a design, a short-lived URL to its bundle and
 * their slot values. A release without a design renders in the default
 * layout.
 *
 * A design is third-party code, so it receives only what is mapped here:
 * never database rows, and every file through a signed URL.
 */
export class ArtistPageService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
  ) {}

  /**
   * @throws ApiError 404 unless the release is published by an artist who is
   * not suspended or off sale.
   */
  public async renderRelease(
    releaseId: string,
  ): Promise<ArtistPageRenderResponse> {
    const release = await this.db.releases.getWithArtist(releaseId);
    const artist = release && (await this.db.artists.getById(release.artistId));

    if (
      !release ||
      release.status !== 'published' ||
      !artist ||
      artist.suspendedAt ||
      artist.offSaleAt
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Release not found.',
      );
    }

    const [trackRows, pricing, cover, design] = await Promise.all([
      this.db.releases.listTracks(releaseId),
      this.db.releases.getPricing(releaseId),
      this.db.releaseAssets.getCover(releaseId),
      this.db.designs.getReleaseDesign(releaseId),
    ]);

    return {
      bundleUrl: design ? await this.signedUrl(design.objectKey) : null,
      payload: {
        release: {
          id: release.id,
          title: release.title,
          artistName: release.artistName,
          coverUrl: cover ? await this.signedUrl(cover.objectKey) : null,
          tracks: trackRows.map((track) => ({
            position: track.position,
            title: track.title,
            durationMs: track.durationMs,
          })),
          price: pricing
            ? {
                mode: pricing.mode,
                currency: pricing.currency,
                minimumPrice: pricing.minimumPrice,
                suggestedPrice: pricing.suggestedPrice,
              }
            : UNPRICED,
        },
        customization: design ? await this.customization(design) : {},
      },
    };
  }

  /**
   * The artist's slot values as the design reads them: text as written, and
   * each image slot's uploaded image as a signed URL. Values for slots the
   * version does not have are left out.
   */
  private async customization(
    design: ReleaseDesignDetails,
  ): Promise<ArtistPageCustomization> {
    const values: ArtistPageCustomization = {};
    for (const slot of design.slots) {
      const value = design.customization[slot.name];
      if (value === undefined) continue;
      if (slot.kind === 'text') {
        values[slot.name] = value;
        continue;
      }
      const image = await this.db.designs.getReleaseDesignImage(value);
      if (image) values[slot.name] = await this.signedUrl(image.objectKey);
    }
    return values;
  }

  private signedUrl(objectKey: string): Promise<string> {
    return this.storage.getObjectSignedUrl(objectKey, URL_EXPIRY_SECONDS);
  }
}
