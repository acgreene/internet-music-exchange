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
  DESIGNER_SORTS,
  type DesignerSort,
  type GalleryDesigner,
  type GalleryDesignersQuery,
} from '@ime/models';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { DesignerCard } from './designer-card';

const PILL =
  'shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-canvas border-line hover:border-ink';

/** How long typing pauses before the search runs. */
const TYPING_PAUSE_MS = 250;

/**
 * Every designer with designs in the gallery, `/designs/designers`, to find
 * someone to build a page for a record: searched by name, narrowed by
 * style or to those taking requests, in today's shuffle unless sorted.
 */
@Component({
  selector: 'ime-designers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DesignerCard,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-10">
      <header class="flex flex-col gap-3 border-b border-line pb-8">
        <a class="link text-sm" routerLink="/designs">Design gallery</a>
        <h1
          class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-6xl"
        >
          Designers
        </h1>
        <p class="max-w-prose leading-relaxed">
          Find someone to build a page for your record. Designers who take
          requests will make one just for you.
        </p>
      </header>

      <section class="flex flex-col gap-4" aria-label="Find a designer">
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
            aria-label="Search designers"
            placeholder="Search designers by name"
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
            routerLink="/designs/designers"
            [queryParams]="with({ style: undefined })"
            [attr.aria-pressed]="!query().style"
            >Every style</a
          >
          @for (style of styles; track style.id) {
            <a
              [class]="pill"
              routerLink="/designs/designers"
              [queryParams]="with({ style: style.id })"
              [attr.aria-pressed]="query().style === style.id"
              >{{ style.name }}</a
            >
          }
        </div>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              [checked]="query().requests === '1'"
              (change)="
                go({ requests: $any($event.target).checked ? '1' : undefined })
              "
            />
            Takes custom requests
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

      @if (designers(); as designers) {
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (designer of designers; track designer.username) {
            <li class="flex">
              <ime-designer-card class="flex-1" [designer]="designer" />
            </li>
          } @empty {
            <li class="text-ink-muted">Nobody matches that.</li>
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
      } @else if (list.error()) {
        <ime-alert tone="error">Designers could not be loaded.</ime-alert>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class DesignersPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly params = toSignal(inject(ActivatedRoute).queryParams, {
    initialValue: {} as Params,
  });

  protected readonly pill = PILL;
  protected readonly styles = DESIGN_STYLES;
  protected readonly sorts = DESIGNER_SORTS;

  protected readonly query = computed<GalleryDesignersQuery>(() => {
    const params = this.params();
    const text = (key: string) =>
      typeof params[key] === 'string' && params[key] ? params[key] : undefined;
    return {
      q: text('q'),
      style: text('style'),
      requests: params['requests'] === '1' ? '1' : undefined,
      sort: DESIGNER_SORTS.some((sort) => sort.id === params['sort'])
        ? params['sort']
        : undefined,
    };
  });
  protected readonly sort = computed<DesignerSort>(
    () => this.query().sort ?? 'shuffle',
  );

  protected readonly list = resource({
    id: 'designers-directory',
    params: () => this.query(),
    loader: async ({ params }) =>
      unwrap(await this.api.designs.listDesigners(params)),
  });
  /** Pages after the first, gathered by Show more and dropped on a new query. */
  private readonly later = linkedSignal<
    GalleryDesignersQuery,
    { designers: GalleryDesigner[]; page: number; hasMore: boolean } | null
  >({ source: this.query, computation: () => null });
  protected readonly designers = computed(() => {
    const first = currentValue(this.list);
    return first && [...first.designers, ...(this.later()?.designers ?? [])];
  });
  protected readonly hasMore = computed(
    () => this.later()?.hasMore ?? currentValue(this.list)?.hasMore ?? false,
  );
  protected readonly loadingMore = signal(false);

  private pause?: ReturnType<typeof setTimeout>;

  protected with(change: Partial<GalleryDesignersQuery>): Params {
    const next = { ...this.query(), ...change };
    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    );
  }

  protected go(change: Partial<GalleryDesignersQuery>): void {
    void this.router.navigate(['/designs/designers'], {
      queryParams: this.with(change),
    });
  }

  /** The shuffle is the default, so it stays out of the address. */
  protected sortParam(value: DesignerSort): DesignerSort | undefined {
    return value === 'shuffle' ? undefined : value;
  }

  protected typed(value: string): void {
    clearTimeout(this.pause);
    this.pause = setTimeout(() => {
      void this.router.navigate(['/designs/designers'], {
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
        await this.api.designs.listDesigners({ ...query, page }),
      );
      if (query !== this.query()) return;
      this.later.update((later) => ({
        designers: [...(later?.designers ?? []), ...next.designers],
        page,
        hasMore: next.hasMore,
      }));
    } finally {
      this.loadingMore.set(false);
    }
  }
}
