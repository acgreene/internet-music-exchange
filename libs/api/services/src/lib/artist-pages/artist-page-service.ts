import { DatabaseRepository, type ReleaseDesignDetails } from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  type ArtistPageAsset,
  type ArtistPageCustomization,
  type ArtistPageEdition,
  type ArtistPagePrice,
  type ArtistPageRenderResponse,
  genreName,
  HttpStatus,
  isGenreId,
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

/** The physical formats a design can show as editions of the record. */
const EDITION_FORMATS = new Set(['vinyl', 'cassette', 'cd']);

/**
 * Assembles what a client needs to render a release page: the whole record
 * (its words, artwork, extras, editions, and artist), and when the artist
 * applied a design, a short-lived URL to its bundle and their slot values. A
 * release without a design renders in the default layout.
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

    const [trackRows, pricing, cover, design, assets, images, products] =
      await Promise.all([
        this.db.releases.listTracks(releaseId),
        this.db.releases.getPricing(releaseId),
        this.db.releaseAssets.getCover(releaseId),
        this.db.designs.getReleaseDesign(releaseId),
        this.db.releaseAssets.listPublicAssets(releaseId),
        this.db.artists.listImages(artist.id),
        this.db.products.listPublishedByRelease(releaseId),
      ]);
    const imageUrl = async (kind: 'avatar' | 'header') => {
      const image = images.find((candidate) => candidate.kind === kind);
      return image ? this.signedUrl(image.objectKey) : null;
    };

    return {
      bundleUrl: design ? await this.signedUrl(design.objectKey) : null,
      payload: {
        release: {
          id: release.id,
          title: release.title,
          artistName: release.artistName,
          artist: {
            name: artist.name,
            handle: artist.handle,
            city: artist.city,
            country: artist.country,
            avatarUrl: await imageUrl('avatar'),
            headerUrl: await imageUrl('header'),
          },
          kind: release.kind,
          releasedAt: release.releasedAt,
          description: release.description,
          credits: release.credits,
          genres: release.genres.filter(isGenreId).map(genreName),
          tags: release.tags,
          coverUrl: cover ? await this.signedUrl(cover.objectKey) : null,
          tracks: trackRows.map((track) => ({
            position: track.position,
            title: track.title,
            durationMs: track.durationMs,
            lyrics: track.lyrics,
            preview: track.isPreview,
          })),
          sideStarts: release.sideStarts,
          assets: await Promise.all(
            assets
              .filter((asset) => asset.kind !== 'cover')
              .map(
                async (asset): Promise<ArtistPageAsset> => ({
                  kind: asset.kind as ArtistPageAsset['kind'],
                  title: asset.title,
                  description: asset.description,
                  url: await this.signedUrl(asset.objectKey),
                  mimeType: asset.mimeType,
                }),
              ),
          ),
          editions: products
            .filter((product) => EDITION_FORMATS.has(product.type))
            .map(
              (product): ArtistPageEdition => ({
                format: product.type as ArtistPageEdition['format'],
                name: product.name,
                price: product.minPrice,
                currency: product.currency,
                inStock: product.totalStock > 0,
              }),
            ),
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
