import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  min,
  type SQL,
  sql,
  sum,
} from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  type Currency,
  orderItems,
  type Product,
  type ProductImage,
  productImages,
  type ProductShippingRate,
  productShippingRates,
  type ProductStatus,
  type ProductType,
  type ProductVariant,
  productVariants,
  products,
  type ShippingZone,
} from '../tables';

/**
 * A product as a store grid shows it, priced from its cheapest variant.
 */
export interface ProductListItem {
  id: string;
  name: string;
  type: ProductType;
  currency: Currency;
  releaseId: string | null;
  minPrice: number;
  totalStock: number;
}

/**
 * The image a product leads with in a grid, carrying the product id so a batch
 * of them can be keyed back to the products they belong to.
 */
export interface ProductPrimaryImage {
  productId: string;
  bucket: string;
  objectKey: string;
  altText: string | null;
}

/**
 * A variant with everything checkout needs to price it, charge the right
 * artist, and know what buying it grants.
 */
export interface CheckoutVariant {
  variantId: string;
  productId: string;
  productName: string;
  productStatus: ProductStatus;
  artistId: string;
  currency: Currency;
  price: number;
  stock: number;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  includesDigital: boolean;
  releaseId: string | null;
}

export interface CreateProductParams {
  artistId: string;
  name: string;
  type: ProductType;
  currency: Currency;
  description?: string | null;
  releaseId?: string | null;
  includesDigital?: boolean;
  option1Name?: string | null;
  option2Name?: string | null;
  option3Name?: string | null;
}

export interface UpdateProductParams {
  name?: string;
  description?: string | null;
  type?: ProductType;
  releaseId?: string | null;
  includesDigital?: boolean;
  option1Name?: string | null;
  option2Name?: string | null;
  option3Name?: string | null;
}

export interface CreateVariantParams {
  productId: string;
  price: number;
  stock?: number;
  sku?: string | null;
  option1Value?: string | null;
  option2Value?: string | null;
  option3Value?: string | null;
}

export interface UpdateVariantParams {
  price?: number;
  sku?: string | null;
  option1Value?: string | null;
  option2Value?: string | null;
  option3Value?: string | null;
}

export interface AddImageParams {
  productId: string;
  bucket: string;
  objectKey: string;
  variantId?: string | null;
  altText?: string | null;
  position?: number;
}

export interface UpdateImageParams {
  variantId?: string | null;
  altText?: string | null;
  position?: number;
}

export interface UpsertShippingRateParams {
  destination: ShippingZone;
  firstItemAmount: number;
  additionalItemAmount: number;
}

/**
 * Queries for the merch an artist sells: the product, the variants that are
 * actually buyable, their photos, and what they cost to ship.
 */
export class ProductRepository {
  constructor(private readonly db: Db) {}

  /**
   * Find a product by its id.
   *
   * @param productId - The id of the product to look up.
   * @returns The product row, or null when no product has that id.
   */
  public async getById(productId: string): Promise<Product | null> {
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    return product ?? null;
  }

  /**
   * List an artist's public store.
   *
   * @param artistId - The id of the selling artist.
   * @returns One entry per published product with its cheapest variant price
   * and how many units it has left, newest first.
   */
  public async listPublishedByArtist(
    artistId: string,
  ): Promise<ProductListItem[]> {
    return this.listStorefront(
      and(eq(products.artistId, artistId), eq(products.status, 'published')),
    );
  }

  /**
   * List every product belonging to an artist, drafts and archived included.
   *
   * @param artistId - The id of the selling artist.
   * @returns The artist's products, newest first.
   */
  public async listAllByArtist(artistId: string): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(eq(products.artistId, artistId))
      .orderBy(desc(products.createdAt));
  }

  /**
   * List the physical editions of a release, such as its vinyl pressing.
   *
   * @param releaseId - The id of the release the products are editions of.
   * @returns One entry per published product tied to that release.
   */
  public async listPublishedByRelease(
    releaseId: string,
  ): Promise<ProductListItem[]> {
    return this.listStorefront(
      and(eq(products.releaseId, releaseId), eq(products.status, 'published')),
    );
  }

  /**
   * Read the lead image for many products at once, so a store grid resolves its
   * photos in a single query.
   *
   * @param productIds - The ids of the products whose images to read.
   * @returns One entry per product that has an image. Products without one are
   * absent.
   */
  public async listPrimaryImages(
    productIds: string[],
  ): Promise<ProductPrimaryImage[]> {
    if (productIds.length === 0) return [];

    // the lead image is the first in gallery order, so later ones drop out
    return this.db
      .selectDistinctOn([productImages.productId], {
        productId: productImages.productId,
        bucket: productImages.bucket,
        objectKey: productImages.objectKey,
        altText: productImages.altText,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(
        productImages.productId,
        asc(productImages.position),
        asc(productImages.createdAt),
      );
  }

  /**
   * List a product's buyable variants.
   *
   * @param productId - The id of the product whose variants to list.
   * @returns The variant rows, cheapest first.
   */
  public async listVariants(productId: string): Promise<ProductVariant[]> {
    return this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(asc(productVariants.price));
  }

  /**
   * List a product's gallery.
   *
   * @param productId - The id of the product whose images to list.
   * @returns The image rows in display order.
   */
  public async listImages(productId: string): Promise<ProductImage[]> {
    return this.db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.position), asc(productImages.createdAt));
  }

  /**
   * Read what a product costs to ship, per destination zone.
   *
   * @param productId - The id of the product whose rates to read.
   * @returns The shipping rate rows, empty when the artist has set none.
   */
  public async listShippingRates(
    productId: string,
  ): Promise<ProductShippingRate[]> {
    return this.db
      .select()
      .from(productShippingRates)
      .where(eq(productShippingRates.productId, productId));
  }

  /**
   * Resolve a cart of variants to what checkout needs: the true price, the
   * stock on hand, the artist to charge and whatever the sale grants.
   *
   * @param variantIds - The ids of the variants in the cart.
   * @returns One entry per variant that exists. Unknown ids are absent.
   */
  public async listVariantsForCheckout(
    variantIds: string[],
  ): Promise<CheckoutVariant[]> {
    if (variantIds.length === 0) return [];

    return this.db
      .select({
        variantId: productVariants.id,
        productId: products.id,
        productName: products.name,
        productStatus: products.status,
        artistId: products.artistId,
        currency: products.currency,
        price: productVariants.price,
        stock: productVariants.stock,
        option1Value: productVariants.option1Value,
        option2Value: productVariants.option2Value,
        option3Value: productVariants.option3Value,
        includesDigital: products.includesDigital,
        releaseId: products.releaseId,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, variantIds));
  }

  /**
   * Read the shipping rates for a cart's products in one destination zone.
   *
   * @param productIds - The ids of the products being shipped.
   * @param destination - Whether the parcel stays domestic or goes abroad.
   * @returns One rate per product that has one for that zone.
   */
  public async listShippingRatesForProducts(
    productIds: string[],
    destination: ShippingZone,
  ): Promise<ProductShippingRate[]> {
    if (productIds.length === 0) return [];

    return this.db
      .select()
      .from(productShippingRates)
      .where(
        and(
          inArray(productShippingRates.productId, productIds),
          eq(productShippingRates.destination, destination),
        ),
      );
  }

  /**
   * Put the units of a refunded order back on the shelf.
   *
   * @param artistOrderId - The id of the refunded artist order.
   */
  public async restockArtistOrder(artistOrderId: string): Promise<void> {
    await this.db
      .update(productVariants)
      .set({
        stock: sql`${productVariants.stock} + ${orderItems.quantity}`,
        updatedAt: new Date(),
      })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.productVariantId, productVariants.id),
          eq(orderItems.artistOrderId, artistOrderId),
        ),
      );
  }

  /**
   * Create a product. It starts as a draft until it is published.
   *
   * @param params - The selling artist, what the item is, its currency and the
   * option axes its variants vary on.
   * @returns The newly created product row.
   */
  public async create(params: CreateProductParams): Promise<Product> {
    const [product] = await this.db.insert(products).values(params).returning();

    return product;
  }

  /**
   * Update a product's editable fields. Status is changed through `publish` and
   * `archive` instead.
   *
   * @param productId - The id of the product to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateById(
    productId: string,
    params: UpdateProductParams,
  ): Promise<void> {
    await this.db
      .update(products)
      .set({ ...params, updatedAt: new Date() })
      .where(eq(products.id, productId));
  }

  /**
   * Put a product in the public store, provided it has something to buy.
   *
   * @param productId - The id of the product to publish.
   * @returns True when the product was published, false when it has no variants
   * and nothing could be bought.
   */
  public async publish(productId: string): Promise<boolean> {
    const published = await this.db
      .update(products)
      .set({ status: 'published', updatedAt: new Date() })
      .where(
        and(
          eq(products.id, productId),
          exists(
            this.db
              .select({ id: productVariants.id })
              .from(productVariants)
              .where(eq(productVariants.productId, productId)),
          ),
        ),
      )
      .returning({ id: products.id });

    return published.length > 0;
  }

  /**
   * Pull a product from sale, keeping it for the orders that reference it.
   *
   * @param productId - The id of the product to archive.
   */
  public async archive(productId: string): Promise<void> {
    await this.db
      .update(products)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(products.id, productId));
  }

  /**
   * Delete a product and its variants, images and rates. Fails once any of its
   * variants have sold, since order items reference them.
   *
   * @param productId - The id of the product to delete.
   */
  public async deleteById(productId: string): Promise<void> {
    await this.db.delete(products).where(eq(products.id, productId));
  }

  /**
   * Add a buyable variant to a product.
   *
   * @param params - The product, the price, the stock on hand and this
   * variant's value on each option axis.
   * @returns The newly created variant row.
   */
  public async createVariant(
    params: CreateVariantParams,
  ): Promise<ProductVariant> {
    const [variant] = await this.db
      .insert(productVariants)
      .values(params)
      .returning();

    return variant;
  }

  /**
   * Update a variant's editable fields. Stock is changed through `setStock`
   * instead.
   *
   * @param variantId - The id of the variant to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateVariantById(
    variantId: string,
    params: UpdateVariantParams,
  ): Promise<void> {
    await this.db
      .update(productVariants)
      .set({ ...params, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId));
  }

  /**
   * Set how many units of a variant are on hand, as when an artist restocks.
   *
   * @param variantId - The id of the variant to stock.
   * @param stock - The number of units now available.
   */
  public async setStock(variantId: string, stock: number): Promise<void> {
    await this.db
      .update(productVariants)
      .set({ stock, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId));
  }

  /**
   * Delete a variant. Fails once it has sold, since order items reference it.
   *
   * @param variantId - The id of the variant to delete.
   */
  public async deleteVariantById(variantId: string): Promise<void> {
    await this.db
      .delete(productVariants)
      .where(eq(productVariants.id, variantId));
  }

  /**
   * Add a photo to a product's gallery.
   *
   * @param params - The product, where the object lives, and the variant it
   * shows when it is specific to one.
   * @returns The newly created image row.
   */
  public async addImage(params: AddImageParams): Promise<ProductImage> {
    const [image] = await this.db
      .insert(productImages)
      .values(params)
      .returning();

    return image;
  }

  /**
   * Update a photo's caption, gallery slot or the variant it shows.
   *
   * @param imageId - The id of the image to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateImageById(
    imageId: string,
    params: UpdateImageParams,
  ): Promise<void> {
    await this.db
      .update(productImages)
      .set(params)
      .where(eq(productImages.id, imageId));
  }

  /**
   * Remove a photo from a gallery. The stored object itself is untouched.
   *
   * @param imageId - The id of the image to delete.
   */
  public async deleteImageById(imageId: string): Promise<void> {
    await this.db.delete(productImages).where(eq(productImages.id, imageId));
  }

  /**
   * Set what a product costs to ship to one zone, replacing any rate it already
   * had for that zone.
   *
   * @param productId - The id of the product being rated.
   * @param params - The destination zone and what the first and each further
   * unit cost to ship.
   * @returns The stored shipping rate row.
   */
  public async upsertShippingRate(
    productId: string,
    params: UpsertShippingRateParams,
  ): Promise<ProductShippingRate> {
    const [rate] = await this.db
      .insert(productShippingRates)
      .values({ productId, ...params })
      .onConflictDoUpdate({
        target: [
          productShippingRates.productId,
          productShippingRates.destination,
        ],
        set: {
          firstItemAmount: params.firstItemAmount,
          additionalItemAmount: params.additionalItemAmount,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rate;
  }

  /**
   * Stop shipping a product to one zone.
   *
   * @param productId - The id of the product.
   * @param destination - The zone to stop shipping to.
   */
  public async deleteShippingRate(
    productId: string,
    destination: ShippingZone,
  ): Promise<void> {
    await this.db
      .delete(productShippingRates)
      .where(
        and(
          eq(productShippingRates.productId, productId),
          eq(productShippingRates.destination, destination),
        ),
      );
  }

  /**
   * Read products for a store grid, priced and stocked from their variants.
   *
   * @param where - Which products to include.
   * @returns One entry per matching product, newest first.
   */
  private async listStorefront(
    where: SQL | undefined,
  ): Promise<ProductListItem[]> {
    const listed = await this.db
      .select({
        id: products.id,
        name: products.name,
        type: products.type,
        currency: products.currency,
        releaseId: products.releaseId,
        minPrice: min(productVariants.price),
        totalStock: sum(productVariants.stock),
        createdAt: products.createdAt,
      })
      .from(products)
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .where(where)
      .groupBy(products.id)
      .orderBy(desc(products.createdAt));

    return listed.map((product) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      currency: product.currency,
      releaseId: product.releaseId,
      minPrice: Number(product.minPrice ?? 0),
      totalStock: Number(product.totalStock ?? 0),
    }));
  }
}
