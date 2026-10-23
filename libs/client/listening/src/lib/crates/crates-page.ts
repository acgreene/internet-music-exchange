import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { SessionService, currentValue } from '@ime/client-data';
import { type CrateCard as Crate, GENRES } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { CrateCard } from './crate-card';

const PAGE_SIZE = 24;
/** The most saved list ends here. */
const MOST_SAVED = 100;

/**
 * Crates, `/crates`: the listener's own and today's crate built from their
 * library, building one from records they love, new crates from the people
 * they follow, the most saved crates, and crates by genre.
 */
@Component({
  selector: 'ime-crates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CrateCard,
    InputDirective,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-12">
      <header class="flex flex-col gap-3 border-b border-line pb-8">
        <span class="font-mono text-xs tracking-wider text-ink-muted uppercase"
          >Crates</span
        >
        <h1
          class="max-w-3xl text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-6xl"
        >
          Boxes of records, put together by people.
        </h1>
        <p class="max-w-prose leading-relaxed">
          Anyone can make a crate and say why each record is in it. Dig through
          other people's, follow the ones whose taste you trust, or let IME
          build one by sound or from records you love.
        </p>
        <div class="flex flex-wrap gap-3">
          <a imeButton routerLink="/crates/build"
            >Build one from records you love</a
          >
          @if (session.isSignedIn()) {
            <a imeButton variant="secondary" routerLink="/crates/day"
              >Your crate of the day</a
            >
          }
        </div>
      </header>

      @if (session.isSignedIn()) {
        <section class="flex flex-col gap-4" aria-labelledby="mine-heading">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="mine-heading"
              class="text-2xl font-extrabold tracking-[-0.035em]"
            >
              Your crates
            </h2>
            <button
              imeButton
              variant="secondary"
              size="sm"
              (click)="creating.set(!creating())"
            >
              {{ creating() ? 'Cancel' : 'New crate' }}
            </button>
          </div>
          @if (creating()) {
            <form
              class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center"
              (submit)="create($event)"
            >
              <input
                imeInput
                class="flex-1"
                maxlength="80"
                aria-label="Crate name"
                placeholder="Name it, like “Sunday morning” or “Glasgow, 2024”"
                [value]="newName()"
                (input)="newName.set($any($event.target).value)"
              />
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  [checked]="newPublic()"
                  (change)="newPublic.set($any($event.target).checked)"
                />
                Public
              </label>
              <button imeButton type="submit" [disabled]="!newName().trim()">
                Make it
              </button>
            </form>
            @if (createError(); as error) {
              <ime-alert tone="error">{{ error }}</ime-alert>
            }
          }
          @if (mine(); as mine) {
            <ul
              class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6"
            >
              @for (crate of mine; track crate.id) {
                <li><ime-crate-card [crate]="crate" [byLine]="false" /></li>
              } @empty {
                <li class="col-span-full text-sm text-ink-muted">
                  No crates yet. Make one, or add any release to a crate from
                  its page.
                </li>
              }
            </ul>
          }
        </section>

        @if (followed()?.length) {
          <section
            class="flex flex-col gap-4"
            aria-labelledby="followed-heading"
          >
            <h2
              id="followed-heading"
              class="text-2xl font-extrabold tracking-[-0.035em]"
            >
              New from people you follow
            </h2>
            <ul
              class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6"
            >
              @for (crate of followed(); track crate.id) {
                <li><ime-crate-card [crate]="crate" /></li>
              }
            </ul>
          </section>
        }
      }

      <section class="flex flex-col gap-4" aria-labelledby="public-heading">
        <h2
          id="public-heading"
          class="text-2xl font-extrabold tracking-[-0.035em]"
        >
          Most saved
        </h2>
        @if (publicCrates.error()) {
          <ime-alert tone="error">Crates could not be loaded.</ime-alert>
        }
        <ul
          class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6"
        >
          @for (crate of everyone(); track crate.id) {
            <li><ime-crate-card [crate]="crate" /></li>
          } @empty {
            @if (publicCrates.hasValue()) {
              <li class="col-span-full text-sm text-ink-muted">
                No crates saved yet.
              </li>
            }
          }
        </ul>
        @if (publicCrates.isLoading()) {
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

      <section class="flex flex-col gap-4" aria-labelledby="sound-heading">
        <h2
          id="sound-heading"
          class="text-2xl font-extrabold tracking-[-0.035em]"
        >
          Crates by sound
        </h2>
        <ul
          class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          @for (genre of genres; track genre.id) {
            <li>
              <a
                class="block rounded-full border border-line px-3 py-1 text-sm whitespace-nowrap hover:border-ink hover:bg-wash"
                [routerLink]="['/crates/genre', genre.id]"
                >{{ genre.name }}</a
              >
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class CratesPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly genres = GENRES;

  private readonly mineResource = resource({
    params: () => this.session.user()?.id,
    loader: async () => unwrap(await this.api.crates.listMine()),
  });
  protected readonly mine = computed(() => currentValue(this.mineResource));

  private readonly followedResource = resource({
    params: () => this.session.user()?.id,
    loader: async () => unwrap(await this.api.crates.listFromFollowed()),
  });
  protected readonly followed = computed(() =>
    currentValue(this.followedResource),
  );

  protected readonly publicCrates = resource({
    id: 'public-crates',
    loader: async () =>
      unwrap(
        await this.api.crates.listPublic({ sort: 'saved', limit: PAGE_SIZE }),
      ),
  });
  private readonly more = signal<Crate[]>([]);
  private readonly lastPageSize = signal(PAGE_SIZE);
  protected readonly loadingMore = signal(false);
  protected readonly everyone = computed(() => [
    ...(currentValue(this.publicCrates) ?? []),
    ...this.more(),
  ]);
  protected readonly hasMore = computed(
    () =>
      (currentValue(this.publicCrates)?.length ?? 0) === PAGE_SIZE &&
      this.lastPageSize() === PAGE_SIZE &&
      this.everyone().length < MOST_SAVED,
  );

  protected readonly creating = signal(false);
  protected readonly newName = signal('');
  protected readonly newPublic = signal(true);
  protected readonly createError = signal<string | null>(null);

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.createError.set(null);
    const result = await this.api.crates.create({
      name: this.newName(),
      visibility: this.newPublic() ? 'public' : 'private',
    });
    if (result.ok) await this.router.navigate(['/crates', result.data.id]);
    else this.createError.set(result.error.message);
  }

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    const result = await this.api.crates.listPublic({
      sort: 'saved',
      limit: PAGE_SIZE,
      offset: this.everyone().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }
}
