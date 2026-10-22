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
import type { FollowedArtist } from '@ime/models';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { FollowButton } from './follow-button';
import { currentValue } from '@ime/client-data';

const PAGE_SIZE = 50;

/**
 * The artists the signed-in listener follows, most recently followed first.
 */
@Component({
  selector: 'ime-following-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    FollowButton,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Following</h1>
      @if (firstPage.error()) {
        <ime-alert tone="error"
          >The artists you follow could not be loaded.</ime-alert
        >
      }
      <ul class="flex flex-col divide-y divide-hairline">
        @for (artist of artists(); track artist.artistId) {
          <li class="flex items-center justify-between gap-4 py-3">
            <a
              class="flex min-w-0 flex-col hover:underline"
              [routerLink]="['/artists', artist.handle]"
            >
              <span class="truncate font-medium">{{ artist.name }}</span>
              <span class="text-sm text-ink-muted"
                >&#64;{{ artist.handle }}</span
              >
            </a>
            <ime-follow-button
              [artistId]="artist.artistId"
              [following]="true"
            />
          </li>
        } @empty {
          @if (firstPage.hasValue()) {
            <li class="py-3 text-ink-muted">
              You do not follow anyone yet. Follow artists to keep up with their
              new music.
            </li>
          }
        }
      </ul>
      @if (firstPage.isLoading()) {
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
  `,
})
export class FollowingPage {
  private readonly api = inject(ApiClient);

  protected readonly firstPage = resource({
    loader: async () =>
      unwrap(await this.api.community.listFollowing({ limit: PAGE_SIZE })),
  });

  private readonly more = signal<FollowedArtist[]>([]);
  private readonly lastPageSize = signal(PAGE_SIZE);
  protected readonly loadingMore = signal(false);

  protected readonly artists = computed(() => [
    ...(currentValue(this.firstPage) ?? []),
    ...this.more(),
  ]);
  protected readonly hasMore = computed(
    () =>
      (currentValue(this.firstPage)?.length ?? 0) === PAGE_SIZE &&
      this.lastPageSize() === PAGE_SIZE,
  );

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    const result = await this.api.community.listFollowing({
      limit: PAGE_SIZE,
      offset: this.artists().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }
}
