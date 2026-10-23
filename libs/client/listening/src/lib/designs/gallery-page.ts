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
  DESIGN_STYLES,
  designStyleName,
  GALLERY_SORTS,
  type GalleryDesign,
  type GalleryQuery,
  type GallerySort,
} from '@ime/models';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { DesignCard } from './design-card';
import { DesignerCard } from './designer-card';

const PILL =
  'shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-canvas border-line hover:border-ink';

/** How long typing pauses before the search runs. */
const TYPING_PAUSE_MS = 250;

/** How many designers a search shows before linking to the rest. */
const DESIGNERS_FOUND = 6;

/**
 * The design gallery, `/designs`: the marketplace for how a record looks.
 * With nothing chosen it shows shelves (new designs, designs on recent
 * releases, a style of the day, designers taking requests) above every
 * design in today's shuffle. Searching, narrowing, or sorting swaps the
 * shelves for the matching designs, a page at a time.
 */
@Component({
  selector: 'ime-gallery-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DesignCard,
    DesignerCard,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-12">
      <header
        class="grid gap-6 border-b border-line pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
      >
        <div class="flex max-w-3xl flex-col gap-3">
          <span
            class="font-mono text-xs tracking-wider text-ink-muted uppercase"
            >Design gallery</span
          >
          <h1
            class="text-4xl leading-[0.95] font-black tracking-[-0.05em] text-balance md:text-6xl"
          >
            Your record, as more than a square.
          </h1>
          <p class="max-w-prose leading-relaxed">
            Vinyl brought musicians together with photographers, typographers,
            and illustrators. IME does the same with designers and creative
            developers, who build the whole page a record lives on: front and
            back, the inside of the gatefold, liner notes, posters, anything the
            web can do. Find a design for your release, or ask a designer to
            make one.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <a imeButton routerLink="/designs/designers">Find a designer</a>
          <a imeButton variant="secondary" routerLink="/studio/designs"
            >Build a design</a
          >
        </div>
      </header>

      <section class="flex flex-col gap-4" aria-label="Find a design">
        <label
          class="flex items-center gap-2.5 rounded-control border border-line bg-canvas px-3 focus-within:outline-2 focus-within:outline-accent"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-4 shrink-0 fill-none stroke-ink stroke-2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            class="h-11 w-full bg-transparent outline-none placeholder:text-ink-subtle"
            type="search"
            aria-label="Search designs and designers"
            placeholder="Search designs and designers"
            [value]="query().q ?? ''"
            (input)="typed($any($event.target).value)"
          />
        </label>

        <div
          class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          role="group"
          aria-label="Style"
        >
          <a
            [class]="pill"
            routerLink="/designs"
            [queryParams]="with({ style: undefined })"
            [attr.aria-pressed]="!query().style"
            >Every style</a
          >
          @for (style of styles; track style.id) {
            <a
              [class]="pill"
              routerLink="/designs"
              [queryParams]="with({ style: style.id })"
              [attr.aria-pressed]="query().style === style.id"
              >{{ style.name }}</a
            >
          }
        </div>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <label class="flex items-center gap-2">
            Price
            <select
              class="rounded-control border border-line bg-canvas px-2 py-1.5"
              (change)="go({ price: $any($event.target).value || undefined })"
            >
              <option value="" [selected]="!query().price">Any price</option>
              <option value="free" [selected]="query().price === 'free'">
                Free
              </option>
              <option
                value="under-10"
                [selected]="query().price === 'under-10'"
              >
                Under $10
              </option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              [checked]="query().requests === '1'"
              (change)="
                go({ requests: $any($event.target).checked ? '1' : undefined })
              "
            />
            Designer takes custom requests
          </label>
          <label class="flex items-center gap-2 sm:ml-auto">
            Sort by
            <select
              class="rounded-control border border-line bg-canvas px-2 py-1.5"
              (change)="go({ sort: sortParam($any($event.target).value) })"
            >
              @for (option of sorts; track option.id) {
                <option [value]="option.id" [selected]="sort() === option.id">
                  {{ option.name }}
                </option>
              }
            </select>
          </label>
        </div>
      </section>

      @if (!browsing()) {
        @if (home(); as home) {
          @if (home.newest.length) {
            <section class="flex flex-col gap-4" aria-labelledby="new-heading">
              <div class="flex items-baseline justify-between gap-4">
                <h2 id="new-heading" [class]="heading">New</h2>
                <a
                  class="link text-sm"
                  routerLink="/designs"
                  [queryParams]="{ sort: 'newest' }"
                  >See all</a
                >
              </div>
              <ul [class]="shelf">
                @for (item of home.newest; track item.design.id) {
                  <li [class]="shelfItem"><ime-design-card [item]="item" /></li>
                }
              </ul>
            </section>
          }
          @if (home.inUse.length) {
            <section
              class="flex flex-col gap-4"
              aria-labelledby="in-use-heading"
            >
              <div class="flex items-baseline justify-between gap-4">
                <h2 id="in-use-heading" [class]="heading">
                  On recent releases
                </h2>
                <a
                  class="link text-sm"
                  routerLink="/designs"
                  [queryParams]="{ sort: 'recently-used' }"
                  >See all</a
                >
              </div>
              <ul [class]="shelf">
                @for (item of home.inUse; track item.design.id) {
                  <li [class]="shelfItem"><ime-design-card [item]="item" /></li>
                }
              </ul>
            </section>
          }
          @if (home.style; as style) {
            <section
              class="flex flex-col gap-4"
              aria-labelledby="style-heading"
            >
              <div class="flex items-baseline justify-between gap-4">
                <h2 id="style-heading" [class]="heading">
                  {{ styleName(style.id) }}
                </h2>
                <a
                  class="link text-sm"
                  routerLink="/designs"
                  [queryParams]="{ style: style.id }"
                  >See all</a
                >
              </div>
              <ul [class]="shelf">
                @for (item of style.designs; track item.design.id) {
                  <li [class]="shelfItem"><ime-design-card [item]="item" /></li>
                }
              </ul>
            </section>
          }
          @if (home.designers.length) {
            <section
              class="flex flex-col gap-4"
              aria-labelledby="designers-heading"
            >
              <div class="flex items-baseline justify-between gap-4">
                <h2 id="designers-heading" [class]="heading">
                  Designers taking requests
                </h2>
                <a
                  class="link text-sm"
                  routerLink="/designs/designers"
                  [queryParams]="{ requests: '1' }"
                  >All designers</a
                >
              </div>
              <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                @for (designer of home.designers; track designer.username) {
                  <li class="flex">
                    <ime-designer-card class="flex-1" [designer]="designer" />
                  </li>
                }
              </ul>
            </section>
          }
        }
      } @else if (query().q && designers().length) {
        <section
          class="flex flex-col gap-4"
          aria-labelledby="found-designers-heading"
        >
          <div class="flex items-baseline justify-between gap-4">
            <h2 id="found-designers-heading" [class]="heading">Designers</h2>
            <a
              class="link text-sm"
              routerLink="/designs/designers"
              [queryParams]="{ q: query().q }"
              >All matching designers</a
            >
          </div>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (designer of designers(); track designer.username) {
              <li class="flex">
                <ime-designer-card class="flex-1" [designer]="designer" />
              </li>
            }
          </ul>
        </section>
      }

      <section class="flex flex-col gap-4" aria-labelledby="designs-heading">
        <h2 id="designs-heading" [class]="heading">
          {{ browsing() ? 'Designs' : 'All designs' }}
        </h2>
        @if (designs(); as designs) {
          <ul class="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            @for (item of designs; track item.design.id) {
              <li><ime-design-card [item]="item" /></li>
            } @empty {
              <li class="text-ink-muted">Nothing matches that.</li>
            }
          </ul>
          @if (hasMore()) {
            <div class="flex justify-center">
              <button
                imeButton
                variant="secondary"
                [disabled]="loadingMore()"
                (click)="showMore()"
              >
                {{ loadingMore() ? 'Loading…' : 'Show more' }}
              </button>
            </div>
          }
        } @else if (gallery.error()) {
          <ime-alert tone="error">The gallery could not be loaded.</ime-alert>
        } @else {
          <ime-spinner />
        }
      </section>
    </div>
  `,
})
export class GalleryPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly params = toSignal(inject(ActivatedRoute).queryParams, {
    initialValue: {} as Params,
  });

  protected readonly pill = PILL;
  protected readonly heading = 'text-2xl font-extrabold tracking-[-0.035em]';
  /** Sideways on phones, a row of four on wide screens. */
  protected readonly shelf =
    '-mx-4 flex snap-x gap-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4';
  protected readonly shelfItem = 'w-[78%] shrink-0 snap-start sm:w-auto';
  protected readonly styles = DESIGN_STYLES;
  protected readonly sorts = GALLERY_SORTS;
  protected readonly styleName = designStyleName;

  protected readonly query = computed<GalleryQuery>(() => {
    const params = this.params();
    const text = (key: string) =>
      typeof params[key] === 'string' && params[key] ? params[key] : undefined;
    return {
      q: text('q'),
      style: text('style'),
      price: ['free', 'under-10'].includes(params['price'])
        ? params['price']
        : undefined,
      requests: params['requests'] === '1' ? '1' : undefined,
      sort: GALLERY_SORTS.some((sort) => sort.id === params['sort'])
        ? params['sort']
        : undefined,
    };
  });
  protected readonly sort = computed<GallerySort>(
    () => this.query().sort ?? 'shuffle',
  );
  /** Whether the visitor narrowed or sorted, which swaps the shelves away. */
  protected readonly browsing = computed(() =>
    Object.values(this.query()).some((value) => value !== undefined),
  );

  private readonly homeResource = resource({
    id: 'gallery-home',
    loader: async () => unwrap(await this.api.designs.getGalleryHome()),
  });
  protected readonly home = computed(() => currentValue(this.homeResource));

  protected readonly gallery = resource({
    id: 'design-gallery',
    params: () => this.query(),
    loader: async ({ params }) =>
      unwrap(await this.api.designs.listGallery(params)),
  });
  /** Pages after the first, gathered by Show more and dropped on a new query. */
  private readonly later = linkedSignal<
    GalleryQuery,
    { designs: GalleryDesign[]; page: number; hasMore: boolean } | null
  >({ source: this.query, computation: () => null });
  protected readonly designs = computed(() => {
    const first = currentValue(this.gallery);
    return first && [...first.designs, ...(this.later()?.designs ?? [])];
  });
  protected readonly hasMore = computed(
    () => this.later()?.hasMore ?? currentValue(this.gallery)?.hasMore ?? false,
  );
  protected readonly loadingMore = signal(false);

  /** Designers matching the search words. */
  private readonly designersResource = resource({
    id: 'gallery-designers',
    params: () => this.query().q,
    loader: async ({ params }) =>
      unwrap(await this.api.designs.listDesigners({ q: params })),
  });
  protected readonly designers = computed(() =>
    (currentValue(this.designersResource)?.designers ?? []).slice(
      0,
      DESIGNERS_FOUND,
    ),
  );

  private pause?: ReturnType<typeof setTimeout>;

  /** The address of the gallery with some of its choices changed. */
  protected with(change: Partial<GalleryQuery>): Params {
    const next = { ...this.query(), ...change };
    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    );
  }

  protected go(change: Partial<GalleryQuery>): void {
    void this.router.navigate(['/designs'], {
      queryParams: this.with(change),
    });
  }

  /** The shuffle is the default, so it stays out of the address. */
  protected sortParam(value: GallerySort): GallerySort | undefined {
    return value === 'shuffle' ? undefined : value;
  }

  protected typed(value: string): void {
    clearTimeout(this.pause);
    this.pause = setTimeout(() => {
      void this.router.navigate(['/designs'], {
        queryParams: this.with({ q: value.trim() || undefined }),
        replaceUrl: true,
      });
    }, TYPING_PAUSE_MS);
  }

  protected async showMore(): Promise<void> {
    const query = this.query();
    const page = (this.later()?.page ?? 1) + 1;
    this.loadingMore.set(true);
    try {
      const next = unwrap(
        await this.api.designs.listGallery({ ...query, page }),
      );
      if (query !== this.query()) return;
      this.later.update((later) => ({
        designs: [...(later?.designs ?? []), ...next.designs],
        page,
        hasMore: next.hasMore,
      }));
    } finally {
      this.loadingMore.set(false);
    }
  }
}
