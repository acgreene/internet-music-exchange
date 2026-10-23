import {
  type AckResponse,
  ApiRoute,
  type BuiltCrate,
  type CrateCard,
  type CratePage,
  type CreateCrateRequest,
  type DigSession,
  type MyCrate,
  type PageQuery,
  type UpdateCrateRequest,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Crates people make and the ones IME builds, and following crate makers.
 */
export class CratesClient {
  constructor(private readonly transport: ApiTransport) {}

  /** Public crates, the most recently changed first, or by name with `q`. */
  public listPublic(
    page?: PageQuery & { q?: string; releaseId?: string },
  ): Promise<ApiResult<CrateCard[]>> {
    return this.transport.get(ApiRoute.Crates, { query: page });
  }

  /** The signed-in user's crates, and which hold a release when given one. */
  public listMine(releaseId?: string): Promise<ApiResult<MyCrate[]>> {
    return this.transport.get(ApiRoute.MyCrates, {
      query: releaseId ? { releaseId } : {},
    });
  }

  public get(crateId: string): Promise<ApiResult<CratePage>> {
    return this.transport.get(ApiRoute.Crate, { params: { crateId } });
  }

  public create(crate: CreateCrateRequest): Promise<ApiResult<CrateCard>> {
    return this.transport.post(ApiRoute.Crates, { body: crate });
  }

  public update(
    crateId: string,
    changes: UpdateCrateRequest,
  ): Promise<ApiResult<CrateCard>> {
    return this.transport.patch(ApiRoute.Crate, {
      params: { crateId },
      body: changes,
    });
  }

  public delete(crateId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.Crate, { params: { crateId } });
  }

  public addRelease(
    crateId: string,
    releaseId: string,
    note?: string | null,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.CrateReleases, {
      params: { crateId },
      body: { releaseId, note },
    });
  }

  public reorder(
    crateId: string,
    releaseIds: string[],
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.CrateReleases, {
      params: { crateId },
      body: { releaseIds },
    });
  }

  public setReleaseNote(
    crateId: string,
    releaseId: string,
    note: string | null,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.patch(ApiRoute.CrateRelease, {
      params: { crateId, releaseId },
      body: { note },
    });
  }

  public removeRelease(
    crateId: string,
    releaseId: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.CrateRelease, {
      params: { crateId, releaseId },
    });
  }

  /** A crate IME builds from a genre or a tag. */
  public bySound(sound: {
    genre?: string;
    tag?: string;
  }): Promise<ApiResult<BuiltCrate>> {
    return this.transport.get(ApiRoute.CrateBySound, { query: sound });
  }

  /** A crate IME builds from up to five records someone loves. */
  public fromRecords(releaseIds: string[]): Promise<ApiResult<BuiltCrate>> {
    return this.transport.post(ApiRoute.CrateFromRecords, {
      body: { releaseIds },
    });
  }

  /** Today's crate from the signed-in listener's library, if they own any. */
  public ofTheDay(): Promise<ApiResult<BuiltCrate | null>> {
    return this.transport.get(ApiRoute.CrateOfTheDay);
  }

  /** Dig a crate someone made, as deep as the listener chose. */
  public digCrate(
    crateId: string,
    depth: number,
  ): Promise<ApiResult<DigSession>> {
    return this.transport.get(ApiRoute.DigCrate, {
      params: { crateId },
      query: { depth },
    });
  }

  /** Dig a crate IME builds from a genre or a tag. */
  public digSound(
    sound: { genre?: string; tag?: string },
    depth: number,
  ): Promise<ApiResult<DigSession>> {
    return this.transport.get(ApiRoute.DigSound, {
      query: { ...sound, depth },
    });
  }

  /** New public crates by the people the signed-in user follows. */
  public listFromFollowed(): Promise<ApiResult<CrateCard[]>> {
    return this.transport.get(ApiRoute.FollowedCrates);
  }

  public listByUsername(username: string): Promise<ApiResult<CrateCard[]>> {
    return this.transport.get(ApiRoute.UserCrates, { params: { username } });
  }

  public followMaker(userId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.UserFollow, { params: { userId } });
  }

  public unfollowMaker(userId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.UserFollow, { params: { userId } });
  }
}
