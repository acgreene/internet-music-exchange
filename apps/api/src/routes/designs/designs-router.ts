import { ApiRoute, HttpMethod } from '@ime/models';
import type {
  DesignGalleryService,
  DesignMarketplaceService,
  DesignService,
  ReleaseDesignService,
} from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Creative pages: designers build and sell designs, anyone browses and
 * previews them in the gallery, artists get them on the marketplace, and
 * managers dress their releases in them.
 */
export class DesignsRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly designs: DesignService,
    private readonly marketplace: DesignMarketplaceService,
    private readonly releaseDesigns: ReleaseDesignService,
    private readonly gallery: DesignGalleryService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.registerDesigner();
    this.registerMarketplace();
    this.registerGallery();
    this.registerReleaseDesigns();
  }

  private registerDesigner(): void {
    this.handle(HttpMethod.Post, ApiRoute.Designs, 'user', ({ userId, body }) =>
      this.designs.create(userId, body),
    );

    this.handle(HttpMethod.Get, ApiRoute.MyDesigns, 'user', ({ userId }) =>
      this.designs.listMine(userId),
    );

    this.handle(HttpMethod.Get, ApiRoute.MyDesignSales, 'user', ({ userId }) =>
      this.designs.listSales(userId),
    );

    this.handle(HttpMethod.Get, ApiRoute.Design, 'user', ({ userId, params }) =>
      this.designs.getMine(userId, params.designId),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.Design,
      'user',
      ({ userId, params, body }) =>
        this.designs.update(userId, params.designId, body),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.Design,
      'user',
      ({ userId, params }) => this.designs.delete(userId, params.designId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.DesignPricing,
      'user',
      ({ userId, params, body }) =>
        this.designs.setPricing(userId, params.designId, body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.DesignVersionUploads,
      'user',
      ({ userId, params, body }) =>
        this.designs.createVersionUpload(
          userId,
          params.designId,
          body.contentType,
        ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.DesignVersions,
      'user',
      ({ userId, params, body }) =>
        this.designs.confirmVersionUpload(userId, params.designId, body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.DesignPublish,
      'user',
      ({ userId, params }) => this.designs.publish(userId, params.designId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.DesignArchive,
      'user',
      ({ userId, params }) => this.designs.archive(userId, params.designId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.DesignGrants,
      'user',
      ({ userId, params, body }) =>
        this.designs.grant(userId, params.designId, body.artistHandle),
    );
  }

  private registerGallery(): void {
    this.handle(HttpMethod.Get, ApiRoute.GalleryDesigns, 'public', () =>
      this.gallery.list(),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.GalleryDesign,
      'public',
      ({ params }) => this.gallery.get(params.designId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.GalleryCommission,
      'user',
      ({ userId, params, body }) =>
        this.gallery.requestCommission(userId, params.designId, body.message),
    );
  }

  private registerMarketplace(): void {
    this.handle(
      HttpMethod.Get,
      ApiRoute.MarketplaceDesigns,
      'public',
      ({ query }) =>
        this.marketplace.browse(query.surface, query.limit, query.offset),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.MarketplaceSearch,
      'public',
      ({ query }) => this.marketplace.search(query.q, query.surface),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.MarketplaceDesign,
      'public',
      ({ params }) => this.marketplace.getDesign(params.designId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistDesigns,
      'user',
      ({ userId, params }) =>
        this.marketplace.listLicensed(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ArtistDesignAcquire,
      'user',
      ({ userId, params, body }) =>
        this.marketplace.acquire(
          userId,
          params.artistId,
          params.designId,
          body.amount,
        ),
    );
  }

  private registerReleaseDesigns(): void {
    this.handle(
      HttpMethod.Get,
      ApiRoute.ReleaseDesign,
      'user',
      ({ userId, params }) =>
        this.releaseDesigns.getForRelease(userId, params.releaseId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ReleaseDesign,
      'user',
      ({ userId, params, body }) =>
        this.releaseDesigns.apply(userId, params.releaseId, body.designId),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ReleaseDesign,
      'user',
      ({ userId, params }) =>
        this.releaseDesigns.remove(userId, params.releaseId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseDesignUpdate,
      'user',
      ({ userId, params }) =>
        this.releaseDesigns.updateToLatest(userId, params.releaseId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ReleaseDesignCustomization,
      'user',
      ({ userId, params, body }) =>
        this.releaseDesigns.customize(userId, params.releaseId, body.values),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseDesignImageUploads,
      'user',
      ({ userId, params, body }) =>
        this.releaseDesigns.createImageUpload(
          userId,
          params.releaseId,
          body.contentType,
        ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseDesignImages,
      'user',
      ({ userId, params, body }) =>
        this.releaseDesigns.confirmImageUpload(
          userId,
          params.releaseId,
          body.objectKey,
        ),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.DesignImage,
      'user',
      ({ userId, params }) =>
        this.releaseDesigns.deleteImage(userId, params.imageId),
    );
  }
}
