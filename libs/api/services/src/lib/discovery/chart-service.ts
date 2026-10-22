import { type ChartFormat, DatabaseRepository } from '@ime/db';
import {
  CHART_PERIODS,
  type Chart,
  type ChartPeriod,
  type ChartQuery,
  isGenreId,
} from '@ime/models';
import { CloudStorageService } from '../storage';
import { CatalogCards } from './catalog-cards';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** How many releases a chart shows. */
const CHART_SIZE = 50;
/** How deep last week's chart is read, to tell a climber from a newcomer. */
const PREVIOUS_DEPTH = 200;
/** How many places each kept weekly chart holds. */
const KEPT_SIZE = 40;
const JOB = 'chart_week';

/**
 * Charts: releases ranked by how many people bought or claimed them, never by
 * money, for all of IME or one genre, over a week, four weeks, a year, or all
 * time, narrowed by format if asked. Every chart ends where this week began,
 * so charts change once a week. Each week's charts are kept, to show a
 * release's peak and its weeks on the chart.
 */
export class ChartService {
  private readonly cards: CatalogCards;

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    storage: CloudStorageService = new CloudStorageService(),
  ) {
    this.cards = new CatalogCards(db, storage);
  }

  public async get(query: ChartQuery, now: Date = new Date()): Promise<Chart> {
    const period: ChartPeriod = query.period ?? 'week';
    const genre = query.genre && isGenreId(query.genre) ? query.genre : null;
    const format = (query.format ?? null) as ChartFormat | null;
    const end = weekStart(now);
    await this.keepWeeks(end);

    const weeks = CHART_PERIODS.find((p) => p.id === period)?.weeks ?? null;
    const from = weeks ? new Date(end.getTime() - weeks * WEEK_MS) : null;
    const options = { genre: genre ?? undefined, format: format ?? undefined };
    const [counts, before] = await Promise.all([
      this.db.charts.countPeople(from, end, { ...options, limit: CHART_SIZE }),
      this.db.charts.countPeople(
        from && new Date(from.getTime() - WEEK_MS),
        new Date(end.getTime() - WEEK_MS),
        { ...options, limit: PREVIOUS_DEPTH },
      ),
    ]);

    const ids = counts.map((count) => count.releaseId);
    const lastWeek = isoDate(new Date(end.getTime() - WEEK_MS));
    const [rows, history] = await Promise.all([
      this.db.shelves.listOnSaleByIds(ids),
      this.db.charts.listHistory(genre ?? 'all', ids, lastWeek),
    ]);
    const cards = new Map(
      (await this.cards.releases(rows)).map((card) => [card.release.id, card]),
    );
    const previous = new Map(
      before.map((count, i) => [count.releaseId, i + 1]),
    );
    const kept = new Map(history.map((entry) => [entry.releaseId, entry]));

    return {
      period,
      genre,
      format,
      from: from && isoDate(from),
      through: isoDate(new Date(end.getTime() - DAY_MS)),
      entries: counts.flatMap((count, i) => {
        const card = cards.get(count.releaseId);
        if (!card) return [];
        return [
          {
            position: i + 1,
            release: card.release,
            pricing: card.pricing,
            people: count.people,
            previous: previous.get(count.releaseId) ?? null,
            peak: kept.get(count.releaseId)?.peak ?? null,
            weeks: kept.get(count.releaseId)?.weeks ?? 0,
          },
        ];
      }),
    };
  }

  /**
   * Keep every finished week's charts that are not kept yet, from the first
   * release anyone got. Each week is claimed first, so two requests never
   * count the same week twice.
   */
  private async keepWeeks(end: Date): Promise<void> {
    const latest = await this.db.charts.latestWeek();
    const first = latest
      ? new Date(new Date(`${latest}T00:00:00Z`).getTime() + WEEK_MS)
      : await this.db.charts.firstAcquisition().then((d) => d && weekStart(d));
    if (!first) return;
    for (
      let week = first;
      week < end;
      week = new Date(week.getTime() + WEEK_MS)
    ) {
      const key = isoDate(week);
      if (!(await this.db.jobRuns.claim(JOB, key))) continue;
      try {
        const counts = await this.db.charts.countWeek(
          week,
          new Date(week.getTime() + WEEK_MS),
        );
        await this.db.charts.addWeek(key, rankings(counts));
      } catch (error) {
        await this.db.jobRuns.release(JOB, key);
        throw error;
      }
    }
  }
}

/** A week's charts, all of IME and each genre, from its counts. */
function rankings(
  counts: { releaseId: string; genres: string[]; people: number }[],
) {
  const scopes = new Map<string, typeof counts>([['all', counts]]);
  for (const count of counts) {
    for (const genre of count.genres) {
      scopes.set(genre, [...(scopes.get(genre) ?? []), count]);
    }
  }
  return [...scopes].flatMap(([scope, ranked]) =>
    ranked.slice(0, KEPT_SIZE).map((count, i) => ({
      scope,
      releaseId: count.releaseId,
      position: i + 1,
      people: count.people,
    })),
  );
}

/** The Monday that starts a date's week, in UTC. */
function weekStart(date: Date): Date {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - sinceMonday * DAY_MS);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
