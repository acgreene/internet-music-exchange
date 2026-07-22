import { DatabaseRepository } from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  type ArtistPageCustomization,
  type ArtistPagePrice,
  type ArtistPageRenderResponse
} from '@ime/models';
import { CloudStorageService } from '../storage';

/** The design a release falls back to until its artist picks one. */
export const TRACER_DESIGN_BUNDLE_KEY = 'tracer/sample-design/index.html';

/** The slot values that go with the fallback design. */
const TRACER_DESIGN_CUSTOMIZATION: ArtistPageCustomization = {
  tagline: 'pressed for the internet music exchange',
};

const BUNDLE_URL_EXPIRY_SECONDS = 300;

/** A release with no pricing row still has to render as something. */
const UNPRICED: ArtistPagePrice = {
  mode: 'free',
  currency: null,
  minimumPrice: null,
  suggestedPrice: null,
};

/**
 * Assembles what a client needs to render a release as a designer page: the
 * release data, the artist's customization, and a short-lived URL to the design
 * bundle in object storage.
 */
export class ArtistPageService {
  constructor(
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly db: DatabaseRepository = new DatabaseRepository(),
  ) {}

  /**
   * @throws ApiError when the release does not exist.
   */
  public async renderRelease(
    releaseId: string,
  ): Promise<ArtistPageRenderResponse> {
    const release = await this.db.releases.getWithArtist(releaseId);

    if (!release) {
      throw new ApiError(ApiErrorKind.Http, 404, 'Release not found.');
    }

    const [trackRows, pricing, design] = await Promise.all([
      this.db.releases.listTracks(releaseId),
      this.db.releases.getPricing(releaseId),
      this.db.artistPages.getReleasePage(releaseId),
    ]);

    const bundleUrl = await this.storage.getObjectSignedUrl(
      design?.objectKey ?? TRACER_DESIGN_BUNDLE_KEY,
      BUNDLE_URL_EXPIRY_SECONDS,
    );

    return {
      bundleUrl,
      payload: {
        release: {
          id: release.id,
          title: release.title,
          artistName: release.artistName,
          // Mapped field by field so database columns never reach the design.
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
        customization: design?.customization ?? TRACER_DESIGN_CUSTOMIZATION,
      },
    };
  }
}
