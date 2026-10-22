import { and, asc, count, eq, inArray, lte, max, min, sql } from 'drizzle-orm';
import type { Db } from '../database-service';
import { chartEntries, entitlements } from '../tables';

/** Formats a chart can be narrowed to. */
export type ChartFormat = 'digital' | 'vinyl' | 'cassette' | 'cd';

export interface ChartCount {
  releaseId: string;
  people: number;
}

/**
 * Queries behind the charts: how many people bought or claimed each release
 * in a window, and the weekly charts kept for each release's peak and its
 * weeks on the chart. A gift is not counted; a free download counts the same
 * as a purchase.
 */
export class ChartRepository {
  constructor(private readonly db: Db) {}

  /**
   * Releases on sale by how many people got them between two moments, the
   * most first, ties going to the one that got there first.
   *
   * @param from - Inclusive.
   * @param to - Exclusive.
   */
  public async countPeople(
    from: Date | null,
    to: Date,
    options: { genre?: string; format?: ChartFormat; limit: number },
  ): Promise<ChartCount[]> {
    const rows = await this.db.execute<{ release_id: string; people: number }>(
      sql`with got as (${this.acquisitions(from, to)})
          select got.release_id, count(distinct got.user_id)::int as people
          from got
          join releases r on r.id = got.release_id
          join artists a on a.id = r.artist_id
          where r.status = 'published' and a.suspended_at is null and a.off_sale_at is null
            ${options.genre ? sql`and r.genres @> array[${options.genre}]::text[]` : sql``}
            ${options.format ? sql`and got.format = ${options.format}` : sql``}
          group by got.release_id
          order by people desc, min(got.at), got.release_id
          limit ${options.limit}`,
    );
    return rows.map((row) => ({
      releaseId: row.release_id,
      people: row.people,
    }));
  }

  /**
   * Every release anyone got in a week, in any format, with its genres, for
   * keeping that week's charts.
   */
  public async countWeek(
    from: Date,
    to: Date,
  ): Promise<(ChartCount & { genres: string[] })[]> {
    const rows = await this.db.execute<{
      release_id: string;
      genres: string[];
      people: number;
    }>(
      sql`with got as (${this.acquisitions(from, to)})
          select got.release_id, r.genres, count(distinct got.user_id)::int as people
          from got
          join releases r on r.id = got.release_id
          join artists a on a.id = r.artist_id
          where r.status = 'published' and a.suspended_at is null and a.off_sale_at is null
          group by got.release_id, r.genres
          order by people desc, min(got.at), got.release_id`,
    );
    return rows.map((row) => ({
      releaseId: row.release_id,
      genres: row.genres,
      people: row.people,
    }));
  }

  /** When the first release was bought or claimed, if ever. */
  public async firstAcquisition(): Promise<Date | null> {
    const [row] = await this.db
      .select({ first: min(entitlements.createdAt) })
      .from(entitlements);
    return row?.first ?? null;
  }

  /** The newest week with charts kept, as `YYYY-MM-DD`. */
  public async latestWeek(): Promise<string | null> {
    const [row] = await this.db
      .select({ week: max(chartEntries.weekStart) })
      .from(chartEntries);
    return row?.week ?? null;
  }

  public async addWeek(
    weekStart: string,
    entries: {
      scope: string;
      releaseId: string;
      position: number;
      people: number;
    }[],
  ): Promise<void> {
    if (entries.length === 0) return;
    for (let i = 0; i < entries.length; i += 1000) {
      await this.db
        .insert(chartEntries)
        .values(
          entries.slice(i, i + 1000).map((entry) => ({ ...entry, weekStart })),
        )
        .onConflictDoNothing();
    }
  }

  /**
   * Each release's best place and how many weeks it spent on one weekly
   * chart, up to a week.
   */
  public async listHistory(
    scope: string,
    releaseIds: string[],
    upTo: string,
  ): Promise<{ releaseId: string; peak: number; weeks: number }[]> {
    if (releaseIds.length === 0) return [];
    const rows = await this.db
      .select({
        releaseId: chartEntries.releaseId,
        peak: min(chartEntries.position),
        weeks: count(),
      })
      .from(chartEntries)
      .where(
        and(
          eq(chartEntries.scope, scope),
          inArray(chartEntries.releaseId, releaseIds),
          lte(chartEntries.weekStart, upTo),
        ),
      )
      .groupBy(chartEntries.releaseId)
      .orderBy(asc(chartEntries.releaseId));
    return rows.map((row) => ({
      releaseId: row.releaseId,
      peak: row.peak ?? 0,
      weeks: row.weeks,
    }));
  }

  /**
   * Everyone who bought or claimed a release, and when and in what format:
   * downloads from the library, and records, tapes, and CDs from completed
   * orders.
   */
  private acquisitions(from: Date | null, to: Date) {
    const after = (column: string) =>
      from ? sql`and ${sql.raw(column)} >= ${from.toISOString()}` : sql``;
    return sql`
      select e.release_id, e.user_id, 'digital' as format, e.created_at as at
      from entitlements e
      where e.source in ('purchase', 'free')
        and e.created_at < ${to.toISOString()} ${after('e.created_at')}
      union all
      select p.release_id, o.user_id, p.type::text as format, oi.created_at as at
      from order_items oi
      join product_variants v on v.id = oi.product_variant_id
      join products p on p.id = v.product_id
      join artist_orders ao on ao.id = oi.artist_order_id
      join orders o on o.id = ao.order_id
      where ao.status = 'completed' and o.user_id is not null
        and p.release_id is not null and p.type in ('vinyl', 'cassette', 'cd')
        and oi.created_at < ${to.toISOString()} ${after('oi.created_at')}`;
  }
}
