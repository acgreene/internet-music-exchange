import { ReleaseRepository } from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  type ArtistPageCustomization,
  type ArtistPagePrice,
  type ArtistPageRenderResponse
} from '@ime/models';
import { CloudStorageService } from '../storage';

/** Placeholder until designs are a stored record with their own bundle keys. */
export const TRACER_DESIGN_BUNDLE_KEY = 'tracer/sample-design/index.html';

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
    private readonly releases: ReleaseRepository = new ReleaseRepository(),
  ) {}

  /**
   * @throws ApiError when the release does not exist.
   */
  public async renderRelease(
    releaseId: string,
    bundleKey: string = TRACER_DESIGN_BUNDLE_KEY,
  ): Promise<ArtistPageRenderResponse> {
    const release = await this.releases.getTitleAndArtistName(releaseId);

    if (!release) {
      throw new ApiError(ApiErrorKind.Http, 404, 'Release not found.');
    }

    const [trackRows, pricing] = await Promise.all([
      this.releases.getTrackList(releaseId),
      this.releases.getPricing(releaseId),
    ]);

    const bundleUrl = await this.storage.getObjectSignedUrl(
      bundleKey,
      BUNDLE_URL_EXPIRY_SECONDS,
    );

    return {
      bundleUrl,
      payload: {
        release: {
          id: release.id,
          title: release.title,
          artistName: release.artistName,
          tracks: trackRows,
          // Mapped field by field so database columns never reach the design.
          price: pricing
            ? {
                mode: pricing.mode,
                currency: pricing.currency,
                minimumPrice: pricing.minimumPrice,
                suggestedPrice: pricing.suggestedPrice,
              }
            : UNPRICED,
        },
        customization: this.customization(),
      },
    };
  }

  /** Fixed until the artist's stored slot values exist. */
  private customization(): ArtistPageCustomization {
    return { tagline: 'pressed for the internet music exchange' };
  }
}
