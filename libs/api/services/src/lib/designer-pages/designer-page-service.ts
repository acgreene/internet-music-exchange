import { ReleaseRepository } from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  type DesignerPageCustomization,
  type DesignerPagePrice,
  type DesignerPageRenderResponse
} from '@ime/models';
import { CloudStorageService } from '../storage';

/**
 * Tracer bullet stand in design bundle key.
 */
export const TRACER_DESIGN_BUNDLE_KEY = 'tracer/sample-design/index.html';

/**
 * How long a bundle URL stays valid.
 */
const BUNDLE_URL_EXPIRY_SECONDS = 300;

/**
 * A release with no pricing row has not been priced; a design still has to
 * render something, so it reads as free.
 */
const UNPRICED: DesignerPagePrice = {
  mode: 'free',
  currency: null,
  minimumPrice: null,
  suggestedPrice: null,
};

/**
 * Assembles everything needed to render a release as a designer page: the
 * release data the design displays, the artist's customization values, and a
 * short-lived URL to the design bundle in object storage.
 */
export class DesignerPageService {
  constructor(
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly releases: ReleaseRepository = new ReleaseRepository(),
  ) {}

  /**
   * Build the render response for a release.
   *
   * @throws ApiError when the release does not exist.
   */
  public async renderRelease(
    releaseId: string,
    bundleKey: string = TRACER_DESIGN_BUNDLE_KEY,
  ): Promise<DesignerPageRenderResponse> {
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
          // mapped field by field so database columns never leak into the
          // protocol the design sees
          price: pricing
            ? {
                mode: pricing.mode,
                currency: pricing.currency,
                minimumPrice: pricing.minimumPrice,
                suggestedPrice: pricing.suggestedPrice,
              }
            : UNPRICED,
        },
        customization: this.customizationFor(releaseId),
      },
    };
  }

  /**
   * The artist's custom values for this release designer page.
   */
  private customizationFor(releaseId: string): DesignerPageCustomization {
    void releaseId;
    return { tagline: 'pressed for the internet music exchange' };
  }
}
