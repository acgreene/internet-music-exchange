import {
  type Artist,
  DatabaseRepository,
  type Product,
  type ProductImage,
  type ProductVariant,
  type Release,
  type ReleaseAsset,
  type Track,
  type User,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';

/**
 * Permission checks shared by every service: who is acting, whether they may
 * act at all, and whether they may act for a given artist or something that
 * belongs to one.
 */
export class AccessService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
  ) {}

  /**
   * Require a user who is not suspended, for anything that posts, publishes,
   * or sells.
   *
   * @throws ApiError 404 when the user has no profile, 403 when suspended.
   */
  public async requireActiveUser(userId: string): Promise<User> {
    const user = await this.db.users.getById(userId);
    if (!user)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'User not found.',
      );
    if (user.suspendedAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'Your account is suspended.',
      );
    }
    return user;
  }

  /**
   * Require that a user manages an artist.
   *
   * @throws ApiError 404 when the artist does not exist, 403 when the user
   * does not manage it.
   */
  public async requireManager(
    userId: string,
    artistId: string,
  ): Promise<Artist> {
    const artist = await this.db.artists.getById(artistId);
    if (!artist)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Artist not found.',
      );
    if (!(await this.db.artists.isManager(userId, artistId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'You do not manage this artist.',
      );
    }
    return artist;
  }

  /**
   * Require a platform admin.
   *
   * @throws ApiError 403 when the user is not an admin.
   */
  public async requireAdmin(userId: string): Promise<void> {
    if (!(await this.db.moderation.isAdmin(userId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'Admins only.',
      );
    }
  }

  /**
   * Require that a user manages the artist a release belongs to.
   *
   * @throws ApiError 404 when the release does not exist, 403 when the user
   * does not manage its artist.
   */
  public async requireReleaseManager(
    userId: string,
    releaseId: string,
  ): Promise<Release> {
    const release = await this.db.releases.getById(releaseId);
    if (!release) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Release not found.',
      );
    }
    await this.requireManager(userId, release.artistId);
    return release;
  }

  /**
   * Require that an artist may upload files: uploads pause while it is
   * suspended or off sale for unpaid hosting.
   *
   * @throws ApiError 403 when suspended, 409 when off sale.
   */
  public async requireUploadsAllowed(artistId: string): Promise<void> {
    const artist = await this.db.artists.getById(artistId);
    if (artist?.suspendedAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'This artist is suspended.',
      );
    }
    if (artist?.offSaleAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Uploads are paused until the hosting balance is topped up.',
      );
    }
  }

  /**
   * Require that a user manages the artist a track belongs to.
   *
   * @throws ApiError 404 when the track does not exist, 403 otherwise.
   */
  public async requireTrackManager(
    userId: string,
    trackId: string,
  ): Promise<Track> {
    const track = await this.db.releases.getTrackById(trackId);
    if (!track) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Track not found.',
      );
    }
    await this.requireManager(userId, track.artistId);
    return track;
  }

  /**
   * Require that a user manages the release an asset belongs to.
   *
   * @throws ApiError 404 when the asset does not exist, 403 otherwise.
   */
  public async requireAssetManager(
    userId: string,
    assetId: string,
  ): Promise<ReleaseAsset> {
    const asset = await this.db.releaseAssets.getAssetById(assetId);
    if (!asset) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Asset not found.',
      );
    }
    await this.requireReleaseManager(userId, asset.releaseId);
    return asset;
  }

  /**
   * Require that a user manages the artist a product belongs to.
   *
   * @throws ApiError 404 when the product does not exist, 403 otherwise.
   */
  public async requireProductManager(
    userId: string,
    productId: string,
  ): Promise<Product> {
    const product = await this.db.products.getById(productId);
    if (!product) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Product not found.',
      );
    }
    await this.requireManager(userId, product.artistId);
    return product;
  }

  /**
   * Require that a user manages the product a variant belongs to.
   *
   * @throws ApiError 404 when the variant does not exist, 403 otherwise.
   */
  public async requireVariantManager(
    userId: string,
    variantId: string,
  ): Promise<{ variant: ProductVariant; product: Product }> {
    const variant = await this.db.products.getVariantById(variantId);
    if (!variant) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Variant not found.',
      );
    }
    const product = await this.requireProductManager(userId, variant.productId);
    return { variant, product };
  }

  /**
   * Require that a user manages the product a gallery photo belongs to.
   *
   * @throws ApiError 404 when the image does not exist, 403 otherwise.
   */
  public async requireProductImageManager(
    userId: string,
    imageId: string,
  ): Promise<ProductImage> {
    const image = await this.db.products.getImageById(imageId);
    if (!image) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Image not found.',
      );
    }
    await this.requireProductManager(userId, image.productId);
    return image;
  }
}
