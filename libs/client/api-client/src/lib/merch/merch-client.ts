import {
  type AckResponse,
  ApiRoute,
  type ConfirmProductImageRequest,
  type CreateProductRequest,
  type ManagedProductResponse,
  type ProductImageChangesRequest,
  type ProductImageResponse,
  type ProductPageResponse,
  type ProductResponse,
  type ShippingRateRequest,
  type ShippingRateResponse,
  type ShippingZone,
  type StoreItem,
  type UpdateProductRequest,
  type UploadTargetResponse,
  type VariantChangesRequest,
  type VariantRequest,
  type VariantResponse,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Merch: what listeners browse, and what managers build.
 */
export class MerchClient {
  constructor(private readonly transport: ApiTransport) {}

  /**
   * An artist's store, by handle.
   */
  public listStore(handle: string): Promise<ApiResult<StoreItem[]>> {
    return this.transport.get(ApiRoute.CatalogStore, { params: { handle } });
  }

  /**
   * A release's physical editions, such as its vinyl pressing.
   */
  public listEditions(releaseId: string): Promise<ApiResult<StoreItem[]>> {
    return this.transport.get(ApiRoute.CatalogEditions, {
      params: { releaseId },
    });
  }

  public getProductPage(
    productId: string,
  ): Promise<ApiResult<ProductPageResponse>> {
    return this.transport.get(ApiRoute.CatalogProduct, {
      params: { productId },
    });
  }

  public create(
    artistId: string,
    product: CreateProductRequest,
  ): Promise<ApiResult<ProductResponse>> {
    return this.transport.post(ApiRoute.ArtistProducts, {
      params: { artistId },
      body: product,
    });
  }

  /**
   * Every product of an artist, drafts and archived included.
   */
  public listForArtist(
    artistId: string,
  ): Promise<ApiResult<ProductResponse[]>> {
    return this.transport.get(ApiRoute.ArtistProducts, {
      params: { artistId },
    });
  }

  public get(productId: string): Promise<ApiResult<ManagedProductResponse>> {
    return this.transport.get(ApiRoute.Product, { params: { productId } });
  }

  public update(
    productId: string,
    changes: UpdateProductRequest,
  ): Promise<ApiResult<ProductResponse>> {
    return this.transport.patch(ApiRoute.Product, {
      params: { productId },
      body: changes,
    });
  }

  public delete(productId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.Product, { params: { productId } });
  }

  public publish(productId: string): Promise<ApiResult<ProductResponse>> {
    return this.transport.post(ApiRoute.ProductPublish, {
      params: { productId },
    });
  }

  public archive(productId: string): Promise<ApiResult<ProductResponse>> {
    return this.transport.post(ApiRoute.ProductArchive, {
      params: { productId },
    });
  }

  public addVariant(
    productId: string,
    variant: VariantRequest,
  ): Promise<ApiResult<VariantResponse>> {
    return this.transport.post(ApiRoute.ProductVariants, {
      params: { productId },
      body: variant,
    });
  }

  public updateVariant(
    variantId: string,
    changes: VariantChangesRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.patch(ApiRoute.Variant, {
      params: { variantId },
      body: changes,
    });
  }

  public removeVariant(variantId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.Variant, { params: { variantId } });
  }

  public setStock(
    variantId: string,
    stock: number,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.VariantStock, {
      params: { variantId },
      body: { stock },
    });
  }

  public createImageUpload(
    productId: string,
    contentType: string,
  ): Promise<ApiResult<UploadTargetResponse>> {
    return this.transport.post(ApiRoute.ProductImageUploads, {
      params: { productId },
      body: { contentType },
    });
  }

  public confirmImage(
    productId: string,
    image: ConfirmProductImageRequest,
  ): Promise<ApiResult<ProductImageResponse>> {
    return this.transport.post(ApiRoute.ProductImages, {
      params: { productId },
      body: image,
    });
  }

  public updateImage(
    imageId: string,
    changes: ProductImageChangesRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.patch(ApiRoute.ProductImage, {
      params: { imageId },
      body: changes,
    });
  }

  public deleteImage(imageId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ProductImage, {
      params: { imageId },
    });
  }

  public setShippingRate(
    productId: string,
    destination: ShippingZone,
    rate: ShippingRateRequest,
  ): Promise<ApiResult<ShippingRateResponse>> {
    return this.transport.put(ApiRoute.ProductShippingRate, {
      params: { productId, destination },
      body: rate,
    });
  }

  public removeShippingRate(
    productId: string,
    destination: ShippingZone,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ProductShippingRate, {
      params: { productId, destination },
    });
  }
}
