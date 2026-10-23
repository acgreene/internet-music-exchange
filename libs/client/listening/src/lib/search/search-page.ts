import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
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
  countryName,
  FORMATS,
  genreName,
  type GenreId,
  placeName,
  priceLabel,
  SEARCH_KINDS,
  SEARCH_SORTS,
  type SearchRelease,
  type SearchSort,
  type Shelf,
  yearLabel,
} from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  SpinnerComponent,
} from '@ime/ui';
import { formatMoney } from '@ime/utils';
import { CrateCard } from '../crates/crate-card';
import { ShelfRow } from '../home/shelf-row';
import { releasePriceLabel } from '../releases/release-labels';
import { SearchBox } from './search-box';
import {
  apiQuery,
  paramsFor,
  readSearchParams,
  type SearchState,
} from './search-params';

const PAGE_SIZE = 24;
/** Genres listed before "Show all genres". */
const GENRES_SHOWN = 10;
/** Countries listed before "Show all places". */
const PLACES_SHOWN = 8;

const OPTION =
  'flex items-center justify-between gap-3 rounded-control px-2 py-1 text-sm hover:bg-wash';

/**
 * The results page, `/search`: releases matching words and filters, with a
 * rail of filters that shows how many releases each choice would leave, the
 * filters IME read out of what was typed, and matching artists and merch.
 */
@Component({
  selector: 'ime-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    CrateCard,
    RouterLink,
    SearchBox,
    ShelfRow,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <ime-search-box class="md:hidden" [value]="state().q" />

      @if (chips().length) {
        <div class="flex flex-wrap items-center gap-2 text-sm">
          @if (state().said; as said) {
            <span>We read “{{ said }}” as</span>
          } @else if (chips().length) {
            <span>Filtered by</span>
          }
          @for (chip of chips(); track chip.label) {
            <a
              class="inline-flex items-center gap-1.5 rounded-full border border-ink py-0.5 pr-2 pl-2.5 font-medium hover:bg-wash"
              routerLink="/search"
              [queryParams]="chip.without"
              [attr.aria-label]="'Remove ' + chip.label"
              >{{ chip.label }} <span aria-hidden="true">×</span></a
            >
          }
          @if (state().q && chips().length) {
            <span class="text-ink-muted">and the words “{{ state().q }}”</span>
          }
          @if (state().said; as said) {
            <a class="link" routerLink="/search" [queryParams]="{ q: said }"
              >Search the words instead</a
            >
          } @else if (chips().length) {
            <a
              class="link"
              routerLink="/search"
              [queryParams]="{ q: state().q || undefined }"
              >Clear filters</a
            >
          }
        </div>
      }

      <div class="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div class="flex flex-col">
          <button
            class="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm font-semibold lg:hidden"
            aria-controls="search-filters"
            [attr.aria-expanded]="railOpen()"
            (click)="railOpen.set(!railOpen())"
          >
            {{ railOpen() ? 'Hide filters' : 'Filters' }}
            @if (chips().length) {
              <span class="text-ink-muted">{{ chips().length }} on</span>
            }
          </button>
          @if (facets(); as facets) {
            <nav
              id="search-filters"
              class="mt-4 flex-col gap-6 lg:mt-0 lg:flex"
              [class.flex]="railOpen()"
              [class.hidden]="!railOpen()"
              aria-label="Filters"
            >
              <section class="flex flex-col gap-1">
                <h2 class="px-2 text-xs font-semibold tracking-wider uppercase">
                  Format
                </h2>
                <a
                  [class]="option"
                  [class.font-semibold]="!state().format"
                  routerLink="/search"
                  [queryParams]="with({ format: undefined })"
                  >Any format</a
                >
                @for (format of formats(); track format.id) {
                  <a
                    [class]="option"
                    [class.font-semibold]="state().format === format.id"
                    [attr.aria-current]="state().format === format.id || null"
                    routerLink="/search"
                    [queryParams]="with({ format: format.id })"
                    >{{ format.name }}
                    <span class="font-mono text-xs text-ink-muted">{{
                      format.count
                    }}</span></a
                  >
                }
              </section>

              <section class="flex flex-col gap-1">
                <h2 class="px-2 text-xs font-semibold tracking-wider uppercase">
                  Genre
                </h2>
                @for (genre of genres(); track genre.id) {
                  <a
                    [class]="option"
                    routerLink="/search"
                    [queryParams]="withGenre(genre.id)"
                    [attr.aria-current]="genre.chosen || null"
                  >
                    <span class="flex items-center gap-2">
                      <span
                        class="flex size-3.5 items-center justify-center rounded-sm border border-ink text-[10px]"
                        [class.bg-ink]="genre.chosen"
                        [class.text-canvas]="genre.chosen"
                        aria-hidden="true"
                        >{{ genre.chosen ? '✓' : '' }}</span
                      >
                      <span [class.font-semibold]="genre.chosen">{{
                        genre.name
                      }}</span>
                    </span>
                    <span class="font-mono text-xs text-ink-muted">{{
                      genre.count
                    }}</span>
                  </a>
                }
                @if (moreGenres()) {
                  <button
                    class="link px-2 text-left text-sm"
                    (click)="allGenres.set(!allGenres())"
                  >
                    {{ allGenres() ? 'Show fewer' : 'Show all genres' }}
                  </button>
                }
              </section>

              <section class="flex flex-col gap-1">
                <h2 class="px-2 text-xs font-semibold tracking-wider uppercase">
                  Price
                </h2>
                <a
                  [class]="option"
                  [class.font-semibold]="state().under === undefined"
                  routerLink="/search"
                  [queryParams]="with({ under: undefined })"
                  >Any price</a
                >
                @for (price of facets.prices; track price.value) {
                  <a
                    [class]="option"
                    [class.font-semibold]="state().under === price.value"
                    [attr.aria-current]="state().under === price.value || null"
                    routerLink="/search"
                    [queryParams]="with({ under: price.value })"
                    >{{ priceName(price.value) }}
                    <span class="font-mono text-xs text-ink-muted">{{
                      price.count
                    }}</span></a
                  >
                }
              </section>

              <section class="flex flex-col gap-1">
                <h2 class="px-2 text-xs font-semibold tracking-wider uppercase">
                  Released
                </h2>
                <a
                  [class]="option"
                  [class.font-semibold]="!state().year"
                  routerLink="/search"
                  [queryParams]="with({ year: undefined })"
                  >Any time</a
                >
                @if (state().year?.endsWith('s')) {
                  <span [class]="option" class="font-semibold">{{
                    yearName(state().year!)
                  }}</span>
                }
                @for (year of facets.years; track year.value) {
                  <a
                    [class]="option"
                    [class.font-semibold]="state().year === '' + year.value"
                    routerLink="/search"
                    [queryParams]="with({ year: '' + year.value })"
                    >{{ year.value }}
                    <span class="font-mono text-xs text-ink-muted">{{
                      year.count
                    }}</span></a
                  >
                }
              </section>

              <section class="flex flex-col gap-1">
                <h2 class="px-2 text-xs font-semibold tracking-wider uppercase">
                  Kind
                </h2>
                <a
                  [class]="option"
                  [class.font-semibold]="!state().kind"
                  routerLink="/search"
                  [queryParams]="with({ kind: undefined })"
                  >Any kind</a
                >
                @for (kind of kinds(); track kind.id) {
                  <a
                    [class]="option"
                    [class.font-semibold]="state().kind === kind.id"
                    routerLink="/search"
                    [queryParams]="with({ kind: kind.id })"
                    >{{ kind.name }}
                    <span class="font-mono text-xs text-ink-muted">{{
                      kind.count
                    }}</span></a
                  >
                }
              </section>

              <section class="flex flex-col gap-1">
                <h2 class="px-2 text-xs font-semibold tracking-wider uppercase">
                  Based in
                </h2>
                <a
                  [class]="option"
                  [class.font-semibold]="!state().country"
                  routerLink="/search"
                  [queryParams]="with({ country: undefined, city: undefined })"
                  >Anywhere</a
                >
                @if (state().country; as country) {
                  <a
                    [class]="option"
                    [class.font-semibold]="!state().city"
                    routerLink="/search"
                    [queryParams]="with({ country, city: undefined })"
                    >All of {{ countryName(country) }}
                    <span class="font-mono text-xs text-ink-muted">{{
                      countryTotal()
                    }}</span></a
                  >
                  @for (city of cities(); track city.name) {
                    <a
                      [class]="option"
                      class="pl-5"
                      [class.font-semibold]="city.chosen"
                      [attr.aria-current]="city.chosen || null"
                      routerLink="/search"
                      [queryParams]="with({ country, city: city.name })"
                      >{{ city.name }}
                      <span class="font-mono text-xs text-ink-muted">{{
                        city.count
                      }}</span></a
                    >
                  }
                } @else {
                  @for (country of countries(); track country.code) {
                    <a
                      [class]="option"
                      routerLink="/search"
                      [queryParams]="
                        with({ country: country.code, city: undefined })
                      "
                      >{{ country.name }}
                      <span class="font-mono text-xs text-ink-muted">{{
                        country.count
                      }}</span></a
                    >
                  }
                  @if (moreCountries()) {
                    <button
                      class="link px-2 text-left text-sm"
                      (click)="allCountries.set(!allCountries())"
                    >
                      {{ allCountries() ? 'Show fewer' : 'Show all places' }}
                    </button>
                  }
                }
              </section>

              <section class="flex flex-col gap-1">
                <h2 class="px-2 text-xs font-semibold tracking-wider uppercase">
                  Extras
                </h2>
                <a
                  [class]="option"
                  routerLink="/search"
                  [queryParams]="with({ designed: !state().designed })"
                  [attr.aria-current]="state().designed || null"
                >
                  <span class="flex items-center gap-2">
                    <span
                      class="flex size-3.5 items-center justify-center rounded-sm border border-ink text-[10px]"
                      [class.bg-ink]="state().designed"
                      [class.text-canvas]="state().designed"
                      aria-hidden="true"
                      >{{ state().designed ? '✓' : '' }}</span
                    >
                    <span [class.font-semibold]="state().designed"
                      >Designed pages</span
                    >
                  </span>
                  <span class="font-mono text-xs text-ink-muted">{{
                    facets.designed
                  }}</span>
                </a>
              </section>
            </nav>
          }
        </div>

        <div class="flex min-w-0 flex-col gap-8">
          @if (found(); as found) {
            @if (found.artists.length) {
              <section
                class="flex flex-col gap-2"
                aria-labelledby="artists-heading"
              >
                <h2 id="artists-heading" class="text-lg font-bold">Artists</h2>
                <ul class="flex flex-wrap gap-2">
                  @for (artist of found.artists; track artist.id) {
                    <li>
                      <a
                        class="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-sm font-medium hover:bg-wash"
                        [routerLink]="['/artists', artist.handle]"
                      >
                        <span
                          class="flex size-6 items-center justify-center rounded-full bg-wash text-xs font-semibold uppercase"
                          aria-hidden="true"
                          >{{ artist.name.charAt(0) }}</span
                        >
                        {{ artist.name }}
                      </a>
                    </li>
                  }
                </ul>
              </section>
            }

            @if (crates.value()?.length) {
              <section
                class="flex flex-col gap-3"
                aria-labelledby="crates-heading"
              >
                <h2 id="crates-heading" class="text-lg font-bold">Crates</h2>
                <ul class="grid grid-cols-3 gap-4 sm:grid-cols-6">
                  @for (crate of crates.value(); track crate.id) {
                    <li><ime-crate-card [crate]="crate" /></li>
                  }
                </ul>
              </section>
            }

            <section
              class="flex flex-col gap-4"
              aria-labelledby="releases-heading"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 id="releases-heading" class="text-lg font-bold">
                  {{ found.total }}
                  {{ found.total === 1 ? 'release' : 'releases' }}
                </h2>
                <label class="flex items-center gap-2 text-sm">
                  Sort by
                  <select
                    class="rounded-control border border-line bg-canvas px-2 py-1.5"
                    (change)="sortBy($any($event.target).value)"
                  >
                    @for (option of sorts(); track option.id) {
                      <option
                        [value]="option.id"
                        [selected]="option.id === sort()"
                      >
                        {{ option.name }}
                      </option>
                    }
                  </select>
                </label>
              </div>

              <ul
                class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4"
              >
                @for (item of releases(); track item.release.id) {
                  <li class="flex flex-col gap-1.5">
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
                      <span class="truncate font-bold group-hover:underline">{{
                        item.release.title
                      }}</span>
                    </a>
                    <a
                      class="-mt-1 truncate text-sm text-ink-muted hover:underline"
                      [routerLink]="['/artists', item.release.artistHandle]"
                      >{{ item.release.artistName }}</a
                    >
                    <ul class="flex flex-col font-mono text-xs">
                      @for (format of formatsOf(item); track format.label) {
                        <li>
                          <a
                            class="flex justify-between gap-2 hover:underline"
                            [routerLink]="format.link"
                          >
                            <span>{{ format.label }}</span>
                            <span class="text-right">{{ format.price }}</span>
                          </a>
                        </li>
                      }
                    </ul>
                  </li>
                } @empty {
                  <li class="col-span-full flex flex-col gap-1 py-8">
                    <p class="font-semibold">Nothing matches that.</p>
                    <p class="text-sm text-ink-muted">
                      Try taking off a filter, or searching fewer words.
                    </p>
                  </li>
                }
              </ul>
              @if (hasMore()) {
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

            @if (merchShelf(); as shelf) {
              <ime-shelf-row [shelf]="shelf" />
            }
          } @else if (results.error()) {
            <ime-alert tone="error"
              >The search did not go through. Try again.</ime-alert
            >
          } @else {
            <ime-spinner />
          }
        </div>
      </div>
    </div>
  `,
})
export class SearchPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly params = toSignal(inject(ActivatedRoute).queryParams, {
    initialValue: {} as Params,
  });

  protected readonly option = OPTION;
  protected readonly priceName = priceLabel;
  protected readonly yearName = yearLabel;
  protected readonly countryName = countryName;

  protected readonly state = computed(() => readSearchParams(this.params()));
  protected readonly sort = computed<SearchSort>(
    () => this.state().sort ?? (this.state().q ? 'relevance' : 'newest'),
  );
  /** Best match only means something when there are words to match. */
  protected readonly sorts = computed(() =>
    SEARCH_SORTS.filter((sort) => sort.id !== 'relevance' || this.state().q),
  );

  protected readonly results = resource({
    id: 'search-results',
    params: () => apiQuery(this.state()),
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.search({ ...params, limit: PAGE_SIZE })),
  });
  protected readonly found = computed(() => currentValue(this.results));

  /** Public crates by name, when the search is words alone. */
  protected readonly crates = resource({
    params: () =>
      this.chips().length ? undefined : this.state().q || undefined,
    loader: async ({ params }) => {
      const result = await this.api.crates.listPublic({ q: params, limit: 6 });
      return result.ok ? result.data : [];
    },
  });
  protected readonly facets = computed(() => this.found()?.facets);

  private readonly more = linkedSignal<SearchRelease[], SearchRelease[]>({
    source: () => this.found()?.releases ?? [],
    computation: () => [],
  });
  private readonly lastPageSize = linkedSignal(
    () => this.found()?.releases.length ?? 0,
  );
  protected readonly loadingMore = signal(false);
  protected readonly railOpen = signal(false);
  protected readonly allGenres = signal(false);
  protected readonly allCountries = signal(false);

  protected readonly releases = computed(() => [
    ...(this.found()?.releases ?? []),
    ...this.more(),
  ]);
  protected readonly hasMore = computed(
    () =>
      this.lastPageSize() === PAGE_SIZE &&
      this.releases().length < (this.found()?.total ?? 0),
  );

  /** The filters in force, each with the address of the search without it. */
  protected readonly chips = computed(() => {
    const state = this.state();
    const chips: { label: string; without: Params }[] = state.genres.map(
      (genre) => ({
        label: genreName(genre),
        without: this.with({ genres: state.genres.filter((g) => g !== genre) }),
      }),
    );
    if (state.format) {
      chips.push({
        label: FORMATS.find((f) => f.id === state.format)?.name ?? state.format,
        without: this.with({ format: undefined }),
      });
    }
    if (state.under !== undefined) {
      chips.push({
        label: priceLabel(state.under),
        without: this.with({ under: undefined }),
      });
    }
    if (state.year) {
      chips.push({
        label: yearLabel(state.year),
        without: this.with({ year: undefined }),
      });
    }
    if (state.kind) {
      chips.push({
        label:
          SEARCH_KINDS.find((k) => k.id === state.kind)?.name ?? state.kind,
        without: this.with({ kind: undefined }),
      });
    }
    if (state.designed) {
      chips.push({
        label: 'Designed pages',
        without: this.with({ designed: false }),
      });
    }
    if (state.country) {
      chips.push({
        label: `Based in ${placeName(state.country, state.city)}`,
        without: this.with({ country: undefined, city: undefined }),
      });
    }
    return chips;
  });

  protected readonly formats = computed(() =>
    FORMATS.map((format) => ({
      ...format,
      count:
        this.facets()?.formats.find((f) => f.value === format.id)?.count ?? 0,
    })),
  );

  /** Chosen genres first, then the rest by how many releases they leave. */
  private readonly genreOptions = computed(() => {
    const chosen = new Set<string>(this.state().genres);
    const counts = new Map(
      (this.facets()?.genres ?? []).map((g) => [g.value, g.count]),
    );
    const options = [
      ...this.state().genres.map((id) => ({ id, count: counts.get(id) ?? 0 })),
      ...(this.facets()?.genres ?? [])
        .filter((g) => !chosen.has(g.value))
        .map((g) => ({ id: g.value as GenreId, count: g.count })),
    ];
    return options.map((option) => ({
      ...option,
      name: genreName(option.id),
      chosen: chosen.has(option.id),
    }));
  });
  protected readonly genres = computed(() =>
    this.allGenres()
      ? this.genreOptions()
      : this.genreOptions().slice(
          0,
          Math.max(GENRES_SHOWN, this.state().genres.length),
        ),
  );
  protected readonly moreGenres = computed(
    () => this.genreOptions().length > GENRES_SHOWN,
  );

  /** Countries by how many releases come from them. */
  private readonly countryOptions = computed(() => {
    const totals = new Map<string, number>();
    for (const place of this.facets()?.places ?? []) {
      totals.set(place.country, (totals.get(place.country) ?? 0) + place.count);
    }
    return [...totals]
      .map(([code, count]) => ({ code, name: countryName(code), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });
  protected readonly countries = computed(() =>
    this.allCountries()
      ? this.countryOptions()
      : this.countryOptions().slice(0, PLACES_SHOWN),
  );
  protected readonly moreCountries = computed(
    () => this.countryOptions().length > PLACES_SHOWN,
  );
  protected readonly countryTotal = computed(
    () =>
      this.countryOptions().find((c) => c.code === this.state().country)
        ?.count ?? 0,
  );
  /** The chosen country's cities, by how many releases come from them. */
  protected readonly cities = computed(() => {
    const { country, city } = this.state();
    return (this.facets()?.places ?? [])
      .filter((place) => place.country === country && place.city)
      .map((place) => ({
        name: place.city as string,
        count: place.count,
        chosen: place.city?.toLowerCase() === city?.toLowerCase(),
      }));
  });

  protected readonly kinds = computed(() =>
    SEARCH_KINDS.map((kind) => ({
      ...kind,
      count: this.facets()?.kinds.find((k) => k.value === kind.id)?.count ?? 0,
    })).filter((kind) => kind.count > 0 || this.state().kind === kind.id),
  );

  protected readonly merchShelf = computed<Shelf | null>(() => {
    const merch = this.found()?.merch ?? [];
    return merch.length
      ? {
          id: 'search-merch',
          title: 'Merch',
          reason: `matching “${this.state().q}”`,
          items: merch,
        }
      : null;
  });

  /** The address of this search with some filters changed. */
  protected with(change: Partial<SearchState>): Params {
    return paramsFor({ ...this.state(), ...change, said: undefined });
  }

  protected withGenre(id: GenreId): Params {
    const genres = this.state().genres;
    return this.with({
      genres: genres.includes(id)
        ? genres.filter((genre) => genre !== id)
        : [...genres, id],
    });
  }

  /** Every way to buy a release: its download, then each physical edition. */
  protected formatsOf(item: SearchRelease) {
    const { artistHandle, slug } = item.release;
    return [
      {
        label: 'Digital',
        price: releasePriceLabel(item.pricing),
        link: ['/artists', artistHandle, slug],
      },
      ...item.editions.map((edition) => ({
        label:
          FORMATS.find((f) => f.id === edition.format)?.name ?? edition.format,
        price: formatMoney(edition.price, edition.currency),
        link: ['/artists', artistHandle, 'merch', edition.productId],
      })),
    ];
  }

  protected async sortBy(sort: SearchSort): Promise<void> {
    await this.router.navigate(['/search'], {
      queryParams: paramsFor({ ...this.state(), sort }),
    });
  }

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    const result = await this.api.catalog.search({
      ...apiQuery(this.state()),
      limit: PAGE_SIZE,
      offset: this.releases().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data.releases]);
    this.lastPageSize.set(result.data.releases.length);
  }
}
