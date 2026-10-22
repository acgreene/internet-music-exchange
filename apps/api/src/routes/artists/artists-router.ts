import { ApiRoute, artistImageKindSchema, HttpMethod } from '@ime/models';
import type { ArtistService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Artists: creating them, their public profile, and what their managers edit:
 * details, links, images, and who else manages.
 */
export class ArtistsRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly artists: ArtistService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(HttpMethod.Post, ApiRoute.Artists, 'user', ({ userId, body }) =>
      this.artists.create(userId, body),
    );

    this.handle(HttpMethod.Get, ApiRoute.MyArtists, 'user', ({ userId }) =>
      this.artists.listManaged(userId),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.Artist,
      'user',
      ({ userId, params, body }) =>
        this.artists.update(userId, params.artistId, body),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.CatalogArtist,
      'public',
      ({ params }) => this.artists.getProfile(params.handle),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ArtistLinks,
      'user',
      ({ userId, params, body }) =>
        this.artists.setLinks(userId, params.artistId, body.links),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ArtistImageUploads,
      'user',
      ({ userId, params, body }) =>
        this.artists.createImageUpload(
          userId,
          params.artistId,
          this.imageKind(params.kind),
          body.contentType,
        ),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ArtistImage,
      'user',
      async ({ userId, params, body }) => ({
        url: await this.artists.confirmImageUpload(
          userId,
          params.artistId,
          this.imageKind(params.kind),
          body.objectKey,
        ),
      }),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ArtistImage,
      'user',
      ({ userId, params }) =>
        this.artists.removeImage(
          userId,
          params.artistId,
          this.imageKind(params.kind),
        ),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistManagers,
      'user',
      ({ userId, params }) =>
        this.artists.listManagers(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ArtistManagers,
      'user',
      ({ userId, params, body }) =>
        this.artists.addManager(userId, params.artistId, body.username),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ArtistManager,
      'user',
      ({ userId, params }) =>
        this.artists.removeManager(userId, params.artistId, params.userId),
    );
  }

  private imageKind(kind: string) {
    return this.enumParam(artistImageKindSchema.options, kind);
  }
}
