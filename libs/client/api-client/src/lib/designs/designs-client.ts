import {
  type AckResponse,
  ApiRoute,
  type ConfirmDesignVersionRequest,
  type CreateDesignRequest,
  type DesignAcquisition,
  type DesignChangesRequest,
  type DesignResponse,
  type DesignSale,
  type DesignSummary,
  type DesignVersionResponse,
  type ManagedDesignResponse,
  type MarketplaceDesignResponse,
  type PageQuery,
  type ReleaseDesignResponse,
  type SetPricingRequest,
  type SlotImage,
  type UploadTargetResponse,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Creative pages: the marketplace, the designer's own designs, and dressing
 * a release in a design.
 */
export class DesignsClient {
  constructor(private readonly transport: ApiTransport) {}

  /**
   * Public release page designs, newest first.
   */
  public browse(page?: PageQuery): Promise<ApiResult<DesignSummary[]>> {
    return this.transport.get(ApiRoute.MarketplaceDesigns, { query: page });
  }

  public search(query: string): Promise<ApiResult<DesignSummary[]>> {
    return this.transport.get(ApiRoute.MarketplaceSearch, {
      query: { q: query },
    });
  }

  public getMarketplaceDesign(
    designId: string,
  ): Promise<ApiResult<MarketplaceDesignResponse>> {
    return this.transport.get(ApiRoute.MarketplaceDesign, {
      params: { designId },
    });
  }

  /**
   * The designs an artist may use: bought, claimed, or granted.
   */
  public listLicensed(artistId: string): Promise<ApiResult<DesignSummary[]>> {
    return this.transport.get(ApiRoute.ArtistDesigns, {
      params: { artistId },
    });
  }

  /**
   * Get a design for an artist. A paid one returns a Stripe checkout page to
   * send the manager to; the license is recorded once they pay.
   */
  public acquire(
    artistId: string,
    designId: string,
    amount?: number,
  ): Promise<ApiResult<DesignAcquisition>> {
    return this.transport.post(ApiRoute.ArtistDesignAcquire, {
      params: { artistId, designId },
      body: { amount },
    });
  }

  public create(
    design: CreateDesignRequest,
  ): Promise<ApiResult<DesignResponse>> {
    return this.transport.post(ApiRoute.Designs, { body: design });
  }

  /**
   * The designs the signed-in user made.
   */
  public listMine(): Promise<ApiResult<DesignResponse[]>> {
    return this.transport.get(ApiRoute.MyDesigns);
  }

  public listSales(): Promise<ApiResult<DesignSale[]>> {
    return this.transport.get(ApiRoute.MyDesignSales);
  }

  public get(designId: string): Promise<ApiResult<ManagedDesignResponse>> {
    return this.transport.get(ApiRoute.Design, { params: { designId } });
  }

  public update(
    designId: string,
    changes: DesignChangesRequest,
  ): Promise<ApiResult<DesignResponse>> {
    return this.transport.patch(ApiRoute.Design, {
      params: { designId },
      body: changes,
    });
  }

  public delete(designId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.Design, { params: { designId } });
  }

  public setPricing(
    designId: string,
    pricing: SetPricingRequest,
  ): Promise<ApiResult<DesignResponse>> {
    return this.transport.put(ApiRoute.DesignPricing, {
      params: { designId },
      body: pricing,
    });
  }

  /**
   * Get somewhere to upload a new version, a single HTML file.
   */
  public createVersionUpload(
    designId: string,
  ): Promise<ApiResult<UploadTargetResponse>> {
    return this.transport.post(ApiRoute.DesignVersionUploads, {
      params: { designId },
      body: { contentType: 'text/html' },
    });
  }

  /**
   * Record an uploaded version with the slots it exposes.
   */
  public confirmVersion(
    designId: string,
    version: ConfirmDesignVersionRequest,
  ): Promise<ApiResult<DesignVersionResponse>> {
    return this.transport.post(ApiRoute.DesignVersions, {
      params: { designId },
      body: version,
    });
  }

  public publish(designId: string): Promise<ApiResult<DesignResponse>> {
    return this.transport.post(ApiRoute.DesignPublish, {
      params: { designId },
    });
  }

  public archive(designId: string): Promise<ApiResult<DesignResponse>> {
    return this.transport.post(ApiRoute.DesignArchive, {
      params: { designId },
    });
  }

  /**
   * Grant an artist a license, as when delivering a commission.
   */
  public grant(
    designId: string,
    artistHandle: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.DesignGrants, {
      params: { designId },
      body: { artistHandle },
    });
  }

  public getReleaseDesign(
    releaseId: string,
  ): Promise<ApiResult<ReleaseDesignResponse>> {
    return this.transport.get(ApiRoute.ReleaseDesign, {
      params: { releaseId },
    });
  }

  /**
   * Apply one of the artist's licensed designs to a release.
   */
  public applyToRelease(
    releaseId: string,
    designId: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.ReleaseDesign, {
      params: { releaseId },
      body: { designId },
    });
  }

  /**
   * Go back to the default layout.
   */
  public removeFromRelease(releaseId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ReleaseDesign, {
      params: { releaseId },
    });
  }

  public updateReleaseToLatest(
    releaseId: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.ReleaseDesignUpdate, {
      params: { releaseId },
    });
  }

  /**
   * Set every slot value at once: text, or the id of an uploaded slot image.
   */
  public customizeRelease(
    releaseId: string,
    values: Record<string, string>,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.ReleaseDesignCustomization, {
      params: { releaseId },
      body: { values },
    });
  }

  public createSlotImageUpload(
    releaseId: string,
    contentType: string,
  ): Promise<ApiResult<UploadTargetResponse>> {
    return this.transport.post(ApiRoute.ReleaseDesignImageUploads, {
      params: { releaseId },
      body: { contentType },
    });
  }

  public confirmSlotImage(
    releaseId: string,
    objectKey: string,
  ): Promise<ApiResult<SlotImage>> {
    return this.transport.post(ApiRoute.ReleaseDesignImages, {
      params: { releaseId },
      body: { objectKey },
    });
  }

  public deleteSlotImage(imageId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.DesignImage, {
      params: { imageId },
    });
  }
}
