import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
import { releasePriceLabel } from '../releases/release-labels';
import { DesignThumbnail } from './design-thumbnail';

const PILL =
  'shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-canvas border-line hover:border-ink';

/** How long typing pauses before the search runs. */
const TYPING_PAUSE_MS = 250;

/**
 * The design gallery, `/designs`: the marketplace for how a record looks.
 * Artists search designs and designers, narrow them by style, price, and
 * whether the designer takes requests, sort them, and open any design to
 * try it with a stand-in record.
 */
@Component({
  selector: 'ime-gallery-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DesignThumbnail,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-10">
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
          <button imeButton type="button" (click)="toDesigners()">
            Find a designer
          </button>
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
              (change)="go({ sort: $any($event.target).value })"
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

      @if (designers().length) {
        <section
          id="designers"
          class="flex scroll-mt-24 flex-col gap-4"
          aria-labelledby="designers-heading"
        >
          <h2
            id="designers-heading"
            class="text-2xl font-extrabold tracking-[-0.035em]"
          >
            {{ query().q ? 'Designers' : 'Designers taking requests' }}
          </h2>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (designer of designers(); track designer.username) {
              <li>
                <a
                  class="flex items-center gap-3 rounded-card border border-line bg-surface p-3 hover:bg-wash"
                  [routerLink]="['/users', designer.username]"
                >
                  <span
                    class="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-black text-canvas uppercase"
                    aria-hidden="true"
                    >{{ (designer.name || designer.username).charAt(0) }}</span
                  >
                  <span class="flex min-w-0 flex-col">
                    <span class="truncate font-bold">{{
                      designer.name || '@' + designer.username
                    }}</span>
                    <span class="truncate text-sm text-ink-muted">{{
                      designerLine(designer)
                    }}</span>
                    @if (designer.styles.length) {
                      <span class="truncate font-mono text-xs text-ink-muted">{{
                        styleNames(designer.styles)
                      }}</span>
                    }
                  </span>
                </a>
              </li>
            }
          </ul>
        </section>
      }

      <section class="flex flex-col gap-4" aria-labelledby="designs-heading">
        <h2
          id="designs-heading"
          class="text-2xl font-extrabold tracking-[-0.035em]"
        >
          Designs
          @if (designs(); as designs) {
            <span class="font-mono text-sm font-normal text-ink-muted">{{
              designs.length
            }}</span>
          }
        </h2>
        @if (designs(); as designs) {
          <ul class="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            @for (item of designs; track item.design.id) {
              <li>
                <a
                  class="group flex flex-col gap-3"
                  [routerLink]="['/designs', item.design.id]"
                >
                  <ime-design-thumbnail
                    class="transition-transform group-hover:-translate-y-1"
                    [design]="item"
                  />
                  <span class="flex flex-col gap-0.5">
                    <span class="flex items-baseline justify-between gap-3">
                      <span
                        class="truncate text-lg font-bold group-hover:underline"
                        >{{ item.design.name }}</span
                      >
                      <span class="shrink-0 font-mono text-xs">{{
                        price(item)
                      }}</span>
                    </span>
                    <span class="truncate text-sm text-ink-muted">{{
                      byLine(item)
                    }}</span>
                    @if (item.design.styles.length) {
                      <span class="truncate font-mono text-xs text-ink-muted">{{
                        styleNames(item.design.styles)
                      }}</span>
                    }
                  </span>
                </a>
              </li>
            } @empty {
              <li class="text-ink-muted">Nothing matches that.</li>
            }
          </ul>
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
  private readonly document = inject(DOCUMENT);
  private readonly params = toSignal(inject(ActivatedRoute).queryParams, {
    initialValue: {} as Params,
  });

  protected readonly pill = PILL;
  protected readonly styles = DESIGN_STYLES;
  protected readonly sorts = GALLERY_SORTS;

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
    () => this.query().sort ?? 'most-used',
  );

  protected readonly gallery = resource({
    id: 'design-gallery',
    params: () => this.query(),
    loader: async ({ params }) =>
      unwrap(await this.api.designs.listGallery(params)),
  });
  protected readonly designs = computed(() => currentValue(this.gallery));

  /** Designers matching the words, or those taking requests. */
  private readonly designersResource = resource({
    id: 'gallery-designers',
    // an object, since a resource with undefined params never loads
    params: () => ({ q: this.query().q }),
    loader: async ({ params }) =>
      unwrap(
        await this.api.designs.listDesigners(
          params.q ? { q: params.q } : { requests: '1' },
        ),
      ),
  });
  protected readonly designers = computed(() =>
    (currentValue(this.designersResource) ?? []).slice(0, 6),
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

  protected typed(value: string): void {
    clearTimeout(this.pause);
    this.pause = setTimeout(() => {
      void this.router.navigate(['/designs'], {
        queryParams: this.with({ q: value.trim() || undefined }),
        replaceUrl: true,
      });
    }, TYPING_PAUSE_MS);
  }

  protected toDesigners(): void {
    // scrollIntoView keeps the section's margin clear of the sticky header
    this.document
      .getElementById('designers')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected price(item: GalleryDesign): string {
    return releasePriceLabel({
      mode: item.design.pricingMode,
      currency: item.design.currency,
      minimumPrice: item.design.minimumPrice,
      suggestedPrice: item.design.suggestedPrice,
    });
  }

  protected byLine(item: GalleryDesign): string {
    const count = item.releaseCount;
    return [
      item.designer?.username ? `by @${item.designer.username}` : null,
      count ? `on ${count} ${count === 1 ? 'release' : 'releases'}` : 'new',
      item.designer?.openToCommissions ? 'takes requests' : null,
    ]
      .filter(Boolean)
      .join(', ');
  }

  protected designerLine(designer: {
    username: string;
    designCount: number;
    releaseCount: number;
  }): string {
    const designs = `${designer.designCount} ${designer.designCount === 1 ? 'design' : 'designs'}`;
    return designer.releaseCount
      ? `@${designer.username}, ${designs} on ${designer.releaseCount} ${designer.releaseCount === 1 ? 'release' : 'releases'}`
      : `@${designer.username}, ${designs}`;
  }

  protected styleNames(ids: string[]): string {
    return ids.map(designStyleName).join(', ');
  }
}
