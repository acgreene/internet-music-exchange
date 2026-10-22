import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
} from '@angular/core';
import { ApiClient, unwrap } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import { ApiError, HttpStatus, type ReleaseKind } from '@ime/models';
import {
  CoverComponent,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';
import { FollowButton } from '../follow/follow-button';
import { PageMetaService } from '../page-meta';
import { releaseKindLabel } from '../releases/release-labels';

/**
 * An artist's public profile, `/artists/<handle>`: who they are and their
 * discography.
 */
@Component({
  selector: 'ime-artist-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CoverComponent,
    FollowButton,
    ReleaseCardComponent,
    SpinnerComponent,
  ],
  template: `
    @if (profile.value(); as profile) {
      <div class="mx-auto flex max-w-5xl flex-col gap-8">
        @if (profile.headerUrl; as headerUrl) {
          <img
            class="aspect-[4/1] w-full rounded-card object-cover"
            [src]="headerUrl"
            alt=""
          />
        }
        <header class="flex flex-wrap items-center gap-4">
          <ime-cover
            class="w-24 rounded-full"
            [src]="profile.avatarUrl"
            [alt]="profile.artist.name"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <h1 class="text-3xl font-semibold tracking-tight">
              {{ profile.artist.name }}
            </h1>
            <p class="text-sm text-ink-muted">
              &#64;{{ profile.artist.handle }} · {{ followerCount() }}
              {{ followerCount() === 1 ? 'follower' : 'followers' }}
            </p>
          </div>
          <ime-follow-button
            [artistId]="profile.artist.id"
            [following]="following()"
            (followingChange)="onFollowingChange($event)"
          />
        </header>

        @if (profile.artist.bio || profile.links.length) {
          <section class="flex flex-col gap-3">
            @if (profile.artist.bio; as bio) {
              <p class="max-w-prose whitespace-pre-line">{{ bio }}</p>
            }
            @if (profile.links.length) {
              <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                @for (link of profile.links; track link.id) {
                  <li>
                    <a
                      class="underline"
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

        <section
          class="flex flex-col gap-4"
          aria-labelledby="discography-heading"
        >
          <h2 id="discography-heading" class="text-lg font-semibold">
            Discography
          </h2>
          @if (discography.value(); as releases) {
            <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              @for (release of releases; track release.id) {
                <li>
                  <ime-release-card
                    [title]="release.title"
                    [link]="['/artists', profile.artist.handle, release.slug]"
                    [coverUrl]="release.coverUrl"
                    [subtitle]="subtitleFor(release.kind, release.releasedAt)"
                  />
                </li>
              } @empty {
                <li class="text-sm text-ink-muted">Nothing released yet.</li>
              }
            </ul>
          } @else if (discography.isLoading()) {
            <ime-spinner />
          }
        </section>
      </div>
    } @else if (profile.error(); as error) {
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ isNotFound(error) ? 'Artist not found' : 'Something went wrong' }}
        </h1>
        <p class="text-ink-muted">
          {{
            isNotFound(error)
              ? 'Check the address, or search for them by name.'
              : 'The artist could not be loaded. Try again in a moment.'
          }}
        </p>
      </div>
    } @else {
      <ime-spinner />
    }
  `,
})
export class ArtistPage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);
  private readonly meta = inject(PageMetaService);

  public readonly handle = input.required<string>();

  protected readonly profile = resource({
    id: 'artist-profile',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.artists.getProfile(params)),
  });

  protected readonly discography = resource({
    id: 'artist-discography',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.listDiscography(params)),
  });

  /** Whether the signed-in viewer follows the artist. */
  private readonly followed = resource({
    params: () => {
      const artistId = this.profile.value()?.artist.id;
      const userId = this.session.user()?.id;
      return artistId && userId ? { artistId, userId } : undefined;
    },
    loader: async ({ params }) =>
      unwrap(
        await this.api.community.filterFollowed([params.artistId]),
      ).includes(params.artistId),
  });

  protected readonly following = computed(() => this.followed.value() ?? false);
  protected readonly followerCount = linkedSignal(
    () => this.profile.value()?.followerCount ?? 0,
  );

  constructor() {
    effect(() => {
      if (this.isNotFound(this.profile.error())) this.meta.notFound();
      const profile = this.profile.value();
      if (!profile) return;
      this.meta.set({
        title: profile.artist.name,
        description:
          profile.artist.bio?.slice(0, 200) || `${profile.artist.name} on IME.`,
        image: profile.avatarUrl,
      });
    });
  }

  protected onFollowingChange(following: boolean): void {
    this.followed.set(following);
    this.followerCount.update((count) => count + (following ? 1 : -1));
  }

  protected subtitleFor(kind: ReleaseKind, releasedAt: string | null): string {
    const year = releasedAt?.slice(0, 4);
    return year
      ? `${releaseKindLabel(kind)} · ${year}`
      : releaseKindLabel(kind);
  }

  protected isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === HttpStatus.NotFound;
  }
}
