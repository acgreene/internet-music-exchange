import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { type CrateCard as Crate, genreName, isGenreId } from '@ime/models';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { PageMetaService } from '../page-meta';
import { CrateCard } from './crate-card';

const PAGE_SIZE = 24;

/**
 * Crates in a genre, `/crates/genre/<id>`: people's public crates where a
 * third or more of the records are in it, the most saved first, with a
 * crate IME pulls by sound for when there are few.
 */
@Component({
  selector: 'ime-genre-crates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CrateCard,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (known()) {
      <div class="mx-auto flex max-w-6xl flex-col gap-8">
        <header class="flex flex-col gap-3">
          <a class="link w-fit text-sm" routerLink="/crates">All crates</a>
          <span
            class="font-mono text-xs tracking-wider text-ink-muted uppercase"
            >Crates by sound</span
          >
          <h1
            class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-6xl"
          >
            {{ name() }}
          </h1>
          <p class="text-sm text-ink-muted">
            Crates people made, the most saved first. Or
            <a
              class="link"
              routerLink="/crates/sound"
              [queryParams]="{ genre: genre() }"
              >let IME pull a {{ name() }} crate</a
            >.
          </p>
        </header>

        @if (cratesResource.error()) {
          <ime-alert tone="error">Crates could not be loaded.</ime-alert>
        }
        <ul
          class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6"
        >
          @for (crate of crates(); track crate.id) {
            <li><ime-crate-card [crate]="crate" /></li>
          } @empty {
            @if (cratesResource.hasValue()) {
              <li class="col-span-full text-sm text-ink-muted">
                No one has made a {{ name() }} crate yet.
              </li>
            }
          }
        </ul>
        @if (cratesResource.isLoading()) {
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
      </div>
    } @else {
      <div class="mx-auto flex max-w-6xl flex-col gap-2">
        <h1 class="text-3xl font-extrabold">Genre not found</h1>
        <p class="text-ink-muted">
          <a class="link" routerLink="/crates">See all crates</a> instead.
        </p>
      </div>
    }
  `,
})
export class GenreCratesPage {
  private readonly api = inject(ApiClient);
  private readonly meta = inject(PageMetaService);

  /** The `genre` route parameter. */
  public readonly genre = input.required<string>();

  protected readonly known = computed(() => isGenreId(this.genre()));
  protected readonly name = computed(() =>
    this.known() ? genreName(this.genre()) : '',
  );

  protected readonly cratesResource = resource({
    id: 'genre-crates',
    params: () => (this.known() ? this.genre() : undefined),
    loader: async ({ params }) =>
      unwrap(
        await this.api.crates.listPublic({ genre: params, limit: PAGE_SIZE }),
      ),
  });
  protected readonly crates = linkedSignal<Crate[]>(
    () => currentValue(this.cratesResource) ?? [],
  );
  private readonly lastPageSize = linkedSignal(
    () => currentValue(this.cratesResource)?.length ?? 0,
  );
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = computed(
    () => this.lastPageSize() === PAGE_SIZE,
  );

  constructor() {
    effect(() => {
      if (!this.known()) {
        this.meta.notFound();
        return;
      }
      this.meta.set({
        title: `${this.name()} crates`,
        description: `Crates of ${this.name()} records people put together on IME.`,
      });
    });
  }

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    const result = await this.api.crates.listPublic({
      genre: this.genre(),
      limit: PAGE_SIZE,
      offset: this.crates().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.crates.update((crates) => [...crates, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }
}
