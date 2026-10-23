import { and, asc, count, eq, inArray, lte, max, min, sql } from 'drizzle-orm';
import type { Db } from '../database-service';
import { chartEntries, entitlements } from '../tables';

/** Formats a chart can be narrowed to. */
export type ChartFormat = 'digital' | 'vinyl' | 'cassette' | 'cd';

/**
 * `selling` counts the people who paid for a release, as a download or a
 * record, tape, or CD. `downloads` counts the people who got its download,
 * paid or free.
 */
export type ChartKind = 'selling' | 'downloads';

export interface ChartCount {
  releaseId: string;
  people: number;
}

/**
 * Queries behind the charts: how many people bought, or got the download of,
 * each release in a window, and the weekly charts kept for each release's
 * peak and its weeks on the chart. Each person counts once per release, and
 * a gift is never counted.
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
    chart: ChartKind,
    from: Date | null,
    to: Date,
    options: { genre?: string; format?: ChartFormat; limit: number },
  ): Promise<ChartCount[]> {
    const rows = await this.db.execute<{ release_id: string; people: number }>(
      sql`with got as (${this.acquisitions(chart, from, to)})
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
    chart: ChartKind,
    from: Date,
    to: Date,
  ): Promise<(ChartCount & { genres: string[] })[]> {
    const rows = await this.db.execute<{
      release_id: string;
      genres: string[];
      people: number;
    }>(
      sql`with got as (${this.acquisitions(chart, from, to)})
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

  /** The newest week with a chart kept, as `YYYY-MM-DD`. */
  public async latestWeek(chart: ChartKind): Promise<string | null> {
    const [row] = await this.db
      .select({ week: max(chartEntries.weekStart) })
      .from(chartEntries)
      .where(eq(chartEntries.chart, chart));
    return row?.week ?? null;
  }

  public async addWeek(
    chart: ChartKind,
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
          entries
            .slice(i, i + 1000)
            .map((entry) => ({ ...entry, chart, weekStart })),
        )
        .onConflictDoNothing();
    }
  }

  /**
   * Each release's best place and how many weeks it spent on one weekly
   * chart, up to a week.
   */
  public async listHistory(
    chart: ChartKind,
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
          eq(chartEntries.chart, chart),
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
   * Everyone a chart counts for a release, with when and in what format.
   * Selling counts paid downloads and records, tapes, and CDs from completed
   * orders; downloads counts every download from the library, paid or free.
   */
  private acquisitions(chart: ChartKind, from: Date | null, to: Date) {
    const after = (column: string) =>
      from ? sql`and ${sql.raw(column)} >= ${from.toISOString()}` : sql``;
    const sources =
      chart === 'selling' ? sql`('purchase')` : sql`('purchase', 'free')`;
    const downloads = sql`
      select e.release_id, e.user_id, 'digital' as format, e.created_at as at
      from entitlements e
      where e.source in ${sources}
        and e.created_at < ${to.toISOString()} ${after('e.created_at')}`;
    if (chart === 'downloads') return downloads;
    return sql`${downloads}
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
