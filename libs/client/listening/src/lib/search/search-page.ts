import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';

/**
 * Artists by name and releases by title, `/search?q=...`.
 */
@Component({
  selector: 'ime-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    InputDirective,
    ReleaseCardComponent,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-8">
      <form class="flex gap-2" role="search" (submit)="search($event)">
        <input
          imeInput
          type="search"
          name="q"
          aria-label="Search artists and releases"
          placeholder="Artists and releases"
          [value]="draft()"
          (input)="onDraft($event)"
        />
        <button imeButton type="submit">Search</button>
      </form>

      @if (results.hasValue() ? results.value() : null; as results) {
        @if (!results.artists.length && !results.releases.length) {
          <p class="text-ink-muted">Nothing matches “{{ query() }}”.</p>
        }
        @if (results.artists.length) {
          <section
            class="flex flex-col gap-3"
            aria-labelledby="artists-heading"
          >
            <h2 id="artists-heading" class="text-xl font-semibold">Artists</h2>
            <ul class="flex flex-col divide-y divide-line">
              @for (artist of results.artists; track artist.id) {
                <li>
                  <a
                    class="flex flex-col py-2 hover:underline"
                    [routerLink]="['/artists', artist.handle]"
                  >
                    <span class="font-medium">{{ artist.name }}</span>
                    <span class="text-sm text-ink-muted"
                      >&#64;{{ artist.handle }}</span
                    >
                  </a>
                </li>
              }
            </ul>
          </section>
        }
        @if (results.releases.length) {
          <section
            class="flex flex-col gap-3"
            aria-labelledby="releases-heading"
          >
            <h2 id="releases-heading" class="text-xl font-semibold">
              Releases
            </h2>
            <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              @for (release of results.releases; track release.id) {
                <li>
                  <ime-release-card
                    [title]="release.title"
                    [link]="['/artists', release.artistHandle, release.slug]"
                    [coverUrl]="release.coverUrl"
                    [subtitle]="release.artistName"
                    [subtitleLink]="['/artists', release.artistHandle]"
                  />
                </li>
              }
            </ul>
          </section>
        }
      } @else if (results.isLoading()) {
        <ime-spinner />
      } @else if (results.error()) {
        <ime-alert tone="error"
          >The search did not go through. Try again.</ime-alert
        >
      }
    </div>
  `,
})
export class SearchPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  /** The `q` query parameter. */
  public readonly q = input<string>();

  protected readonly query = computed(() => this.q()?.trim() ?? '');
  protected readonly draft = linkedSignal(() => this.query());

  protected readonly results = resource({
    id: 'search-results',
    params: () => this.query() || undefined,
    loader: async ({ params }) => unwrap(await this.api.catalog.search(params)),
  });

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected async search(event: Event): Promise<void> {
    event.preventDefault();
    const q = this.draft().trim();
    await this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }
}
