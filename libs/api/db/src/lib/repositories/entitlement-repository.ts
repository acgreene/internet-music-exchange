import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  artists,
  type Entitlement,
  entitlements,
  type EntitlementSource,
  orderItems,
  type ReleaseKind,
  releases,
} from '../tables';

/**
 * A release a user owns, with the release fields a library view renders. Cover
 * art is resolved separately so a whole page of them takes one query.
 */
export interface LibraryItem {
  releaseId: string;
  title: string;
  kind: ReleaseKind;
  artistId: string;
  artistName: string;
  source: EntitlementSource;
  acquiredAt: Date;
}

export interface GrantEntitlementParams {
  userId: string;
  releaseId: string;
  source: EntitlementSource;
  orderItemId?: string | null;
}

const DEFAULT_LIBRARY_LIMIT = 24;

/**
 * Queries for who owns which release. Every route that serves audio or a gated
 * asset asks here first, and grants only ever come from a settled payment, a
 * free acquisition or an artist's gift.
 */
export class EntitlementRepository {
  constructor(private readonly db: Db) {}

  /**
   * Report whether a user owns a release.
   *
   * @param userId - The id of the user to check.
   * @param releaseId - The id of the release being served.
   * @returns True when the user is entitled to it.
   */
  public async owns(userId: string, releaseId: string): Promise<boolean> {
    const [entitlement] = await this.db
      .select({ userId: entitlements.userId })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          eq(entitlements.releaseId, releaseId),
        ),
      )
      .limit(1);

    return Boolean(entitlement);
  }

  /**
   * Narrow a set of releases to the ones a user already owns, so a catalog page
   * resolves its ownership badges in a single query.
   *
   * @param userId - The id of the user to check.
   * @param releaseIds - The ids of the releases being shown.
   * @returns The subset of those ids the user is entitled to.
   */
  public async filterOwned(
    userId: string,
    releaseIds: string[],
  ): Promise<string[]> {
    if (releaseIds.length === 0) return [];

    const owned = await this.db
      .select({ releaseId: entitlements.releaseId })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          inArray(entitlements.releaseId, releaseIds),
        ),
      );

    return owned.map((row) => row.releaseId);
  }

  /**
   * Read a user's entitlement to a release, including how they came by it.
   *
   * @param userId - The id of the owning user.
   * @param releaseId - The id of the release.
   * @returns The entitlement row, or null when the user does not own it.
   */
  public async get(
    userId: string,
    releaseId: string,
  ): Promise<Entitlement | null> {
    const [entitlement] = await this.db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          eq(entitlements.releaseId, releaseId),
        ),
      )
      .limit(1);

    return entitlement ?? null;
  }

  /**
   * List the releases a user owns, newest acquisition first.
   *
   * @param userId - The id of the user whose library to read.
   * @param limit - The maximum number of releases to return.
   * @param offset - How many releases to skip, for paging.
   * @returns One entry per owned release with its artist and how it was
   * acquired.
   */
  public async listLibrary(
    userId: string,
    limit: number = DEFAULT_LIBRARY_LIMIT,
    offset = 0,
  ): Promise<LibraryItem[]> {
    return this.db
      .select({
        releaseId: releases.id,
        title: releases.title,
        kind: releases.kind,
        artistId: artists.id,
        artistName: artists.name,
        source: entitlements.source,
        acquiredAt: entitlements.createdAt,
      })
      .from(entitlements)
      .innerJoin(releases, eq(releases.id, entitlements.releaseId))
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(eq(entitlements.userId, userId))
      .orderBy(desc(entitlements.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count how many users own a release.
   *
   * @param releaseId - The id of the release to count owners for.
   * @returns The number of users entitled to it.
   */
  public async countOwners(releaseId: string): Promise<number> {
    const [owners] = await this.db
      .select({ value: count() })
      .from(entitlements)
      .where(eq(entitlements.releaseId, releaseId));

    return owners?.value ?? 0;
  }

  /**
   * Give a user ownership of a release. Granting one they already own leaves
   * the original grant in place.
   *
   * @param params - The user, the release, how it was acquired and the line item
   * that paid for it when the source is a purchase.
   * @returns The user's entitlement to that release, new or pre-existing.
   */
  public async grant(params: GrantEntitlementParams): Promise<Entitlement> {
    const [granted] = await this.db
      .insert(entitlements)
      .values(params)
      // a no-op update so a release the user already owns still returns its
      // original grant rather than nothing
      .onConflictDoUpdate({
        target: [entitlements.userId, entitlements.releaseId],
        set: { releaseId: sql`excluded.release_id` },
      })
      .returning();

    return granted;
  }

  /**
   * Give users ownership of several releases at once, as when a settled cart
   * holds more than one digital item.
   *
   * @param params - One grant per user and release; those already owned are
   * left as they are.
   */
  public async grantMany(params: GrantEntitlementParams[]): Promise<void> {
    if (params.length === 0) return;

    await this.db.insert(entitlements).values(params).onConflictDoNothing();
  }

  /**
   * Take away a user's ownership of a release.
   *
   * @param userId - The id of the user losing access.
   * @param releaseId - The id of the release.
   */
  public async revoke(userId: string, releaseId: string): Promise<void> {
    await this.db
      .delete(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          eq(entitlements.releaseId, releaseId),
        ),
      );
  }

  /**
   * Take away every entitlement a refunded artist order granted, leaving
   * releases the buyer acquired some other way untouched.
   *
   * @param artistOrderId - The id of the refunded artist order.
   * @returns How many entitlements were removed.
   */
  public async revokeByArtistOrderId(artistOrderId: string): Promise<number> {
    const revoked = await this.db
      .delete(entitlements)
      .where(
        inArray(
          entitlements.orderItemId,
          this.db
            .select({ id: orderItems.id })
            .from(orderItems)
            .where(eq(orderItems.artistOrderId, artistOrderId)),
        ),
      )
      .returning({ releaseId: entitlements.releaseId });

    return revoked.length;
  }
}
