import { ApiRoute, HttpMethod, shippingZoneSchema } from '@ime/models';
import type { ProductService, StoreService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Merch: managers build products, variants, photos, and shipping rates;
 * listeners browse stores, a release's editions, and product pages.
 */
export class MerchRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly products: ProductService,
    private readonly store: StoreService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(
      HttpMethod.Post,
      ApiRoute.ArtistProducts,
      'user',
      ({ userId, params, body }) =>
        this.products.create(userId, params.artistId, body),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistProducts,
      'user',
      ({ userId, params }) =>
        this.products.listForManager(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.Product,
      'user',
      ({ userId, params }) =>
        this.products.getForManager(userId, params.productId),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.Product,
      'user',
      ({ userId, params, body }) =>
        this.products.update(userId, params.productId, body),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.Product,
      'user',
      ({ userId, params }) => this.products.delete(userId, params.productId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ProductPublish,
      'user',
      ({ userId, params }) => this.products.publish(userId, params.productId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ProductArchive,
      'user',
      ({ userId, params }) => this.products.archive(userId, params.productId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ProductVariants,
      'user',
      ({ userId, params, body }) =>
        this.products.addVariant(userId, params.productId, body),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.Variant,
      'user',
      ({ userId, params, body }) =>
        this.products.updateVariant(userId, params.variantId, body),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.Variant,
      'user',
      ({ userId, params }) =>
        this.products.removeVariant(userId, params.variantId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.VariantStock,
      'user',
      ({ userId, params, body }) =>
        this.products.setStock(userId, params.variantId, body.stock),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ProductImageUploads,
      'user',
      ({ userId, params, body }) =>
        this.products.createImageUpload(
          userId,
          params.productId,
          body.contentType,
        ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ProductImages,
      'user',
      ({ userId, params, body }) =>
        this.products.confirmImageUpload(userId, params.productId, body),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.ProductImage,
      'user',
      ({ userId, params, body }) =>
        this.products.updateImage(userId, params.imageId, body),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ProductImage,
      'user',
      ({ userId, params }) => this.products.deleteImage(userId, params.imageId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ProductShippingRate,
      'user',
      ({ userId, params, body }) =>
        this.products.setShippingRate(userId, params.productId, {
          ...body,
          destination: this.zone(params.destination),
        }),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ProductShippingRate,
      'user',
      ({ userId, params }) =>
        this.products.removeShippingRate(
          userId,
          params.productId,
          this.zone(params.destination),
        ),
    );

    this.handle(HttpMethod.Get, ApiRoute.CatalogStore, 'public', ({ params }) =>
      this.store.listStore(params.handle),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogEditions,
      'public',
      ({ params }) => this.store.listEditions(params.releaseId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogProduct,
      'public',
      ({ params }) => this.store.getProductPage(params.productId),
    );
  }

  private zone(destination: string) {
    return this.enumParam(shippingZoneSchema.options, destination);
  }
}
