import { DatePipe } from '@angular/common';
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
import type { Follower } from '@ime/models';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { StudioService } from '../studio.service';
import { currentValue } from '@ime/client-data';

const PAGE_SIZE = 50;

/**
 * Who follows the artist, newest first, with a way to remove a follower.
 */
@Component({
  selector: 'ime-followers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-3xl flex-col gap-6">
      <h1 class="text-2xl font-semibold tracking-tight">Followers</h1>
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
      <ul
        class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
      >
        @for (follower of followers(); track follower.userId) {
          <li class="flex items-center justify-between gap-4 p-4">
            <span class="flex flex-col">
              @if (follower.username) {
                <a
                  class="font-medium hover:underline"
                  [routerLink]="['/users', follower.username]"
                  >{{ follower.name || follower.username }}</a
                >
              } @else {
                <span class="font-medium">{{
                  follower.name || 'A listener'
                }}</span>
              }
              <span class="text-sm text-ink-muted"
                >Following since
                {{ follower.followedAt | date: 'mediumDate' }}</span
              >
            </span>
            <button
              imeButton
              variant="ghost"
              size="sm"
              (click)="remove(follower)"
            >
              Remove
            </button>
          </li>
        } @empty {
          @if (firstPage.hasValue()) {
            <li class="p-4 text-ink-muted">
              No followers yet. They arrive as listeners find your music.
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
export class FollowersPage {
  private readonly api = inject(ApiClient);
  private readonly studio = inject(StudioService);

  protected readonly firstPage = resource({
    params: () => this.studio.currentArtistId() ?? undefined,
    loader: async ({ params }) =>
      unwrap(
        await this.api.community.listFollowers(params, { limit: PAGE_SIZE }),
      ),
  });

  private readonly more = signal<Follower[]>([]);
  private readonly removed = signal(new Set<string>());
  private readonly lastPageSize = signal(PAGE_SIZE);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly followers = computed(() =>
    [...(currentValue(this.firstPage) ?? []), ...this.more()].filter(
      (follower) => !this.removed().has(follower.userId),
    ),
  );
  protected readonly hasMore = computed(
    () =>
      (currentValue(this.firstPage)?.length ?? 0) === PAGE_SIZE &&
      this.lastPageSize() === PAGE_SIZE,
  );

  protected async loadMore(): Promise<void> {
    const artistId = this.studio.currentArtistId();
    if (!artistId) return;
    this.loadingMore.set(true);
    const result = await this.api.community.listFollowers(artistId, {
      limit: PAGE_SIZE,
      offset: (currentValue(this.firstPage)?.length ?? 0) + this.more().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }

  protected async remove(follower: Follower): Promise<void> {
    const artistId = this.studio.currentArtistId();
    if (!artistId) return;
    this.error.set(null);
    const result = await this.api.community.removeFollower(
      artistId,
      follower.userId,
    );
    if (result.ok) {
      this.removed.update((removed) => new Set(removed).add(follower.userId));
    } else {
      this.error.set(result.error.message);
    }
  }
}
