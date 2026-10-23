import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { SessionService, currentValue } from '@ime/client-data';
import { placeLabel } from '@ime/models';
import { CoverComponent } from '@ime/ui';
import { FollowButton } from '../follow/follow-button';

/**
 * The artist behind a release, beside it: their photo, where they are
 * based, a follow button, and their links.
 */
@Component({
  selector: 'ime-release-artist-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent, FollowButton, RouterLink],
  template: `
    @if (profile(); as profile) {
      <section
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
        aria-labelledby="release-artist-heading"
      >
        <div class="flex items-center gap-3">
          <a [routerLink]="['/artists', profile.artist.handle]" tabindex="-1">
            <ime-cover
              class="size-16 shrink-0 rounded-full"
              [src]="profile.avatarUrl"
              alt=""
            />
          </a>
          <div class="flex min-w-0 flex-col">
            <h2 id="release-artist-heading" class="truncate text-lg font-bold">
              <a
                class="hover:underline"
                [routerLink]="['/artists', profile.artist.handle]"
                >{{ profile.artist.name }}</a
              >
            </h2>
            @if (profile.artist.country; as country) {
              <a
                class="truncate text-sm text-ink-muted hover:underline"
                routerLink="/search"
                [queryParams]="{
                  country,
                  city: profile.artist.city ?? undefined,
                }"
                >{{ place(profile.artist.city, country) }}</a
              >
            }
            <span class="font-mono text-xs text-ink-muted"
              >{{ followerCount() }}
              {{ followerCount() === 1 ? 'follower' : 'followers' }}</span
            >
          </div>
        </div>
        @if (profile.artist.bio; as bio) {
          <p class="line-clamp-4 text-sm leading-relaxed">{{ bio }}</p>
        }
        <div>
          <ime-follow-button
            [artistId]="profile.artist.id"
            [following]="following()"
            (followingChange)="onFollowingChange($event)"
          />
        </div>
        @if (profile.links.length) {
          <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            @for (link of profile.links; track link.id) {
              <li>
                <a
                  class="link"
                  target="_blank"
                  rel="noopener"
                  [href]="link.url"
                  >{{ link.label }}</a
                >
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
})
export class ReleaseArtistCard {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);

  public readonly handle = input.required<string>();

  protected readonly place = placeLabel;

  private readonly profileResource = resource({
    id: 'release-artist',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.artists.getProfile(params)),
  });
  protected readonly profile = computed(() =>
    currentValue(this.profileResource),
  );

  /** Whether the signed-in viewer follows the artist. */
  private readonly followed = resource({
    params: () => {
      const artistId = this.profile()?.artist.id;
      const userId = this.session.user()?.id;
      return artistId && userId ? { artistId, userId } : undefined;
    },
    loader: async ({ params }) =>
      unwrap(
        await this.api.community.filterFollowed([params.artistId]),
      ).includes(params.artistId),
  });
  protected readonly following = computed(
    () => currentValue(this.followed) ?? false,
  );
  protected readonly followerCount = linkedSignal(
    () => this.profile()?.followerCount ?? 0,
  );

  protected onFollowingChange(following: boolean): void {
    this.followed.set(following);
    this.followerCount.update((count) => count + (following ? 1 : -1));
  }
}
