import {
  type Artist,
  DatabaseRepository,
  type Product,
  type ProductListItem,
  type ProductShippingRate,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { CloudStorageService } from '../storage';

const IMAGE_URL_EXPIRY_SECONDS = 3600;

/**
 * A product in a store grid, with its lead photo.
 */
export type StoreItem = ProductListItem & { imageUrl: string | null };

/**
 * A variant as a buyer chooses it.
 */
export interface StoreVariant {
  id: string;
  /** One value per option axis, in the product's order. */
  options: string[];
  price: number;
  stock: number;
}

/**
 * The listener's product page.
 */
export interface ProductPage {
  product: Pick<
    Product,
    'id' | 'name' | 'type' | 'description' | 'currency' | 'includesDigital'
  >;
  artist: Pick<Artist, 'id' | 'name' | 'handle'>;
  /** The release this is an edition of, when it is out. */
  release: { id: string; title: string; slug: string } | null;
  /** The product's option axes, such as `['Size', 'Color']`. */
  options: string[];
  variants: StoreVariant[];
  images: {
    id: string;
    url: string;
    altText: string | null;
    variantId: string | null;
  }[];
  shippingRates: Pick<
    ProductShippingRate,
    'destination' | 'firstItemAmount' | 'additionalItemAmount'
  >[];
}

/**
 * The listener's side of merch: an artist's store and product pages. Only
 * published products from artists in good standing are shown.
 */
export class StoreService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
  ) {}

  /**
   * An artist's store, newest first.
   *
   * @throws ApiError 404 when no visible artist has that handle.
   */
  public async listStore(artistHandle: string): Promise<StoreItem[]> {
    const artist = await this.db.artists.getByHandle(artistHandle);
    if (!artist || artist.suspendedAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Artist not found.',
      );
    }
    // nothing is for sale while the artist's hosting has lapsed
    if (artist.offSaleAt) return [];

    return this.withImages(
      await this.db.products.listPublishedByArtist(artist.id),
    );
  }

  /**
   * The physical editions of a release, such as its vinyl pressing.
   */
  public async listEditions(releaseId: string): Promise<StoreItem[]> {
    const release = await this.db.releases.getById(releaseId);
    const artist = release && (await this.db.artists.getById(release.artistId));
    if (!artist || artist.suspendedAt || artist.offSaleAt) return [];

    return this.withImages(
      await this.db.products.listPublishedByRelease(releaseId),
    );
  }

  /**
   * A product page with its variants, photos, and shipping rates.
   *
   * @throws ApiError 404 unless the product is published by an artist in good
   * standing.
   */
  public async getProductPage(productId: string): Promise<ProductPage> {
    const product = await this.db.products.getById(productId);
    const artist = product && (await this.db.artists.getById(product.artistId));
    if (
      !product ||
      product.status !== 'published' ||
      !artist ||
      artist.suspendedAt ||
      artist.offSaleAt
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Product not found.',
      );
    }

    const [variants, images, rates, release] = await Promise.all([
      this.db.products.listVariants(productId),
      this.db.products.listImages(productId),
      this.db.products.listShippingRates(productId),
      product.releaseId ? this.db.releases.getById(product.releaseId) : null,
    ]);

    return {
      product: {
        id: product.id,
        name: product.name,
        type: product.type,
        description: product.description,
        currency: product.currency,
        includesDigital: product.includesDigital,
      },
      artist: { id: artist.id, name: artist.name, handle: artist.handle },
      release:
        release?.status === 'published'
          ? { id: release.id, title: release.title, slug: release.slug }
          : null,
      options: [
        product.option1Name,
        product.option2Name,
        product.option3Name,
      ].filter((name): name is string => name !== null),
      variants: variants.map((variant) => ({
        id: variant.id,
        options: [
          variant.option1Value,
          variant.option2Value,
          variant.option3Value,
        ].filter((value): value is string => value !== null),
        price: variant.price,
        stock: variant.stock,
      })),
      images: await Promise.all(
        images.map(async (image) => ({
          id: image.id,
          url: await this.signedUrl(image.objectKey),
          altText: image.altText,
          variantId: image.variantId,
        })),
      ),
      shippingRates: rates.map((rate) => ({
        destination: rate.destination,
        firstItemAmount: rate.firstItemAmount,
        additionalItemAmount: rate.additionalItemAmount,
      })),
    };
  }

  private async withImages(items: ProductListItem[]): Promise<StoreItem[]> {
    const images = new Map(
      (
        await this.db.products.listPrimaryImages(items.map((item) => item.id))
      ).map((image) => [image.productId, image.objectKey]),
    );

    return Promise.all(
      items.map(async (item) => {
        const key = images.get(item.id);
        return { ...item, imageUrl: key ? await this.signedUrl(key) : null };
      }),
    );
  }

  private signedUrl(objectKey: string): Promise<string> {
    return this.storage.getObjectSignedUrl(objectKey, IMAGE_URL_EXPIRY_SECONDS);
  }
}
