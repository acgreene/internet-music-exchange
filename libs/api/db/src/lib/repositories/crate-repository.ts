import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  max,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  artists,
  type Crate,
  entitlements,
  crateReleases,
  crates,
  crateSaves,
  type CrateVisibility,
  releasePricing,
  releases,
  userFollowers,
  users,
} from '../tables';
import type { ShelfRelease } from './shelf-repository';

/** A crate as lists show it: who made it and how many records it holds. */
export interface CrateSummary extends Crate {
  ownerUsername: string | null;
  itemCount: number;
  /** How many people saved it. */
  saves: number;
}

/** A release in a crate, with the maker's line about it. */
export interface CrateItem extends ShelfRelease {
  position: number;
  note: string | null;
  /** Published by an artist in good standing, so anyone can see it. */
  available: boolean;
}

export interface CrateChanges {
  name?: string;
  note?: string | null;
  visibility?: CrateVisibility;
}

const DEFAULT_LIST_LIMIT = 24;

const itemCount =
  sql<number>`(select count(*) from ${crateReleases} where ${crateReleases.crateId} = ${crates.id})`.mapWith(
    Number,
  );

const saves =
  sql<number>`(select count(*) from ${crateSaves} where ${crateSaves.crateId} = ${crates.id})`.mapWith(
    Number,
  );

/**
 * A crate is in a genre when at least a third of its records carry it, so
 * one odd record does not put it there.
 */
const inGenre = (genre: string) =>
  sql`(select count(*) from ${crateReleases} inner join ${releases} on ${releases.id} = ${crateReleases.releaseId} where ${crateReleases.crateId} = ${crates.id} and ${genre} = any(${releases.genres})) * 3 >= ${itemCount}`;

/**
 * Queries for crates, the records in them, saving them, and following the
 * people who make them.
 */
export class CrateRepository {
  constructor(private readonly db: Db) {}

  public async create(params: {
    ownerUserId: string;
    name: string;
    note: string | null;
    visibility: CrateVisibility;
  }): Promise<Crate> {
    const [crate] = await this.db.insert(crates).values(params).returning();
    return crate;
  }

  public async getById(crateId: string): Promise<CrateSummary | null> {
    const [crate] = await this.summaries(eq(crates.id, crateId)).limit(1);
    return crate ?? null;
  }

  public async updateById(
    crateId: string,
    changes: CrateChanges,
  ): Promise<void> {
    await this.db
      .update(crates)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(crates.id, crateId));
  }

  public async deleteById(crateId: string): Promise<void> {
    await this.db.delete(crates).where(eq(crates.id, crateId));
  }

  /** Someone's crates, the most recently changed first. */
  public async listByOwner(
    ownerUserId: string,
    visibility?: CrateVisibility,
  ): Promise<CrateSummary[]> {
    return this.summaries(
      and(
        eq(crates.ownerUserId, ownerUserId),
        visibility ? eq(crates.visibility, visibility) : undefined,
      ),
    ).orderBy(desc(crates.updatedAt));
  }

  /** Public crates with records in them, the most recently changed first. */
  public async listPublic(
    limit = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<CrateSummary[]> {
    return this.summaries(this.publicWithRecords())
      .orderBy(desc(crates.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  /** Public crates holding a release, the most recently changed first. */
  public async listPublicHolding(
    releaseId: string,
    limit = DEFAULT_LIST_LIMIT,
  ): Promise<CrateSummary[]> {
    return this.summaries(
      and(
        this.publicWithRecords(),
        inArray(
          crates.id,
          this.db
            .select({ id: crateReleases.crateId })
            .from(crateReleases)
            .where(eq(crateReleases.releaseId, releaseId)),
        ),
      ),
    )
      .orderBy(desc(crates.updatedAt))
      .limit(limit);
  }

  /** Public crates with records, the most saved first. */
  public async listMostSaved(
    limit = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<CrateSummary[]> {
    return this.summaries(this.publicWithRecords())
      .orderBy(desc(saves), desc(crates.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  /** Public crates in a genre, the most saved first. */
  public async listPublicInGenre(
    genre: string,
    limit = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<CrateSummary[]> {
    return this.summaries(and(this.publicWithRecords(), inGenre(genre)))
      .orderBy(desc(saves), desc(crates.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Public crates holding any of some releases, other than one crate, the
   * most saved first.
   */
  public async listPublicHoldingAny(
    releaseIds: string[],
    exceptCrateId: string,
    limit = DEFAULT_LIST_LIMIT,
  ): Promise<CrateSummary[]> {
    if (releaseIds.length === 0) return [];
    return this.summaries(
      and(
        this.publicWithRecords(),
        sql`${crates.id} <> ${exceptCrateId}`,
        inArray(
          crates.id,
          this.db
            .select({ id: crateReleases.crateId })
            .from(crateReleases)
            .where(inArray(crateReleases.releaseId, releaseIds)),
        ),
      ),
    )
      .orderBy(desc(saves), desc(crates.updatedAt))
      .limit(limit);
  }

  /** How many of each crate's records carry each genre, among some crates. */
  public async countGenres(
    crateIds: string[],
  ): Promise<{ crateId: string; genre: string; count: number }[]> {
    if (crateIds.length === 0) return [];
    const genre = sql<string>`unnest(${releases.genres})`;
    return this.db
      .select({
        crateId: crateReleases.crateId,
        genre,
        count: count(),
      })
      .from(crateReleases)
      .innerJoin(releases, eq(releases.id, crateReleases.releaseId))
      .where(inArray(crateReleases.crateId, crateIds))
      .groupBy(crateReleases.crateId, genre);
  }

  /** Save someone's crate. Saving it again changes nothing. */
  public async save(userId: string, crateId: string): Promise<void> {
    await this.db
      .insert(crateSaves)
      .values({ userId, crateId })
      .onConflictDoNothing();
  }

  public async unsave(userId: string, crateId: string): Promise<void> {
    await this.db
      .delete(crateSaves)
      .where(
        and(eq(crateSaves.userId, userId), eq(crateSaves.crateId, crateId)),
      );
  }

  public async isSaved(userId: string, crateId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ crateId: crateSaves.crateId })
      .from(crateSaves)
      .where(
        and(eq(crateSaves.userId, userId), eq(crateSaves.crateId, crateId)),
      )
      .limit(1);
    return !!row;
  }

  /** Public crates by the people a listener follows, newest first. */
  public async listPublicFromFollowed(
    userId: string,
    limit = DEFAULT_LIST_LIMIT,
  ): Promise<CrateSummary[]> {
    return this.summaries(
      and(
        this.publicWithRecords(),
        inArray(
          crates.ownerUserId,
          this.db
            .select({ id: userFollowers.followedUserId })
            .from(userFollowers)
            .where(eq(userFollowers.followerUserId, userId)),
        ),
      ),
    )
      .orderBy(desc(crates.createdAt))
      .limit(limit);
  }

  /** Public crates by name, for search. */
  public async searchPublic(
    text: string,
    limit: number,
  ): Promise<CrateSummary[]> {
    return this.summaries(
      and(
        this.publicWithRecords(),
        sql`${crates.name} ilike ${`%${text.replace(/[\\%_]/g, '\\$&')}%`}`,
      ),
    )
      .orderBy(desc(crates.updatedAt))
      .limit(limit);
  }

  /** The releases in a crate, in its order. */
  public async listItems(crateId: string): Promise<CrateItem[]> {
    return this.db
      .select({
        id: releases.id,
        title: releases.title,
        slug: releases.slug,
        kind: releases.kind,
        releasedAt: releases.releasedAt,
        publishedAt: releases.publishedAt,
        artistId: releases.artistId,
        artistName: artists.name,
        artistHandle: artists.handle,
        pricingMode: releasePricing.mode,
        currency: releasePricing.currency,
        minimumPrice: releasePricing.minimumPrice,
        suggestedPrice: releasePricing.suggestedPrice,
        position: crateReleases.position,
        note: crateReleases.note,
        available: sql<boolean>`${releases.status} = 'published' AND ${artists.suspendedAt} IS NULL AND ${artists.offSaleAt} IS NULL`,
      })
      .from(crateReleases)
      .innerJoin(releases, eq(releases.id, crateReleases.releaseId))
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(eq(crateReleases.crateId, crateId))
      .orderBy(asc(crateReleases.position));
  }

  /** The first few releases of each crate, for its cover mosaic. */
  public async listFirstReleaseIds(
    crateIds: string[],
    perCrate: number,
  ): Promise<{ crateId: string; releaseId: string }[]> {
    if (crateIds.length === 0) return [];
    return this.db
      .select({
        crateId: crateReleases.crateId,
        releaseId: crateReleases.releaseId,
      })
      .from(crateReleases)
      .innerJoin(releases, eq(releases.id, crateReleases.releaseId))
      .where(
        and(
          inArray(crateReleases.crateId, crateIds),
          lte(crateReleases.position, perCrate),
          eq(releases.status, 'published'),
        ),
      )
      .orderBy(asc(crateReleases.position));
  }

  /** Which of someone's crates already hold a release. */
  public async listOwnerCratesHolding(
    ownerUserId: string,
    releaseId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ crateId: crateReleases.crateId })
      .from(crateReleases)
      .innerJoin(crates, eq(crates.id, crateReleases.crateId))
      .where(
        and(
          eq(crates.ownerUserId, ownerUserId),
          eq(crateReleases.releaseId, releaseId),
        ),
      );
    return rows.map((row) => row.crateId);
  }

  /**
   * Put a release at the end of a crate.
   *
   * @returns False when it was already in the crate.
   */
  public async addRelease(
    crateId: string,
    releaseId: string,
    note: string | null,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [last] = await tx
        .select({ position: max(crateReleases.position) })
        .from(crateReleases)
        .where(eq(crateReleases.crateId, crateId));
      const added = await tx
        .insert(crateReleases)
        .values({
          crateId,
          releaseId,
          note,
          position: (last?.position ?? 0) + 1,
        })
        .onConflictDoNothing()
        .returning({ releaseId: crateReleases.releaseId });
      if (added.length) {
        await tx
          .update(crates)
          .set({ updatedAt: new Date() })
          .where(eq(crates.id, crateId));
      }
      return added.length > 0;
    });
  }

  public async setReleaseNote(
    crateId: string,
    releaseId: string,
    note: string | null,
  ): Promise<void> {
    await this.db
      .update(crateReleases)
      .set({ note })
      .where(
        and(
          eq(crateReleases.crateId, crateId),
          eq(crateReleases.releaseId, releaseId),
        ),
      );
  }

  /**
   * Put a crate's releases in a new order, dropping any left out, so
   * positions stay 1, 2, 3 with no gaps.
   */
  public async reorder(crateId: string, releaseIds: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(crateReleases)
        .where(eq(crateReleases.crateId, crateId));
      const byId = new Map(existing.map((row) => [row.releaseId, row]));
      const kept = releaseIds.filter((id) => byId.has(id));

      // the position constraint is not deferrable, so shuffling in place
      // would collide part way through
      await tx.delete(crateReleases).where(eq(crateReleases.crateId, crateId));
      if (kept.length) {
        await tx.insert(crateReleases).values(
          kept.flatMap((releaseId, i) => {
            const row = byId.get(releaseId);
            return row ? [{ ...row, position: i + 1 }] : [];
          }),
        );
      }
      await tx
        .update(crates)
        .set({ updatedAt: new Date() })
        .where(eq(crates.id, crateId));
    });
  }

  /**
   * Releases kept by the people who kept any of some seed releases, scored
   * by how many such people kept each against how many keep it at all, so a
   * record everyone keeps does not crowd out a kindred one.
   */
  public async scoreKeptAlongside(
    seedIds: string[],
    limit: number,
  ): Promise<{ releaseId: string; score: number }[]> {
    const seeds = sql.join(
      seedIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const rows = await this.db.execute<{ release_id: string; score: number }>(
      sql`select shared.release_id,
            shared.keepers / sqrt(totals.keepers)::float as score
          from (
            select theirs.release_id, count(distinct theirs.user_id) as keepers
            from ${entitlements} mine
            join ${entitlements} theirs on theirs.user_id = mine.user_id
            where mine.release_id in (${seeds}) and theirs.release_id not in (${seeds})
            group by theirs.release_id
          ) shared
          join (
            select release_id, count(distinct user_id) as keepers
            from ${entitlements}
            group by release_id
          ) totals on totals.release_id = shared.release_id
          order by score desc
          limit ${limit}`,
    );
    return rows.map((row) => ({ releaseId: row.release_id, score: row.score }));
  }

  /**
   * Releases that share public crates with any of some seed releases, with
   * how many crates each shares.
   */
  public async scoreCratedAlongside(
    seedIds: string[],
    limit: number,
  ): Promise<{ releaseId: string; score: number }[]> {
    const seeds = sql.join(
      seedIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const rows = await this.db.execute<{ release_id: string; score: number }>(
      sql`select other.release_id, count(distinct other.crate_id)::int as score
          from ${crateReleases} seed
          join ${crates} c on c.id = seed.crate_id and c.visibility = 'public'
          join ${crateReleases} other on other.crate_id = seed.crate_id
          where seed.release_id in (${seeds}) and other.release_id not in (${seeds})
          group by other.release_id
          order by score desc
          limit ${limit}`,
    );
    return rows.map((row) => ({ releaseId: row.release_id, score: row.score }));
  }

  public async countItems(crateId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(crateReleases)
      .where(eq(crateReleases.crateId, crateId));
    return row?.count ?? 0;
  }

  public async followUser(followerUserId: string, followedUserId: string) {
    await this.db
      .insert(userFollowers)
      .values({ followerUserId, followedUserId })
      .onConflictDoNothing();
  }

  public async unfollowUser(followerUserId: string, followedUserId: string) {
    await this.db
      .delete(userFollowers)
      .where(
        and(
          eq(userFollowers.followerUserId, followerUserId),
          eq(userFollowers.followedUserId, followedUserId),
        ),
      );
  }

  public async isFollowingUser(
    followerUserId: string,
    followedUserId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userFollowers.followedUserId })
      .from(userFollowers)
      .where(
        and(
          eq(userFollowers.followerUserId, followerUserId),
          eq(userFollowers.followedUserId, followedUserId),
        ),
      )
      .limit(1);
    return !!row;
  }

  public async countUserFollowers(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(userFollowers)
      .where(eq(userFollowers.followedUserId, userId));
    return row?.count ?? 0;
  }

  private summaries(where: SQL | undefined) {
    return this.db
      .select({
        id: crates.id,
        ownerUserId: crates.ownerUserId,
        name: crates.name,
        note: crates.note,
        visibility: crates.visibility,
        createdAt: crates.createdAt,
        updatedAt: crates.updatedAt,
        ownerUsername: users.username,
        itemCount,
        saves,
      })
      .from(crates)
      .innerJoin(users, eq(users.id, crates.ownerUserId))
      .where(where);
  }

  /** Public, by someone in good standing, and not empty. */
  private publicWithRecords(): SQL {
    return and(
      eq(crates.visibility, 'public'),
      isNull(users.suspendedAt),
      sql`${itemCount} > 0`,
    ) as SQL;
  }
}
