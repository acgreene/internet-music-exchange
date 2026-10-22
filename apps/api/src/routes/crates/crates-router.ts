import { ApiRoute, HttpMethod } from '@ime/models';
import type { CrateService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Crates people make and the ones IME builds, and following crate makers.
 */
export class CratesRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly crates: CrateService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    // the built crates come first, so their paths are not read as crate ids
    this.handle(HttpMethod.Get, ApiRoute.CrateBySound, 'public', ({ query }) =>
      this.crates.bySound(query.genre, query.tag),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.CrateFromRecords,
      'public',
      ({ body }) => this.crates.fromRecords(body.releaseIds),
    );

    this.handle(HttpMethod.Get, ApiRoute.CrateOfTheDay, 'user', ({ userId }) =>
      this.crates.ofTheDay(userId),
    );

    this.handle(HttpMethod.Get, ApiRoute.Crates, 'public', ({ query }) =>
      this.crates.listPublic(query.limit, query.offset),
    );

    this.handle(HttpMethod.Post, ApiRoute.Crates, 'user', ({ userId, body }) =>
      this.crates.create(userId, body),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.MyCrates,
      'user',
      ({ userId, query }) => this.crates.listMine(userId, query.releaseId),
    );

    this.handle(HttpMethod.Get, ApiRoute.FollowedCrates, 'user', ({ userId }) =>
      this.crates.listFromFollowed(userId),
    );

    this.handle(HttpMethod.Get, ApiRoute.UserCrates, 'public', ({ params }) =>
      this.crates.listByUsername(params.username),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.Crate,
      'optional',
      ({ params, userId }) => this.crates.get(params.crateId, userId),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.Crate,
      'user',
      ({ userId, params, body }) =>
        this.crates.update(userId, params.crateId, body),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.Crate,
      'user',
      ({ userId, params }) => this.crates.delete(userId, params.crateId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.CrateReleases,
      'user',
      ({ userId, params, body }) =>
        this.crates.addRelease(
          userId,
          params.crateId,
          body.releaseId,
          body.note,
        ),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.CrateReleases,
      'user',
      ({ userId, params, body }) =>
        this.crates.reorder(userId, params.crateId, body.releaseIds),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.CrateRelease,
      'user',
      ({ userId, params, body }) =>
        this.crates.setReleaseNote(
          userId,
          params.crateId,
          params.releaseId,
          body.note,
        ),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.CrateRelease,
      'user',
      ({ userId, params }) =>
        this.crates.removeRelease(userId, params.crateId, params.releaseId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.UserFollow,
      'user',
      ({ userId, params }) => this.crates.followMaker(userId, params.userId),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.UserFollow,
      'user',
      ({ userId, params }) => this.crates.unfollowMaker(userId, params.userId),
    );
  }
}
