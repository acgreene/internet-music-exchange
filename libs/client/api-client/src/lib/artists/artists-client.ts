import {
  type AckResponse,
  type AddManagerRequest,
  ApiRoute,
  type ArtistImageKind,
  type ArtistLinkResponse,
  type ArtistManagerResponse,
  type ArtistProfileResponse,
  type ArtistResponse,
  type AvailabilityResponse,
  type CreateArtistRequest,
  type SetLinksRequest,
  type SignedUrlResponse,
  type UpdateArtistRequest,
  type UploadTargetResponse,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Artists: their public profiles, and what their managers create and edit.
 */
export class ArtistsClient {
  constructor(private readonly transport: ApiTransport) {}

  /**
   * An artist's public profile, by handle.
   */
  public getProfile(handle: string): Promise<ApiResult<ArtistProfileResponse>> {
    return this.transport.get(ApiRoute.CatalogArtist, { params: { handle } });
  }

  /**
   * Create an artist, with the signed-in user as its first manager.
   */
  public create(
    artist: CreateArtistRequest,
  ): Promise<ApiResult<ArtistResponse>> {
    return this.transport.post(ApiRoute.Artists, { body: artist });
  }

  /**
   * The artists the signed-in user manages.
   */
  public listMine(): Promise<ApiResult<ArtistResponse[]>> {
    return this.transport.get(ApiRoute.MyArtists);
  }

  /**
   * Whether a handle is free. Pass the artist when renaming one, so its own
   * handle counts as free.
   */
  public isHandleAvailable(
    handle: string,
    artistId?: string,
  ): Promise<ApiResult<AvailabilityResponse>> {
    return this.transport.get(ApiRoute.HandleAvailability, {
      params: { handle },
      query: { artistId },
    });
  }

  public update(
    artistId: string,
    changes: UpdateArtistRequest,
  ): Promise<ApiResult<ArtistResponse>> {
    return this.transport.patch(ApiRoute.Artist, {
      params: { artistId },
      body: changes,
    });
  }

  /**
   * Replace an artist's links with these, in order.
   */
  public setLinks(
    artistId: string,
    links: SetLinksRequest['links'],
  ): Promise<ApiResult<ArtistLinkResponse[]>> {
    return this.transport.put(ApiRoute.ArtistLinks, {
      params: { artistId },
      body: { links },
    });
  }

  /**
   * Get somewhere to upload an avatar or header. Upload the file there, then
   * call `confirmImage` with the object key.
   */
  public createImageUpload(
    artistId: string,
    kind: ArtistImageKind,
    contentType: string,
  ): Promise<ApiResult<UploadTargetResponse>> {
    return this.transport.post(ApiRoute.ArtistImageUploads, {
      params: { artistId, kind },
      body: { contentType },
    });
  }

  /**
   * Record an uploaded avatar or header, replacing the old one.
   */
  public confirmImage(
    artistId: string,
    kind: ArtistImageKind,
    objectKey: string,
  ): Promise<ApiResult<SignedUrlResponse>> {
    return this.transport.put(ApiRoute.ArtistImage, {
      params: { artistId, kind },
      body: { objectKey },
    });
  }

  public removeImage(
    artistId: string,
    kind: ArtistImageKind,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ArtistImage, {
      params: { artistId, kind },
    });
  }

  public listManagers(
    artistId: string,
  ): Promise<ApiResult<ArtistManagerResponse[]>> {
    return this.transport.get(ApiRoute.ArtistManagers, {
      params: { artistId },
    });
  }

  /**
   * Add a manager by username.
   */
  public addManager(
    artistId: string,
    manager: AddManagerRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.ArtistManagers, {
      params: { artistId },
      body: manager,
    });
  }

  public removeManager(
    artistId: string,
    userId: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ArtistManager, {
      params: { artistId, userId },
    });
  }
}
