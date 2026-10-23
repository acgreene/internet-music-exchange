import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { SessionService, currentValue } from '@ime/client-data';
import { genreName, type ReleaseCardWithArtist } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';
import { CrateCard } from '../crates/crate-card';
import { GatefoldHero } from '../home/gatefold-hero';
import { ShelfRow } from '../home/shelf-row';

const PAGE_SIZE = 24;

/**
 * The home page: the gatefold that says what IME is, today's shelves,
 * designed releases, this week's best sellers, crates, dig mode, and new
 * releases.
 */
@Component({
  selector: 'ime-discover-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    CrateCard,
    GatefoldHero,
    ReleaseCardComponent,
    RouterLink,
    ShelfRow,
    SpinnerComponent,
  ],
  template: `
    <ime-gatefold-hero class="-mx-4 -mt-8 md:-mx-8" />

    <div class="mx-auto flex max-w-6xl flex-col gap-12 pt-10">
      <div id="shelves" class="flex scroll-mt-24 flex-col gap-10">
        @if (home.hasValue()) {
          @for (shelf of shelfGroups()[0]; track shelf.id) {
            <ime-shelf-row [shelf]="shelf" />
          }
        } @else if (home.error()) {
          <ime-alert tone="error"
            >Today's shelves could not be loaded.</ime-alert
          >
        } @else {
          <ime-spinner />
        }
      </div>

      @if (designed().length) {
        <section
          class="grid items-center gap-8 border-y border-line py-12 md:grid-cols-2"
          aria-labelledby="designed-heading"
        >
          <div class="flex flex-col gap-3">
            <span
              class="font-mono text-xs tracking-wider text-ink-muted uppercase"
              >Designed releases</span
            >
            <h2
              id="designed-heading"
              class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-5xl"
            >
              IME reimagines the record.
            </h2>
            <p class="max-w-prose leading-relaxed">
              On IME, artists team up with designers and creative developers to
              build a companion software experience for their record. It's the
              cover, the inner sleeve, the liner notes, and the back cover,
              reborn as software you explore while you listen.
            </p>
            <div>
              <a imeButton routerLink="/designs">Browse the design gallery</a>
            </div>
          </div>
          <ul class="grid grid-cols-3 gap-3">
            @for (item of designed(); track item.release.id; let i = $index) {
              <li [class.mt-10]="i === 1">
                <a
                  class="group flex flex-col gap-1.5"
                  [routerLink]="[
                    '/artists',
                    item.release.artistHandle,
                    item.release.slug,
                  ]"
                >
                  <ime-cover
                    class="w-full border border-line"
                    [src]="item.release.coverUrl"
                    [alt]="'Cover of ' + item.release.title"
                  />
                  <span
                    class="truncate text-sm font-semibold group-hover:underline"
                    >{{ item.release.title }}</span
                  >
                </a>
              </li>
            }
          </ul>
        </section>
      }

      @for (shelf of shelfGroups()[1]; track shelf.id) {
        <ime-shelf-row [shelf]="shelf" />
      }

      @if (topSellers().length) {
        <section
          class="grid gap-8 border-y border-line py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center"
          aria-labelledby="charts-heading"
        >
          <div class="flex flex-col gap-3">
            <span
              class="font-mono text-xs tracking-wider text-ink-muted uppercase"
              >Charts</span
            >
            <h2
              id="charts-heading"
              class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-5xl"
            >
              What people are buying this week.
            </h2>
            <p class="max-w-prose leading-relaxed">
              Charts rank releases by how many people bought them or downloaded
              them. Every genre has its own chart, from this week back to all
              time.
            </p>
            <div>
              <a imeButton variant="secondary" routerLink="/charts"
                >See the charts</a
              >
            </div>
          </div>
          <ol
            class="flex flex-col divide-y divide-hairline border-y border-line"
          >
            @for (entry of topSellers(); track entry.release.id) {
              <li>
                <a
                  class="group grid grid-cols-[2rem_3rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5"
                  [routerLink]="[
                    '/artists',
                    entry.release.artistHandle,
                    entry.release.slug,
                  ]"
                >
                  <span class="text-right font-mono text-xl font-bold">{{
                    entry.position
                  }}</span>
                  <ime-cover
                    class="w-full border border-line"
                    [src]="entry.release.coverUrl"
                    alt=""
                  />
                  <span class="flex min-w-0 flex-col">
                    <span class="truncate font-bold group-hover:underline">{{
                      entry.release.title
                    }}</span>
                    <span class="truncate text-sm text-ink-muted">{{
                      entry.release.artistName
                    }}</span>
                  </span>
                  <span class="font-mono text-xs text-ink-muted"
                    >{{ entry.people }}
                    {{ entry.people === 1 ? 'buyer' : 'buyers' }}</span
                  >
                </a>
              </li>
            }
          </ol>
        </section>
      }

      @for (shelf of shelfGroups()[2]; track shelf.id) {
        <ime-shelf-row [shelf]="shelf" />
      }

      @if (crates().length) {
        <section
          class="flex flex-col gap-6 border-y border-line py-12"
          aria-labelledby="crates-heading"
        >
          <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div class="flex max-w-2xl flex-col gap-3">
              <span
                class="font-mono text-xs tracking-wider text-ink-muted uppercase"
                >Crates</span
              >
              <h2
                id="crates-heading"
                class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-5xl"
              >
                Boxes of records, put together by people.
              </h2>
              <p class="leading-relaxed">
                Anyone can make a crate and say why each record is in it. Follow
                the people whose taste you trust, or let IME build one from
                records you love.
              </p>
            </div>
            <div class="flex flex-wrap gap-3">
              <a imeButton variant="secondary" routerLink="/crates"
                >Browse crates</a
              >
              <a class="link self-center font-semibold" routerLink="/crates"
                >Make a crate</a
              >
            </div>
          </div>
          <ul class="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
            @for (crate of crates(); track crate.id) {
              <li><ime-crate-card [crate]="crate" /></li>
            }
          </ul>
        </section>
      }

      @for (shelf of shelfGroups()[3]; track shelf.id) {
        <ime-shelf-row [shelf]="shelf" />
      }

      @if (digLink(); as dig) {
        <section
          class="border-y border-line py-12"
          aria-labelledby="dig-heading"
        >
          <div
            class="flex flex-col gap-6 rounded-card bg-ink px-6 py-12 text-canvas md:flex-row md:items-end md:justify-between md:gap-12 md:px-10 md:py-14"
          >
            <div class="flex max-w-2xl flex-col gap-3">
              <span
                class="font-mono text-xs tracking-wider text-canvas/60 uppercase"
                >Dig mode</span
              >
              <h2
                id="dig-heading"
                class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-6xl"
              >
                Flip through a crate, one record at a time.
              </h2>
              <p class="leading-relaxed text-canvas/80">
                Listen to the publicly previewable tracks on each record. Keep
                what you love, then buy the bag at the bottom of the crate.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <a
                class="rounded-control bg-marker px-5 py-3 font-bold text-ink hover:bg-canvas"
                [routerLink]="dig"
                >Start digging</a
              >
              @if (genreOfTheDay(); as genre) {
                <a
                  class="rounded-control border border-canvas/60 px-5 py-3 font-bold hover:bg-canvas hover:text-ink"
                  routerLink="/dig/sound"
                  [queryParams]="{ genre: genre.id }"
                  >Dig {{ genre.name }}</a
                >
              }
            </div>
          </div>
        </section>
      }

      @for (shelf of shelfGroups()[4]; track shelf.id) {
        <ime-shelf-row [shelf]="shelf" />
      }

      <section class="flex flex-col gap-4" aria-labelledby="recent-heading">
        <h2
          id="recent-heading"
          class="text-2xl font-extrabold tracking-[-0.035em]"
        >
          New releases
        </h2>
        @if (recent.error()) {
          <ime-alert tone="error">New releases could not be loaded.</ime-alert>
        }
        <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          @for (release of releases(); track release.id) {
            <li>
              <ime-release-card
                [title]="release.title"
                [link]="['/artists', release.artistHandle, release.slug]"
                [coverUrl]="release.coverUrl"
                [subtitle]="release.artistName"
                [subtitleLink]="['/artists', release.artistHandle]"
              />
            </li>
          } @empty {
            @if (recent.hasValue()) {
              <li class="text-sm text-ink-muted">
                Nothing has been released yet.
              </li>
            }
          }
        </ul>
        @if (recent.isLoading()) {
          <ime-spinner />
        } @else if (hasMore()) {
          <div>
            <button
              imeButton
              variant="secondary"
              [busy]="loadingMore()"
              (click)="loadMore()"
            >
              Show more
            </button>
          </div>
        }
      </section>
    </div>
  `,
})
export class DiscoverPage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);

  /** The shelves change with who is signed in, so they reload with them. */
  protected readonly home = resource({
    id: 'catalog-home',
    params: () => this.session.user()?.id ?? 'anonymous',
    loader: async () => unwrap(await this.api.catalog.getHome()),
  });
  /**
   * Today's shelves in runs that divide the page's sections: three before
   * designed releases, two before each of charts, crates, and dig mode, and
   * the rest before new releases.
   */
  protected readonly shelfGroups = computed(() => {
    const shelves = currentValue(this.home)?.shelves ?? [];
    return [
      shelves.slice(0, 3),
      shelves.slice(3, 5),
      shelves.slice(5, 7),
      shelves.slice(7, 9),
      shelves.slice(9),
    ];
  });

  protected readonly designed = computed(() =>
    (currentValue(this.home)?.designed ?? []).flatMap((item) =>
      item.kind === 'release' ? [item] : [],
    ),
  );

  private readonly chart = resource({
    id: 'home-chart',
    loader: async () =>
      unwrap(await this.api.catalog.getChart({ chart: 'selling' })),
  });
  protected readonly topSellers = computed(() =>
    (currentValue(this.chart)?.entries ?? []).slice(0, 5),
  );

  private readonly publicCrates = resource({
    id: 'home-crates',
    loader: async () => unwrap(await this.api.crates.listPublic({ limit: 4 })),
  });
  protected readonly crates = computed(
    () => currentValue(this.publicCrates) ?? [],
  );

  /** Dig today's featured crate, from its shelf. */
  protected readonly digLink = computed(() => {
    const crate = currentValue(this.home)?.shelves.find((shelf) =>
      shelf.link?.startsWith('/crates/'),
    );
    return crate?.link ? `/dig${crate.link}` : null;
  });
  /** The genre of the day, also offered as a dig. */
  protected readonly genreOfTheDay = computed(() => {
    const shelf = currentValue(this.home)?.shelves.find(
      (s) => s.id === 'genre-of-the-day',
    );
    const id = shelf?.link?.split('genres=')[1];
    return id ? { id, name: genreName(id) } : null;
  });

  protected readonly recent = resource({
    id: 'catalog-recent',
    loader: async () =>
      unwrap(await this.api.catalog.listRecent({ limit: PAGE_SIZE })),
  });

  private readonly more = signal<ReleaseCardWithArtist[]>([]);
  private readonly lastPageSize = signal(PAGE_SIZE);
  protected readonly loadingMore = signal(false);

  protected readonly releases = computed(() => [
    ...(currentValue(this.recent) ?? []),
    ...this.more(),
  ]);
  protected readonly hasMore = computed(
    () =>
      (currentValue(this.recent)?.length ?? 0) === PAGE_SIZE &&
      this.lastPageSize() === PAGE_SIZE,
  );

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    const result = await this.api.catalog.listRecent({
      limit: PAGE_SIZE,
      offset: this.releases().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }
}
