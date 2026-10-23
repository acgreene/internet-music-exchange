import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { SessionService, currentValue } from '@ime/client-data';
import type { BuiltCrate, SearchRelease } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { CrateList } from './crate-list';

/** The crates IME builds, each by a fixed rule. */
export type BuiltCrateKind = 'sound' | 'day' | 'records';

const MAX_SEEDS = 5;
const RESULTS_SHOWN = 8;

/**
 * A crate IME built: by a genre or tag (`/crates/sound?genre=`), from the
 * listener's library for the day (`/crates/day`), or from up to five records
 * they love (`/crates/build`). Any of them can be saved as their own crate.
 */
@Component({
  selector: 'ime-built-crate-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    CrateList,
    InputDirective,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-4xl flex-col gap-8">
      <a class="link w-fit text-sm" routerLink="/crates">All crates</a>

      @if (kind() === 'records') {
        <section class="flex flex-col gap-4" aria-labelledby="pick-heading">
          <div class="flex flex-col gap-2">
            <h1
              id="pick-heading"
              class="text-4xl leading-[0.95] font-black tracking-[-0.05em]"
            >
              Build a crate from records you love
            </h1>
            <p class="max-w-prose text-ink-muted">
              Pick up to {{ maxSeeds }}. IME fills a crate with what the people
              who kept them also kept, the crates they sit in, and records that
              share their sound. No AI, just those three rules.
            </p>
          </div>
          @if (seeds().length) {
            <ul class="flex flex-wrap gap-2" aria-label="Your picks">
              @for (seed of seeds(); track seed.release.id) {
                <li
                  class="flex items-center gap-2 rounded-full border border-ink py-1 pr-1 pl-1 text-sm"
                >
                  <ime-cover
                    class="size-6 rounded-full"
                    [src]="seed.release.coverUrl"
                    alt=""
                  />
                  {{ seed.release.title }}
                  <button
                    class="rounded-full px-1.5 hover:bg-wash"
                    [attr.aria-label]="'Remove ' + seed.release.title"
                    (click)="unpick(seed.release.id)"
                  >
                    ×
                  </button>
                </li>
              }
            </ul>
          }
          @if (seeds().length < maxSeeds) {
            <input
              imeInput
              type="search"
              class="sm:max-w-md"
              aria-label="Find a record"
              placeholder="Find a record by title or artist"
              [value]="query()"
              (input)="find($any($event.target).value)"
            />
            @if (results().length) {
              <ul class="grid gap-2 sm:grid-cols-2">
                @for (result of results(); track result.release.id) {
                  <li>
                    <button
                      class="flex w-full items-center gap-3 rounded-control border border-line p-2 text-left hover:bg-wash"
                      (click)="pick(result)"
                    >
                      <ime-cover
                        class="size-10 shrink-0"
                        [src]="result.release.coverUrl"
                        alt=""
                      />
                      <span class="flex min-w-0 flex-col">
                        <span class="truncate font-semibold">{{
                          result.release.title
                        }}</span>
                        <span class="truncate text-sm text-ink-muted">{{
                          result.release.artistName
                        }}</span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            }
          }
          <div>
            <button imeButton [disabled]="!seeds().length" (click)="build()">
              Build the crate
            </button>
          </div>
        </section>
      }

      @if (crate(); as crate) {
        <section class="flex flex-col gap-4" aria-labelledby="built-heading">
          <div class="flex flex-col gap-2">
            <span
              class="font-mono text-xs tracking-wider text-ink-muted uppercase"
              >Built by IME / {{ crate.items.length }} records</span
            >
            <h2
              id="built-heading"
              class="text-4xl leading-[0.95] font-black tracking-[-0.05em]"
            >
              {{ crate.name }}
            </h2>
            <p class="max-w-prose text-ink-muted">{{ crate.reason }}</p>
            <div class="flex flex-wrap items-center gap-3">
              @if (kind() === 'sound' && crate.items.length) {
                <a
                  imeButton
                  routerLink="/dig/sound"
                  [queryParams]="{ genre: genre(), tag: tag() }"
                  >Dig it</a
                >
              }
              @if (session.isSignedIn()) {
                <button
                  imeButton
                  variant="secondary"
                  [busy]="saving()"
                  [disabled]="!crate.items.length"
                  (click)="save(crate)"
                >
                  Save as my crate
                </button>
              } @else {
                <a
                  class="link text-sm"
                  routerLink="/sign-in"
                  [queryParams]="{ returnUrl: router.url }"
                  >Sign in to save it as your own</a
                >
              }
            </div>
            @if (error(); as error) {
              <ime-alert tone="error">{{ error }}</ime-alert>
            }
          </div>
          <ime-crate-list
            [items]="crate.items"
            emptyText="Nothing fits yet. Try other records, or come back as IME grows."
          />
        </section>
      } @else if (loading()) {
        <ime-spinner />
      } @else if (kind() === 'day' && built.hasValue()) {
        <p class="text-ink-muted">
          Your crate of the day is built from your library. Keep a record or
          two, and it appears here.
        </p>
      } @else if (built.error()) {
        <ime-alert tone="error">This crate could not be built.</ime-alert>
      }
    </div>
  `,
})
export class BuiltCratePage {
  private readonly api = inject(ApiClient);
  protected readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  /** Which rule builds the crate, from the route's data. */
  public readonly kind = input.required<BuiltCrateKind>();
  /** `?genre=` for a crate by sound. */
  public readonly genre = input<string>();
  /** `?tag=` for a crate by sound. */
  public readonly tag = input<string>();

  protected readonly maxSeeds = MAX_SEEDS;

  /** The crates by sound and of the day load from the address. */
  protected readonly built = resource({
    id: 'built-crate',
    params: () => {
      const kind = this.kind();
      if (kind === 'sound') {
        return { kind, genre: this.genre(), tag: this.tag() };
      }
      return kind === 'day' && this.session.isSignedIn() ? { kind } : undefined;
    },
    loader: async ({ params }) =>
      unwrap(
        params.kind === 'sound'
          ? await this.api.crates.bySound({
              genre: params.genre,
              tag: params.tag,
            })
          : await this.api.crates.ofTheDay(),
      ),
  });

  protected readonly seeds = signal<SearchRelease[]>([]);
  protected readonly query = signal('');
  protected readonly results = signal<SearchRelease[]>([]);
  private readonly fromRecords = signal<BuiltCrate | null>(null);
  private readonly building = signal(false);

  protected readonly crate = computed(() =>
    this.kind() === 'records'
      ? this.fromRecords()
      : (currentValue(this.built) ?? null),
  );
  protected readonly loading = computed(
    () => this.built.isLoading() || this.building(),
  );

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  private latest = 0;

  protected async find(text: string): Promise<void> {
    this.query.set(text);
    const q = text.trim();
    const request = ++this.latest;
    if (!q) {
      this.results.set([]);
      return;
    }
    const result = await this.api.catalog.search({ q, limit: RESULTS_SHOWN });
    if (request !== this.latest || !result.ok) return;
    const picked = new Set(this.seeds().map((seed) => seed.release.id));
    this.results.set(
      result.data.releases.filter((item) => !picked.has(item.release.id)),
    );
  }

  protected pick(result: SearchRelease): void {
    this.seeds.update((seeds) => [...seeds, result].slice(0, MAX_SEEDS));
    this.query.set('');
    this.results.set([]);
  }

  protected unpick(releaseId: string): void {
    this.seeds.update((seeds) =>
      seeds.filter((seed) => seed.release.id !== releaseId),
    );
  }

  protected async build(): Promise<void> {
    this.building.set(true);
    this.error.set(null);
    const result = await this.api.crates.fromRecords(
      this.seeds().map((seed) => seed.release.id),
    );
    this.building.set(false);
    if (result.ok) this.fromRecords.set(result.data);
    else this.error.set(result.error.message);
  }

  protected async save(crate: BuiltCrate): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    const result = await this.api.crates.create({
      name: crate.name.slice(0, 80),
      note: crate.reason.slice(0, 500),
      visibility: 'private',
      releaseIds: crate.items.map((item) => item.release.id),
    });
    this.saving.set(false);
    if (result.ok) await this.router.navigate(['/crates', result.data.id]);
    else this.error.set(result.error.message);
  }
}
