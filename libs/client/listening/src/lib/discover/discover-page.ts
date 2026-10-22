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
import type { ReleaseCardWithArtist } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';

const PAGE_SIZE = 24;
const FEED_SIZE = 8;

/**
 * Where listening starts: new music from followed artists, then everything
 * newly released.
 */
@Component({
  selector: 'ime-discover-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    ReleaseCardComponent,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-10">
      @if (session.status() === 'signed-out') {
        <section class="flex flex-col gap-3">
          <h1 class="text-3xl font-semibold tracking-tight">
            Music from the people who made it
          </h1>
          <p class="max-w-prose text-ink-muted">
            Independent music, sold straight from the artists. Buy it once and
            it is yours to stream and download.
          </p>
          <div class="flex gap-2">
            <a imeButton routerLink="/sign-up">Create an account</a>
            <a imeButton variant="secondary" routerLink="/search">Search</a>
          </div>
        </section>
      }

      @if (session.isSignedIn()) {
        <section class="flex flex-col gap-4" aria-labelledby="feed-heading">
          <h2 id="feed-heading" class="text-xl font-semibold">
            New from artists you follow
          </h2>
          @if (feed.hasValue() ? feed.value() : null; as items) {
            @if (items.length) {
              <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                @for (item of items; track item.releaseId) {
                  <li>
                    <ime-release-card
                      [title]="item.title"
                      [link]="['/artists', item.artistHandle, item.slug]"
                      [coverUrl]="item.coverUrl"
                      [subtitle]="item.artistName"
                      [subtitleLink]="['/artists', item.artistHandle]"
                    />
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm text-ink-muted">
                Follow artists to see their new releases here.
              </p>
            }
          } @else if (feed.isLoading()) {
            <ime-spinner />
          }
        </section>
      }

      <section class="flex flex-col gap-4" aria-labelledby="recent-heading">
        <h2 id="recent-heading" class="text-xl font-semibold">New releases</h2>
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
  protected readonly session = inject(SessionService);

  protected readonly recent = resource({
    id: 'catalog-recent',
    loader: async () =>
      unwrap(await this.api.catalog.listRecent({ limit: PAGE_SIZE })),
  });

  protected readonly feed = resource({
    params: () => this.session.user()?.id,
    loader: async () =>
      unwrap(await this.api.catalog.getFeed({ limit: FEED_SIZE })),
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
