import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  type Params,
  Router,
  RouterLink,
} from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import {
  CHART_KINDS,
  CHART_PERIODS,
  type ChartEntry,
  type ChartKind,
  type ChartPeriod,
  FORMATS,
  GENRES,
  isGenreId,
} from '@ime/models';
import { AlertComponent, CoverComponent, SpinnerComponent } from '@ime/ui';

type Format = 'digital' | 'vinyl' | 'cassette' | 'cd';

const SEGMENT =
  'whitespace-nowrap rounded-control px-3 py-1.5 text-sm font-medium hover:bg-wash aria-pressed:bg-ink aria-pressed:text-canvas aria-pressed:hover:bg-ink';

/**
 * The charts, `/charts`: best selling, by how many people paid for each
 * release, and most downloaded, by how many people got its download, paid
 * or free. For the last week, four weeks, year, or all time, for all of IME
 * or one genre, and best selling for one format if chosen. Neither money nor
 * how many people is shown, only the order.
 */
@Component({
  selector: 'ime-charts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    CoverComponent,
    DatePipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-8">
      <header class="flex flex-col gap-4">
        <span class="font-mono text-xs tracking-wider text-ink-muted uppercase"
          >Charts</span
        >
        <div
          class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <h1
            class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-6xl"
          >
            {{ kind() === 'selling' ? 'Best selling' : 'Most downloaded' }}
          </h1>
          <div
            class="flex gap-1 self-start rounded-control border border-line p-1 md:self-auto"
            role="group"
            aria-label="Chart"
          >
            @for (option of kinds; track option.id) {
              <a
                [class]="segment"
                routerLink="/charts"
                [queryParams]="with({ chart: option.id })"
                [attr.aria-pressed]="kind() === option.id"
                >{{ option.name }}</a
              >
            }
          </div>
        </div>
        <p class="max-w-prose text-sm leading-relaxed md:text-base">
          @if (kind() === 'selling') {
            Ranked by how many people paid for each release, as a download or a
            record, tape, or CD. Each buyer counts once.
          } @else {
            Ranked by how many people got each release's download, paid or free.
            Each person counts once.
          }
          New charts every Monday.
        </p>
      </header>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex shrink-0 gap-1" role="group" aria-label="Period">
          @for (option of periods; track option.id) {
            <a
              [class]="segment"
              routerLink="/charts"
              [queryParams]="with({ period: option.id })"
              [attr.aria-pressed]="period() === option.id"
              >{{ option.name }}</a
            >
          }
        </div>
        @if (kind() === 'selling') {
          <span
            class="hidden h-6 w-px shrink-0 bg-line sm:block"
            aria-hidden="true"
          ></span>
          <div class="flex shrink-0 gap-1" role="group" aria-label="Format">
            <a
              [class]="segment"
              routerLink="/charts"
              [queryParams]="with({ format: undefined })"
              [attr.aria-pressed]="!format()"
              >All formats</a
            >
            @for (option of formats; track option.id) {
              <a
                [class]="segment"
                routerLink="/charts"
                [queryParams]="with({ format: option.id })"
                [attr.aria-pressed]="format() === option.id"
                >{{ option.name }}</a
              >
            }
          </div>
        }
        <span
          class="hidden h-6 w-px shrink-0 bg-line sm:block"
          aria-hidden="true"
        ></span>
        <label class="flex shrink-0 items-center gap-2 text-sm">
          <span class="sr-only">Genre</span>
          <select
            class="rounded-control border border-line bg-canvas px-2 py-1.5"
            (change)="pickGenre($any($event.target).value)"
          >
            <option value="" [selected]="!genre()">All genres</option>
            @for (option of genres; track option.id) {
              <option [value]="option.id" [selected]="genre() === option.id">
                {{ option.name }}
              </option>
            }
          </select>
        </label>
      </div>

      @if (chart(); as chart) {
        <section class="flex flex-col gap-3" aria-labelledby="chart-heading">
          <h2 id="chart-heading" class="text-sm text-ink-muted">
            @if (period() === 'week' && chart.from) {
              Week of {{ chart.from | date: 'MMM d, y' : 'UTC' }}
            } @else if (chart.from; as from) {
              {{ from | date: 'MMM d' : 'UTC' }} to
              {{ chart.through | date: 'MMM d, y' : 'UTC' }}
            } @else {
              All time, through {{ chart.through | date: 'MMM d, y' : 'UTC' }}
            }
          </h2>
          <ol
            class="flex flex-col divide-y divide-hairline border-y border-line"
          >
            @for (entry of chart.entries; track entry.release.id) {
              <li
                class="grid grid-cols-[2.5rem_3.5rem_minmax(0,1fr)] items-center gap-3 py-3 sm:grid-cols-[3rem_3rem_4rem_minmax(0,1fr)_auto]"
              >
                <span
                  class="text-right font-mono text-2xl font-bold tabular-nums"
                  >{{ entry.position }}</span
                >
                <span
                  class="hidden text-center font-mono text-xs sm:block"
                  [class]="movementClass(entry)"
                  [attr.aria-label]="movementLabel(entry)"
                  >{{ movement(entry) }}</span
                >
                <a
                  [routerLink]="[
                    '/artists',
                    entry.release.artistHandle,
                    entry.release.slug,
                  ]"
                  [attr.aria-label]="entry.release.title"
                >
                  <ime-cover
                    class="w-full border border-line"
                    [src]="entry.release.coverUrl"
                    alt=""
                  />
                </a>
                <span class="flex min-w-0 flex-col">
                  <a
                    class="truncate font-bold hover:underline"
                    [routerLink]="[
                      '/artists',
                      entry.release.artistHandle,
                      entry.release.slug,
                    ]"
                    >{{ entry.release.title }}</a
                  >
                  <a
                    class="truncate text-sm text-ink-muted hover:underline"
                    [routerLink]="['/artists', entry.release.artistHandle]"
                    >{{ entry.release.artistName }}</a
                  >
                  <span
                    class="font-mono text-xs sm:hidden"
                    [class]="movementClass(entry)"
                    >{{ movement(entry) }}</span
                  >
                </span>
                <dl
                  class="hidden grid-cols-2 gap-4 text-right font-mono text-xs sm:grid"
                >
                  <div>
                    <dt class="text-ink-muted">Peak</dt>
                    <dd>{{ entry.peak ?? '–' }}</dd>
                  </div>
                  <div>
                    <dt class="text-ink-muted">Weeks</dt>
                    <dd>{{ entry.weeks }}</dd>
                  </div>
                </dl>
              </li>
            } @empty {
              <li class="py-8 text-sm text-ink-muted">
                Nothing on this chart yet. Try a longer period or another
                format.
              </li>
            }
          </ol>
          <p class="text-xs text-ink-muted">
            Movement is against last week's chart. Peak and weeks are a
            release's run on the weekly chart{{
              genre() ? ' for this genre' : ''
            }}.
          </p>
        </section>
      } @else if (charts.error()) {
        <ime-alert tone="error">The chart could not be loaded.</ime-alert>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class ChartsPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly params = toSignal(inject(ActivatedRoute).queryParams, {
    initialValue: {} as Params,
  });

  protected readonly segment = SEGMENT;
  protected readonly periods = CHART_PERIODS;
  protected readonly kinds = CHART_KINDS;
  protected readonly genres = GENRES;
  protected readonly formats = FORMATS;

  protected readonly kind = computed<ChartKind>(() =>
    this.params()['chart'] === 'downloads' ? 'downloads' : 'selling',
  );
  protected readonly period = computed<ChartPeriod>(() => {
    const value = this.params()['period'];
    return CHART_PERIODS.some((p) => p.id === value) ? value : 'week';
  });
  protected readonly genre = computed<string | undefined>(() => {
    const value = this.params()['genre'];
    return typeof value === 'string' && isGenreId(value) ? value : undefined;
  });
  protected readonly format = computed<Format | undefined>(() => {
    const value = this.params()['format'];
    return FORMATS.some((f) => f.id === value) ? (value as Format) : undefined;
  });

  protected readonly charts = resource({
    id: 'chart',
    params: () => ({
      chart: this.kind(),
      period: this.period(),
      genre: this.genre(),
      format: this.format(),
    }),
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.getChart(params)),
  });
  protected readonly chart = computed(() => currentValue(this.charts));

  protected with(change: {
    chart?: ChartKind;
    period?: ChartPeriod;
    genre?: string;
    format?: Format;
  }): Params {
    const next = {
      chart: this.kind(),
      period: this.period(),
      genre: this.genre(),
      format: this.format(),
      ...change,
    };
    return {
      chart: next.chart === 'selling' ? undefined : next.chart,
      period: next.period === 'week' ? undefined : next.period,
      genre: next.genre,
      format: next.chart === 'selling' ? next.format : undefined,
    };
  }

  protected async pickGenre(genre: string): Promise<void> {
    await this.router.navigate(['/charts'], {
      queryParams: this.with({ genre: genre || undefined }),
    });
  }

  protected movement(entry: ChartEntry): string {
    if (entry.previous === null) return 'new';
    const change = entry.previous - entry.position;
    if (change > 0) return `▲${change}`;
    if (change < 0) return `▼${-change}`;
    return '=';
  }

  protected movementLabel(entry: ChartEntry): string {
    if (entry.previous === null) return 'New this week';
    const change = entry.previous - entry.position;
    if (change > 0) return `Up ${change}`;
    if (change < 0) return `Down ${-change}`;
    return 'No change';
  }

  protected movementClass(entry: ChartEntry): string {
    if (entry.previous === null) return 'text-accent font-semibold';
    return entry.previous > entry.position ? 'text-ink' : 'text-ink-muted';
  }
}
