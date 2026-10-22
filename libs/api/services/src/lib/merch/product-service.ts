import {
  DatabaseRepository,
  getPostgresErrorCode,
  PostgresErrorCode,
  type Product,
  type ProductImage,
  type ProductShippingRate,
  type ProductType,
  type ProductVariant,
  type ShippingZone,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';
import { SellingGateService } from '../selling';
import {
  CloudStorageService,
  UploadService,
  type UploadTarget,
} from '../storage';
import { PRODUCT_IMAGE_RULES } from '../storage/media-types';

const NAME_MAX_LENGTH = 200;
const OPTION_MAX_LENGTH = 50;
/** Products have up to three option axes, such as Size, Color, and Fit. */
const MAX_OPTIONS = 3;
const IMAGE_URL_EXPIRY_SECONDS = 3600;

export interface CreateProductInput {
  name: string;
  type: ProductType;
  description?: string | null;
  /** The release this is an edition of, such as its vinyl pressing. */
  releaseId?: string | null;
  /** Buying it also grants the linked release's download. */
  includesDigital?: boolean;
  /** The axes its variants differ on, such as `['Size', 'Color']`. */
  options?: string[];
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface VariantInput {
  /** In minor units of the product's currency. */
  price: number;
  stock?: number;
  sku?: string | null;
  /** One value per option axis, in the product's order, such as `['L', 'Black']`. */
  options?: string[];
}

export type VariantChanges = Partial<Omit<VariantInput, 'stock'>>;

export interface ProductImageInput {
  objectKey: string;
  /** The variant the photo shows, when it is specific to one. */
  variantId?: string | null;
  altText?: string | null;
}

export interface ProductImageChanges {
  variantId?: string | null;
  altText?: string | null;
  position?: number;
}

export interface ShippingRateInput {
  destination: ShippingZone;
  /** What the first unit costs to ship, in minor units. */
  firstItemAmount: number;
  /** What each unit after the first costs to ship. */
  additionalItemAmount: number;
}

/**
 * Everything a manager edits on a product.
 */
export interface ManagedProduct {
  product: Product;
  variants: ProductVariant[];
  images: (ProductImage & { url: string })[];
  shippingRates: ProductShippingRate[];
}

/**
 * Merch for an artist's managers: products, their variants and stock, photos,
 * shipping rates, and publishing. Prices are in the artist's selling
 * currency, fixed when the product is created.
 */
export class ProductService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly access: AccessService = new AccessService(db),
    private readonly gate: SellingGateService = new SellingGateService(db),
    private readonly uploads: UploadService = new UploadService(storage),
  ) {}

  /**
   * Start a draft product, priced in the artist's selling currency.
   *
   * @throws ApiError 400 for invalid details, 409 before the artist has a
   * payment account.
   */
  public async create(
    userId: string,
    artistId: string,
    input: CreateProductInput,
  ): Promise<Product> {
    await this.access.requireManager(userId, artistId);
    const account = await this.db.payments.getAccountByArtistId(artistId);
    if (!account?.defaultCurrency) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Connect a payment account before creating merch.',
      );
    }
    await this.requireReleaseLink(artistId, input);
    const [option1Name, option2Name, option3Name] = this.validOptionNames(
      input.options ?? [],
    );

    return this.db.products.create({
      artistId,
      name: this.validName(input.name),
      type: input.type,
      currency: account.defaultCurrency,
      description: input.description?.trim() || null,
      releaseId: input.releaseId,
      includesDigital: input.includesDigital,
      option1Name,
      option2Name,
      option3Name,
    });
  }

  /**
   * List every product of an artist, drafts and archived included.
   */
  public async listForManager(
    userId: string,
    artistId: string,
  ): Promise<Product[]> {
    await this.access.requireManager(userId, artistId);
    return this.db.products.listAllByArtist(artistId);
  }

  /**
   * Read a product with its variants, photos, and shipping rates.
   */
  public async getForManager(
    userId: string,
    productId: string,
  ): Promise<ManagedProduct> {
    const product = await this.access.requireProductManager(userId, productId);
    const [variants, images, shippingRates] = await Promise.all([
      this.db.products.listVariants(productId),
      this.db.products.listImages(productId),
      this.db.products.listShippingRates(productId),
    ]);

    return {
      product,
      variants,
      images: await Promise.all(
        images.map(async (image) => ({
          ...image,
          url: await this.storage.getObjectSignedUrl(
            image.objectKey,
            IMAGE_URL_EXPIRY_SECONDS,
          ),
        })),
      ),
      shippingRates,
    };
  }

  /**
   * Change a product's details. Option axes can be renamed at any time, but
   * not added or removed once it has variants.
   *
   * @throws ApiError 400 for invalid details, 409 when changing how many
   * options a product with variants has.
   */
  public async update(
    userId: string,
    productId: string,
    changes: UpdateProductInput,
  ): Promise<Product> {
    const product = await this.access.requireProductManager(userId, productId);
    await this.requireReleaseLink(product.artistId, {
      releaseId:
        changes.releaseId === undefined ? product.releaseId : changes.releaseId,
      includesDigital: changes.includesDigital ?? product.includesDigital,
    });

    let optionNames = {};
    if (changes.options) {
      const [option1Name, option2Name, option3Name] = this.validOptionNames(
        changes.options,
      );
      const variants = await this.db.products.listVariants(productId);
      if (
        variants.length > 0 &&
        changes.options.length !== this.optionNames(product).length
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'Options can be renamed, but not added or removed once the product has variants.',
        );
      }
      optionNames = { option1Name, option2Name, option3Name };
    }

    await this.db.products.updateById(productId, {
      name:
        changes.name === undefined ? undefined : this.validName(changes.name),
      type: changes.type,
      description:
        changes.description === undefined
          ? undefined
          : changes.description?.trim() || null,
      releaseId: changes.releaseId,
      includesDigital: changes.includesDigital,
      ...optionNames,
    });
    return (await this.db.products.getById(productId)) as Product;
  }

  /**
   * Delete a product that has never sold, with its photos.
   *
   * @throws ApiError 409 once it has sold; archive it instead.
   */
  public async delete(userId: string, productId: string): Promise<void> {
    await this.access.requireProductManager(userId, productId);
    const images = await this.db.products.listImages(productId);

    try {
      await this.db.products.deleteById(productId);
    } catch (error) {
      if (
        getPostgresErrorCode(error) === PostgresErrorCode.ForeignKeyViolation
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'This product has sales on record, so it can only be archived.',
        );
      }
      throw error;
    }

    for (const image of images)
      await this.storage.deleteObject(image.objectKey);
  }

  /**
   * Put a product in the store. It needs a variant to buy and somewhere to
   * ship, and the artist needs a payment account that can take charges and
   * funded hosting.
   *
   * @throws ApiError 403 when the user or artist is suspended or the product
   * was taken down, 409 naming what is still missing.
   */
  public async publish(userId: string, productId: string): Promise<Product> {
    await this.access.requireActiveUser(userId);
    const product = await this.access.requireProductManager(userId, productId);
    const artist = await this.db.artists.getById(product.artistId);

    if (product.status === 'published') return product;
    if (product.status === 'taken_down') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'This product was taken down and cannot be published.',
      );
    }
    if (artist?.suspendedAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'This artist is suspended.',
      );
    }

    const [variants, rates] = await Promise.all([
      this.db.products.listVariants(productId),
      this.db.products.listShippingRates(productId),
    ]);
    const missing: string[] = [];
    if (variants.length === 0) missing.push('add a variant');
    if (rates.length === 0) missing.push('set a shipping rate');
    missing.push(
      ...(await this.gate.missingToSell(
        { artistId: product.artistId },
        product.currency,
      )),
    );
    if (missing.length > 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        `Before publishing: ${missing.join('; ')}.`,
      );
    }

    await this.db.products.publish(productId);
    return (await this.db.products.getById(productId)) as Product;
  }

  /**
   * Pull a product from sale, keeping it for the orders that reference it.
   *
   * @throws ApiError 409 when the product is not published.
   */
  public async archive(userId: string, productId: string): Promise<Product> {
    const product = await this.access.requireProductManager(userId, productId);
    if (product.status !== 'published') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a published product can be archived.',
      );
    }

    await this.db.products.archive(productId);
    return (await this.db.products.getById(productId)) as Product;
  }

  /**
   * Add a buyable variant: one value per option axis, with its own price and
   * stock.
   *
   * @throws ApiError 400 for an invalid price, stock, or options, 409 when
   * another variant has the same options.
   */
  public async addVariant(
    userId: string,
    productId: string,
    input: VariantInput,
  ): Promise<ProductVariant> {
    const product = await this.access.requireProductManager(userId, productId);
    const [option1Value, option2Value, option3Value] = this.validVariantOptions(
      product,
      input.options ?? [],
    );

    return this.uniqueVariant(() =>
      this.db.products.createVariant({
        productId,
        price: this.validPrice(input.price),
        stock: this.validStock(input.stock ?? 0),
        sku: input.sku?.trim() || null,
        option1Value,
        option2Value,
        option3Value,
      }),
    );
  }

  /**
   * Change a variant's price, SKU, or options.
   *
   * @throws ApiError 400 for an invalid price or options, 409 when another
   * variant has the same options.
   */
  public async updateVariant(
    userId: string,
    variantId: string,
    changes: VariantChanges,
  ): Promise<void> {
    const { product } = await this.access.requireVariantManager(
      userId,
      variantId,
    );
    const options = changes.options
      ? this.validVariantOptions(product, changes.options)
      : null;

    await this.uniqueVariant(() =>
      this.db.products.updateVariantById(variantId, {
        price:
          changes.price === undefined
            ? undefined
            : this.validPrice(changes.price),
        sku:
          changes.sku === undefined ? undefined : changes.sku?.trim() || null,
        ...(options && {
          option1Value: options[0],
          option2Value: options[1],
          option3Value: options[2],
        }),
      }),
    );
  }

  /**
   * Set how many units of a variant are on hand, as when restocking.
   *
   * @throws ApiError 400 for a negative or fractional count.
   */
  public async setStock(
    userId: string,
    variantId: string,
    stock: number,
  ): Promise<void> {
    await this.access.requireVariantManager(userId, variantId);
    await this.db.products.setStock(variantId, this.validStock(stock));
  }

  /**
   * Remove a variant that has never sold. A published product keeps at least
   * one.
   *
   * @throws ApiError 409 for the last variant of a published product, or one
   * that has sold.
   */
  public async removeVariant(userId: string, variantId: string): Promise<void> {
    const { product } = await this.access.requireVariantManager(
      userId,
      variantId,
    );
    if (product.status === 'published') {
      const variants = await this.db.products.listVariants(product.id);
      if (variants.length === 1) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'A published product needs at least one variant.',
        );
      }
    }

    try {
      await this.db.products.deleteVariantById(variantId);
    } catch (error) {
      if (
        getPostgresErrorCode(error) === PostgresErrorCode.ForeignKeyViolation
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'This variant has sold, so it stays on record. Set its stock to zero instead.',
        );
      }
      throw error;
    }
  }

  /**
   * Get somewhere to upload a product photo.
   *
   * @throws ApiError 400 for a file type photos cannot be.
   */
  public async createImageUpload(
    userId: string,
    productId: string,
    contentType: string,
  ): Promise<UploadTarget> {
    const product = await this.access.requireProductManager(userId, productId);
    await this.access.requireUploadsAllowed(product.artistId);
    return this.uploads.createTarget(
      this.imagePrefix(productId),
      'photo',
      contentType,
      PRODUCT_IMAGE_RULES,
    );
  }

  /**
   * Add an uploaded photo to the end of the product's gallery.
   *
   * @throws ApiError 400 when nothing valid was uploaded to that key, 404 for
   * a variant of another product.
   */
  public async confirmImageUpload(
    userId: string,
    productId: string,
    input: ProductImageInput,
  ): Promise<ProductImage> {
    await this.access.requireProductManager(userId, productId);
    if (input.variantId)
      await this.requireOwnVariant(productId, input.variantId);

    const stored = await this.uploads.confirm(
      input.objectKey,
      this.imagePrefix(productId),
      PRODUCT_IMAGE_RULES,
    );
    const images = await this.db.products.listImages(productId);

    return this.db.products.addImage({
      productId,
      bucket: this.storage.bucket,
      objectKey: input.objectKey,
      byteSize: stored.byteSize,
      variantId: input.variantId,
      altText: input.altText?.trim() || null,
      position: images.length,
    });
  }

  /**
   * Change a photo's alt text, place in the gallery, or the variant it shows.
   *
   * @throws ApiError 400 for a negative position, 404 for a variant of
   * another product.
   */
  public async updateImage(
    userId: string,
    imageId: string,
    changes: ProductImageChanges,
  ): Promise<void> {
    const image = await this.access.requireProductImageManager(userId, imageId);
    if (changes.variantId) {
      await this.requireOwnVariant(image.productId, changes.variantId);
    }
    if (
      changes.position !== undefined &&
      (!Number.isInteger(changes.position) || changes.position < 0)
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'A gallery position is a whole number from zero.',
      );
    }

    await this.db.products.updateImageById(imageId, {
      variantId: changes.variantId,
      altText:
        changes.altText === undefined
          ? undefined
          : changes.altText?.trim() || null,
      position: changes.position,
    });
  }

  /**
   * Delete a photo and its file.
   */
  public async deleteImage(userId: string, imageId: string): Promise<void> {
    const image = await this.access.requireProductImageManager(userId, imageId);
    await this.db.products.deleteImageById(imageId);
    await this.storage.deleteObject(image.objectKey);
  }

  /**
   * Set what a product costs to ship to one zone, replacing any earlier rate
   * for it.
   *
   * @throws ApiError 400 for amounts that are not whole cents from zero.
   */
  public async setShippingRate(
    userId: string,
    productId: string,
    input: ShippingRateInput,
  ): Promise<ProductShippingRate> {
    await this.access.requireProductManager(userId, productId);
    for (const amount of [input.firstItemAmount, input.additionalItemAmount]) {
      if (!Number.isInteger(amount) || amount < 0) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          'Shipping costs are whole numbers of cents, zero or more.',
        );
      }
    }

    return this.db.products.upsertShippingRate(productId, input);
  }

  /**
   * Stop shipping a product to one zone. A published product keeps at least
   * one.
   *
   * @throws ApiError 409 for the last rate of a published product.
   */
  public async removeShippingRate(
    userId: string,
    productId: string,
    destination: ShippingZone,
  ): Promise<void> {
    const product = await this.access.requireProductManager(userId, productId);
    const rates = await this.db.products.listShippingRates(productId);
    if (
      product.status === 'published' &&
      rates.every((rate) => rate.destination === destination)
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'A published product has to ship somewhere.',
      );
    }

    await this.db.products.deleteShippingRate(productId, destination);
  }

  /**
   * Require that a linked release belongs to the same artist, and that a
   * bundle has one.
   */
  private async requireReleaseLink(
    artistId: string,
    link: { releaseId?: string | null; includesDigital?: boolean },
  ): Promise<void> {
    if (link.includesDigital && !link.releaseId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'A product that includes the download must be linked to a release.',
      );
    }
    if (!link.releaseId) return;

    const release = await this.db.releases.getById(link.releaseId);
    if (release?.artistId !== artistId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        "A product can only be linked to one of its artist's releases.",
      );
    }
  }

  private async requireOwnVariant(
    productId: string,
    variantId: string,
  ): Promise<void> {
    const variant = await this.db.products.getVariantById(variantId);
    if (variant?.productId !== productId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'That variant is not part of this product.',
      );
    }
  }

  /**
   * Run a variant write, turning a duplicate option combination into a 409.
   */
  private async uniqueVariant<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (getPostgresErrorCode(error) === PostgresErrorCode.UniqueViolation) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'Another variant already has those options.',
        );
      }
      throw error;
    }
  }

  /**
   * A variant's option values, checked against the product's axes and padded
   * to three.
   */
  private validVariantOptions(
    product: Product,
    values: string[],
  ): (string | null)[] {
    const axes = this.optionNames(product);
    if (values.length !== axes.length) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        axes.length === 0
          ? 'This product has no options.'
          : `Give a value for each option: ${axes.join(', ')}.`,
      );
    }
    return this.validOptions(values, axes.length, 'Option values');
  }

  private validOptionNames(names: string[]): (string | null)[] {
    const valid = this.validOptions(names, MAX_OPTIONS, 'Option names');
    const given = valid.filter((name) => name !== null);
    if (new Set(given.map((name) => name.toLowerCase())).size < given.length) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Each option needs its own name.',
      );
    }
    return valid;
  }

  /**
   * Trimmed option names or values, padded with nulls to three.
   */
  private validOptions(
    values: string[],
    max: number,
    what: string,
  ): (string | null)[] {
    const trimmed = values.map((value) => value.trim());
    if (
      trimmed.length > max ||
      trimmed.some((value) => !value || value.length > OPTION_MAX_LENGTH)
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `${what} are 1 to ${OPTION_MAX_LENGTH} characters, at most ${MAX_OPTIONS} of them.`,
      );
    }
    return [...trimmed, null, null, null].slice(0, MAX_OPTIONS);
  }

  private optionNames(product: Product): string[] {
    return [
      product.option1Name,
      product.option2Name,
      product.option3Name,
    ].filter((name): name is string => name !== null);
  }

  private validName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > NAME_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Product names are 1 to ${NAME_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  /** Merch is always sold for money, so a variant costs more than nothing. */
  private validPrice(price: number): number {
    if (!Number.isInteger(price) || price <= 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'A price is a whole number of cents above zero.',
      );
    }
    return price;
  }

  private validStock(stock: number): number {
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Stock is a whole number, zero or more.',
      );
    }
    return stock;
  }

  private imagePrefix(productId: string): string {
    return `products/${productId}/images/`;
  }
}
