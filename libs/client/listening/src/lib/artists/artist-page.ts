import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { PlayerService, SessionService, currentValue } from '@ime/client-data';
import {
  ApiError,
  type DiscographyItem,
  HttpStatus,
  placeLabel,
  type ReleaseKind,
} from '@ime/models';
import {
  ButtonDirective,
  CoverComponent,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';
import { FollowButton } from '../follow/follow-button';
import { MerchGrid } from '../merch/merch-grid';
import { type MenuAction, MoreMenu } from '../more-menu';
import { PageMetaService } from '../page-meta';
import { openReport } from '../reporting/report-button';
import {
  releaseKindLabel,
  releasePriceLabel,
} from '../releases/release-labels';

/** How the discography is grouped, in the order the groups appear. */
const GROUPS: { label: string; kinds: ReleaseKind[] }[] = [
  { label: 'Albums', kinds: ['album', 'lp'] },
  { label: 'EPs', kinds: ['ep'] },
  { label: 'Singles', kinds: ['single'] },
  {
    label: 'More',
    kinds: ['compilation', 'remaster', 'soundtrack', 'score', 'demo', 'other'],
  },
];

/**
 * An artist's public profile, `/artists/<handle>`: who they are beside
 * their latest release, their discography by kind, and their merch.
 */
@Component({
  selector: 'ime-artist-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonDirective,
    CoverComponent,
    DatePipe,
    FollowButton,
    MerchGrid,
    MoreMenu,
    ReleaseCardComponent,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (profile.hasValue() ? profile.value() : null; as profile) {
      <div class="mx-auto flex max-w-6xl flex-col gap-12">
        <header class="flex flex-col">
          @if (profile.headerUrl; as headerUrl) {
            <img
              class="aspect-[4/1] min-h-28 w-full rounded-card border border-line object-cover"
              [src]="headerUrl"
              alt=""
            />
          }
          <div
            class="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6"
            [class]="profile.headerUrl ? 'px-2 sm:px-6' : ''"
          >
            <ime-cover
              class="size-28 shrink-0 rounded-full border-4 border-canvas sm:size-36"
              [class]="profile.headerUrl ? '-mt-14 sm:-mt-12' : ''"
              [src]="profile.avatarUrl"
              [alt]="profile.artist.name"
            />
            <div class="flex min-w-0 flex-1 flex-col gap-2 sm:pb-1">
              <h1
                class="text-5xl leading-[0.9] font-black tracking-[-0.05em] break-words text-balance md:text-7xl"
              >
                {{ profile.artist.name }}
              </h1>
              <p class="text-sm text-ink-muted">
                @if (profile.artist.country; as country) {
                  <a
                    class="hover:underline"
                    routerLink="/search"
                    [queryParams]="{
                      country,
                      city: profile.artist.city ?? undefined,
                    }"
                    >{{ place(profile.artist.city, country) }}</a
                  >
                  ·
                }
                {{ followerCount() }}
                {{ followerCount() === 1 ? 'follower' : 'followers' }}
              </p>
            </div>
            <div class="flex items-center gap-1 sm:pb-1">
              <ime-follow-button
                [artistId]="profile.artist.id"
                [following]="following()"
                (followingChange)="onFollowingChange($event)"
              />
              <ime-more-menu
                label="More for this artist"
                [actions]="artistActions()"
              />
            </div>
          </div>
        </header>

        <div
          class="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start"
        >
          <aside
            class="flex flex-col gap-4 lg:col-start-2 lg:row-start-1"
            aria-labelledby="about-heading"
          >
            <h2
              id="about-heading"
              class="font-mono text-xs tracking-wider text-ink-muted uppercase"
            >
              About
            </h2>
            @if (profile.artist.bio; as bio) {
              <p class="leading-relaxed whitespace-pre-line">{{ bio }}</p>
            }
            <dl class="flex flex-col gap-1 text-sm">
              @if (profile.artist.country; as country) {
                <div class="flex gap-2">
                  <dt class="text-ink-muted">Based in</dt>
                  <dd>{{ place(profile.artist.city, country) }}</dd>
                </div>
              }
              <div class="flex gap-2">
                <dt class="text-ink-muted">On IME since</dt>
                <dd>{{ profile.artist.createdAt | date: 'MMMM y' }}</dd>
              </div>
            </dl>
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
          </aside>

          <div
            class="flex min-w-0 flex-col gap-12 lg:col-start-1 lg:row-start-1"
          >
            @if (latest(); as latest) {
              <section
                class="flex flex-col gap-3"
                aria-labelledby="latest-heading"
              >
                <h2
                  id="latest-heading"
                  class="font-mono text-xs tracking-wider text-ink-muted uppercase"
                >
                  Latest release
                </h2>
                <div
                  class="grid gap-5 rounded-card border border-line bg-surface p-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center"
                >
                  <a
                    [routerLink]="[
                      '/artists',
                      profile.artist.handle,
                      latest.slug,
                    ]"
                    tabindex="-1"
                  >
                    <ime-cover
                      class="w-full border border-line"
                      [src]="latest.coverUrl"
                      [alt]="'Cover of ' + latest.title"
                    />
                  </a>
                  <div class="flex min-w-0 flex-col gap-2">
                    <p
                      class="font-mono text-xs tracking-wider text-ink-muted uppercase"
                    >
                      {{ kindLabel(latest.kind) }}
                      @if (releaseDate(latest); as date) {
                        · {{ date | date: 'longDate' : 'UTC' }}
                      }
                    </p>
                    <h3
                      class="text-3xl leading-[0.95] font-black tracking-[-0.04em] text-balance md:text-4xl"
                    >
                      <a
                        class="hover:underline"
                        [routerLink]="[
                          '/artists',
                          profile.artist.handle,
                          latest.slug,
                        ]"
                        >{{ latest.title }}</a
                      >
                    </h3>
                    <p class="font-mono text-sm">
                      {{ priceLabel(latest.pricing) }}
                    </p>
                    <div class="mt-1 flex flex-wrap items-center gap-2">
                      @if (latestPlayable().length) {
                        <button imeButton (click)="playLatest()">
                          {{ latestPage()?.owned ? 'Play' : 'Play preview' }}
                        </button>
                      }
                      <a
                        imeButton
                        variant="secondary"
                        [routerLink]="[
                          '/artists',
                          profile.artist.handle,
                          latest.slug,
                        ]"
                        >Go to release</a
                      >
                    </div>
                  </div>
                </div>
              </section>
            }

            @if (discography.hasValue()) {
              @for (group of groups(); track group.label) {
                <section
                  class="flex flex-col gap-4"
                  [attr.aria-labelledby]="'group-' + group.label"
                >
                  <h2
                    class="text-2xl font-extrabold tracking-[-0.035em]"
                    [id]="'group-' + group.label"
                  >
                    {{ group.label }}
                  </h2>
                  <ul
                    class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
                  >
                    @for (release of group.releases; track release.id) {
                      <li>
                        <ime-release-card
                          [title]="release.title"
                          [link]="[
                            '/artists',
                            profile.artist.handle,
                            release.slug,
                          ]"
                          [coverUrl]="release.coverUrl"
                          [subtitle]="subtitleFor(release)"
                        />
                      </li>
                    }
                  </ul>
                </section>
              } @empty {
                <p class="text-sm text-ink-muted">Nothing released yet.</p>
              }
            } @else if (discography.isLoading()) {
              <ime-spinner />
            }

            @if (store().length) {
              <section
                class="flex flex-col gap-4"
                aria-labelledby="merch-heading"
              >
                <h2
                  id="merch-heading"
                  class="text-2xl font-extrabold tracking-[-0.035em]"
                >
                  Merch
                </h2>
                <ime-merch-grid
                  [items]="store()"
                  [handle]="profile.artist.handle"
                />
              </section>
            }
          </div>
        </div>
      </div>
    } @else if (profile.error(); as error) {
      <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
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
  private readonly player = inject(PlayerService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  public readonly handle = input.required<string>();

  protected readonly place = placeLabel;
  protected readonly kindLabel = releaseKindLabel;
  protected readonly priceLabel = releasePriceLabel;

  protected readonly profile = resource({
    id: 'artist-profile',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.artists.getProfile(params)),
  });

  private readonly storeResource = resource({
    id: 'artist-store',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.merch.listStore(params)),
  });
  protected readonly store = computed(
    () => currentValue(this.storeResource) ?? [],
  );

  protected readonly discography = resource({
    id: 'artist-discography',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.listDiscography(params)),
  });

  /** Every release, newest first. */
  private readonly releases = computed(() =>
    [...(currentValue(this.discography) ?? [])].sort((a, b) =>
      (this.releaseDate(b) ?? '').localeCompare(this.releaseDate(a) ?? ''),
    ),
  );
  protected readonly latest = computed(() => this.releases()[0] ?? null);
  protected readonly groups = computed(() =>
    GROUPS.map((group) => ({
      label: group.label,
      releases: this.releases().filter((release) =>
        group.kinds.includes(release.kind),
      ),
    })).filter((group) => group.releases.length),
  );

  /** The latest release's tracks, to play from the top of the page. */
  protected readonly latestPageResource = resource({
    params: () => {
      const latest = this.latest();
      const userId = this.session.user()?.id;
      return latest ? { slug: latest.slug, userId } : undefined;
    },
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.getReleasePage(this.handle(), params.slug)),
  });
  protected readonly latestPage = computed(() =>
    currentValue(this.latestPageResource),
  );
  protected readonly latestPlayable = computed(() => {
    const page = this.latestPage();
    if (!page) return [];
    return page.tracks.filter(
      (track) => page.owned || (track.isPreview && page.onSale),
    );
  });

  protected readonly artistActions = computed<MenuAction[]>(() => [
    { label: 'Report', run: () => this.report() },
  ]);

  /** Whether the signed-in viewer follows the artist. */
  private readonly followed = resource({
    params: () => {
      const artistId = currentValue(this.profile)?.artist.id;
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
    () => currentValue(this.profile)?.followerCount ?? 0,
  );

  constructor() {
    effect(() => {
      if (this.isNotFound(this.profile.error())) this.meta.notFound();
      const profile = currentValue(this.profile);
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

  /** When it came out, or went up on IME when the artist gave no date. */
  protected releaseDate(release: DiscographyItem): string | null {
    return (
      release.releasedAt ??
      release.publishedAt?.toISOString().slice(0, 10) ??
      null
    );
  }

  protected subtitleFor(release: DiscographyItem): string {
    return [
      this.releaseDate(release)?.slice(0, 4),
      releasePriceLabel(release.pricing),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected async playLatest(): Promise<void> {
    const page = this.latestPage();
    if (!page) return;
    await this.player.play(
      this.latestPlayable().map((track) => ({
        releaseId: page.release.id,
        trackId: track.trackId,
        title: track.title,
        durationMs: track.durationMs,
        releaseTitle: page.release.title,
        releaseSlug: page.release.slug,
        artistName: page.artist.name,
        artistHandle: page.artist.handle,
        coverUrl: page.coverUrl,
      })),
      0,
    );
  }

  private async report(): Promise<void> {
    const profile = currentValue(this.profile);
    if (!profile) return;
    if (this.session.status() === 'signed-out') {
      await this.router.navigate(['/sign-in'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    await openReport(this.injector, {
      targetType: 'artist',
      targetId: profile.artist.id,
      label: profile.artist.name,
    });
  }

  protected isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === HttpStatus.NotFound;
  }
}
