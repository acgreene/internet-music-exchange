import { ApiRoute, HttpMethod } from '@ime/models';
import type { ReleaseService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Releases for their artist's managers: drafts, tracks, audio, artwork,
 * pricing, publishing, and gifting.
 */
export class ReleasesRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly releases: ReleaseService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(
      HttpMethod.Post,
      ApiRoute.ArtistReleases,
      'user',
      ({ userId, params, body }) =>
        this.releases.create(userId, params.artistId, body),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistReleases,
      'user',
      ({ userId, params }) =>
        this.releases.listForManager(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.Release,
      'user',
      ({ userId, params }) =>
        this.releases.getForManager(userId, params.releaseId),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.Release,
      'user',
      ({ userId, params, body }) =>
        this.releases.update(userId, params.releaseId, body),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.Release,
      'user',
      ({ userId, params }) => this.releases.delete(userId, params.releaseId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ReleasePricing,
      'user',
      ({ userId, params, body }) =>
        this.releases.setPricing(userId, params.releaseId, body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleasePublish,
      'user',
      ({ userId, params }) => this.releases.publish(userId, params.releaseId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseArchive,
      'user',
      ({ userId, params }) => this.releases.archive(userId, params.releaseId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseTracks,
      'user',
      ({ userId, params, body }) =>
        this.releases.addTrack(userId, params.releaseId, body),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ReleaseTracks,
      'user',
      ({ userId, params, body }) =>
        this.releases.reorderTracks(userId, params.releaseId, body.trackIds),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.Track,
      'user',
      ({ userId, params, body }) =>
        this.releases.updateTrack(userId, params.trackId, body),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ReleaseTrack,
      'user',
      ({ userId, params }) =>
        this.releases.removeTrack(userId, params.releaseId, params.trackId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ReleaseTrackPreview,
      'user',
      ({ userId, params, body }) =>
        this.releases.setTrackPreview(
          userId,
          params.releaseId,
          params.trackId,
          body.isPreview,
        ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.TrackAudioUploads,
      'user',
      ({ userId, params, body }) =>
        this.releases.createAudioUpload(
          userId,
          params.releaseId,
          params.trackId,
          body.contentType,
        ),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.TrackAudio,
      'user',
      ({ userId, params, body }) =>
        this.releases.confirmAudioUpload(
          userId,
          params.releaseId,
          params.trackId,
          body.objectKey,
          body.durationMs,
        ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseAssetUploads,
      'user',
      ({ userId, params, body }) =>
        this.releases.createAssetUpload(
          userId,
          params.releaseId,
          body.kind,
          body.contentType,
        ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseAssets,
      'user',
      ({ userId, params, body }) =>
        this.releases.confirmAssetUpload(userId, params.releaseId, body),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.ReleaseAsset,
      'user',
      ({ userId, params, body }) =>
        this.releases.updateAsset(userId, params.assetId, body),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ReleaseAsset,
      'user',
      ({ userId, params }) => this.releases.deleteAsset(userId, params.assetId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseGifts,
      'user',
      ({ userId, params, body }) =>
        this.releases.gift(userId, params.releaseId, body.username),
    );
  }
}
