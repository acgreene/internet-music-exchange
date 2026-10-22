import {
  type AckResponse,
  ApiRoute,
  type AssetChangesRequest,
  type ConfirmAssetRequest,
  type CreateReleaseRequest,
  type ManagedReleaseResponse,
  type PricingResponse,
  type ReleaseAssetKind,
  type ReleaseAssetResponse,
  type ReleaseResponse,
  type SetPricingRequest,
  type TrackChangesRequest,
  type TrackRequest,
  type TrackResponse,
  type UpdateReleaseRequest,
  type UploadTargetResponse,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Releases for their artist's managers: drafts, tracks, audio, artwork,
 * pricing, publishing, and gifting. Files upload in two steps: ask for an
 * upload target, send the file there, then confirm its object key.
 */
export class ReleasesClient {
  constructor(private readonly transport: ApiTransport) {}

  public create(
    artistId: string,
    release: CreateReleaseRequest,
  ): Promise<ApiResult<ReleaseResponse>> {
    return this.transport.post(ApiRoute.ArtistReleases, {
      params: { artistId },
      body: release,
    });
  }

  /**
   * Every release of an artist, drafts included.
   */
  public listForArtist(
    artistId: string,
  ): Promise<ApiResult<ReleaseResponse[]>> {
    return this.transport.get(ApiRoute.ArtistReleases, {
      params: { artistId },
    });
  }

  /**
   * A release with its tracks, audio, pricing, and assets.
   */
  public get(releaseId: string): Promise<ApiResult<ManagedReleaseResponse>> {
    return this.transport.get(ApiRoute.Release, { params: { releaseId } });
  }

  public update(
    releaseId: string,
    changes: UpdateReleaseRequest,
  ): Promise<ApiResult<ReleaseResponse>> {
    return this.transport.patch(ApiRoute.Release, {
      params: { releaseId },
      body: changes,
    });
  }

  /**
   * Delete a draft and its files.
   */
  public delete(releaseId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.Release, { params: { releaseId } });
  }

  public setPricing(
    releaseId: string,
    pricing: SetPricingRequest,
  ): Promise<ApiResult<PricingResponse>> {
    return this.transport.put(ApiRoute.ReleasePricing, {
      params: { releaseId },
      body: pricing,
    });
  }

  public publish(releaseId: string): Promise<ApiResult<ReleaseResponse>> {
    return this.transport.post(ApiRoute.ReleasePublish, {
      params: { releaseId },
    });
  }

  public archive(releaseId: string): Promise<ApiResult<ReleaseResponse>> {
    return this.transport.post(ApiRoute.ReleaseArchive, {
      params: { releaseId },
    });
  }

  public addTrack(
    releaseId: string,
    track: TrackRequest,
  ): Promise<ApiResult<TrackResponse>> {
    return this.transport.post(ApiRoute.ReleaseTracks, {
      params: { releaseId },
      body: track,
    });
  }

  /**
   * Set the track order. Every track on the release must be listed once.
   */
  public reorderTracks(
    releaseId: string,
    trackIds: string[],
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.ReleaseTracks, {
      params: { releaseId },
      body: { trackIds },
    });
  }

  public updateTrack(
    trackId: string,
    changes: TrackChangesRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.patch(ApiRoute.Track, {
      params: { trackId },
      body: changes,
    });
  }

  public removeTrack(
    releaseId: string,
    trackId: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ReleaseTrack, {
      params: { releaseId, trackId },
    });
  }

  public setTrackPreview(
    releaseId: string,
    trackId: string,
    isPreview: boolean,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.ReleaseTrackPreview, {
      params: { releaseId, trackId },
      body: { isPreview },
    });
  }

  public createAudioUpload(
    releaseId: string,
    trackId: string,
    contentType: string,
  ): Promise<ApiResult<UploadTargetResponse>> {
    return this.transport.post(ApiRoute.TrackAudioUploads, {
      params: { releaseId, trackId },
      body: { contentType },
    });
  }

  /**
   * Record a track's uploaded audio, replacing any earlier upload.
   */
  public confirmAudio(
    releaseId: string,
    trackId: string,
    objectKey: string,
    durationMs?: number | null,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.TrackAudio, {
      params: { releaseId, trackId },
      body: { objectKey, durationMs },
    });
  }

  public createAssetUpload(
    releaseId: string,
    kind: ReleaseAssetKind,
    contentType: string,
  ): Promise<ApiResult<UploadTargetResponse>> {
    return this.transport.post(ApiRoute.ReleaseAssetUploads, {
      params: { releaseId },
      body: { kind, contentType },
    });
  }

  public confirmAsset(
    releaseId: string,
    asset: ConfirmAssetRequest,
  ): Promise<ApiResult<ReleaseAssetResponse>> {
    return this.transport.post(ApiRoute.ReleaseAssets, {
      params: { releaseId },
      body: asset,
    });
  }

  public updateAsset(
    assetId: string,
    changes: AssetChangesRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.patch(ApiRoute.ReleaseAsset, {
      params: { assetId },
      body: changes,
    });
  }

  public deleteAsset(assetId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ReleaseAsset, {
      params: { assetId },
    });
  }

  /**
   * Give a listener the release, by username.
   */
  public gift(
    releaseId: string,
    username: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.ReleaseGifts, {
      params: { releaseId },
      body: { username },
    });
  }
}
