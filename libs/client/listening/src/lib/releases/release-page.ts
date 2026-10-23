import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import {
  PlayerService,
  type QueueTrack,
  SessionService,
  currentValue,
} from '@ime/client-data';
import {
  ApiError,
  genreName,
  HttpStatus,
  type ReleaseCard,
  sideOf,
  type TracklistItem,
} from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  DurationPipe,
  EqualizerComponent,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';
import { ArtistPageHost } from '@ime/client-artist-pages';
import { BuyPanel } from '../buying/buy-panel';
import { ReleaseSupporters } from '../comments/release-supporters';
import { AddToCrate } from '../crates/add-to-crate';
import { CrateCard } from '../crates/crate-card';
import { type MenuAction, MoreMenu } from '../more-menu';
import { openReport } from '../reporting/report-button';
import { PageMetaService } from '../page-meta';
import { ReleaseArtistCard } from './release-artist-card';
import { ReleaseFormats } from './release-formats';
import { assetKindLabel, releaseKindLabel } from './release-labels';

/** Other releases by the artist shown at the bottom of the page. */
const MORE_FROM_ARTIST = 6;
/** Crates holding the release shown at the bottom of the page. */
const CRATES_SHOWN = 6;

/**
 * A release's page, `/artists/<handle>/<slug>`. Undesigned, it is the cover
 * with every way to get it and the artist beside the title, tracklist, the
 * artist's words, credits, and who supported it; then more from the artist
 * and the crates it is in. Designed, the artist's design takes the page.
 */
@Component({
  selector: 'ime-release-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddToCrate,
    ArtistPageHost,
    AlertComponent,
    BuyPanel,
    ButtonDirective,
    CoverComponent,
    CrateCard,
    DatePipe,
    DurationPipe,
    EqualizerComponent,
    MoreMenu,
    ReleaseArtistCard,
    ReleaseCardComponent,
    ReleaseFormats,
    ReleaseSupporters,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (page.hasValue() ? page.value() : null; as page) {
      @if (bundleUrl(); as bundleUrl) {
        <div class="mx-auto flex max-w-5xl flex-col gap-8">
          <ime-artist-page-host
            class="block border border-line"
            [bundleUrl]="bundleUrl"
            [payload]="renderPayload()!"
            (purchaseRequested)="openBuyPanel()"
            (playRequested)="playPosition($event)"
          />
          <section
            #buySection
            class="flex flex-col gap-3"
            aria-label="Get this release"
          >
            @if (buyOpen() || owned()) {
              <ime-buy-panel
                class="max-w-md"
                [page]="page"
                [owned]="owned()"
                (claimed)="viewerPage.reload()"
              />
            } @else {
              <div class="flex items-center gap-2">
                <button imeButton (click)="openBuyPanel()">
                  {{ page.pricing?.mode === 'free' ? 'Get it free' : 'Buy' }}
                </button>
                <ime-more-menu
                  label="More for this release"
                  [actions]="releaseActions()"
                />
              </div>
            }
          </section>
          <ime-release-supporters
            [releaseId]="page.release.id"
            [owned]="owned()"
            [canModerate]="managesArtist()"
          />
        </div>
      } @else {
        <article class="mx-auto flex max-w-6xl flex-col gap-16">
          <div
            class="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-12"
          >
            <div
              class="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-8"
            >
              <ime-cover
                class="order-1 w-full border border-line"
                [src]="page.coverUrl"
                [alt]="'Cover of ' + page.release.title"
              />
              <ime-release-formats
                #formats
                class="order-4"
                [page]="page"
                [editions]="editions()"
                [owned]="owned()"
                (claimed)="viewerPage.reload()"
              />
              <ime-release-artist-card
                class="order-9"
                [handle]="page.artist.handle"
              />
              <ime-release-supporters
                class="order-10"
                [releaseId]="page.release.id"
                [owned]="owned()"
                [canModerate]="managesArtist()"
              />
            </div>

            <div
              class="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-12"
            >
              <header class="order-2 flex flex-col gap-3">
                <p
                  class="font-mono text-xs tracking-wider text-ink-muted uppercase"
                >
                  {{ kindLabel() }}
                  @if (page.release.releasedAt; as releasedAt) {
                    · {{ releasedAt | date: 'longDate' : 'UTC' }}
                  }
                  · {{ trackCount() }}
                  @if (runtime(); as runtime) {
                    · {{ runtime }}
                  }
                </p>
                <h1
                  class="text-5xl leading-[0.9] font-black tracking-[-0.05em] text-balance md:text-7xl"
                >
                  {{ page.release.title }}
                </h1>
                <p class="text-lg">
                  by
                  <a
                    class="link font-semibold"
                    [routerLink]="['/artists', page.artist.handle]"
                    >{{ page.artist.name }}</a
                  >
                </p>
                @if (page.release.genres.length || page.release.tags.length) {
                  <ul
                    class="flex flex-wrap gap-1.5"
                    aria-label="Genres and tags"
                  >
                    @for (genre of page.release.genres; track genre) {
                      <li>
                        <a
                          class="block rounded-full border border-ink px-2.5 py-0.5 text-sm font-medium hover:bg-wash"
                          routerLink="/search"
                          [queryParams]="{ genres: genre }"
                          >{{ genreName(genre) }}</a
                        >
                      </li>
                    }
                    @for (tag of page.release.tags; track tag) {
                      <li>
                        <a
                          class="block rounded-full border border-line px-2.5 py-0.5 text-sm text-ink-muted hover:bg-wash"
                          routerLink="/search"
                          [queryParams]="{ q: tag }"
                          >{{ tag }}</a
                        >
                      </li>
                    }
                  </ul>
                }
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  @if (playable().length) {
                    <button imeButton (click)="play()">
                      {{ owned() ? 'Play' : 'Play preview' }}
                    </button>
                  }
                  @if (page.release.status === 'published') {
                    <ime-add-to-crate [releaseId]="page.release.id" />
                  }
                  <ime-more-menu
                    label="More for this release"
                    [actions]="releaseActions()"
                  />
                </div>
              </header>

              <section class="order-3" aria-labelledby="tracks-heading">
                <h2 id="tracks-heading" class="sr-only">Tracks</h2>
                <ol class="flex flex-col border-t border-line">
                  @for (track of page.tracks; track track.trackId) {
                    @if (opensSide(track); as side) {
                      <li
                        class="border-b border-hairline px-2 pt-4 pb-1.5 font-mono text-xs tracking-wider text-ink-muted uppercase"
                        aria-hidden="true"
                      >
                        Side {{ side }}
                      </li>
                    }
                    <li
                      class="flex border-b border-hairline"
                      [class.bg-marker]="isCurrent(track)"
                    >
                      <button
                        class="group grid min-w-0 flex-1 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2.5 text-left text-[15px]"
                        [class]="isCurrent(track) ? '' : 'hover:bg-wash'"
                        [attr.aria-current]="isCurrent(track) || null"
                        [attr.aria-label]="
                          canPlay(track)
                            ? 'Play ' + track.title
                            : track.title + ', buy the record to hear it'
                        "
                        (click)="canPlay(track) ? play(track) : showFormats()"
                      >
                        <span
                          class="flex justify-end font-mono text-sm text-ink-muted"
                        >
                          @if (isCurrent(track)) {
                            <ime-equalizer
                              class="text-ink"
                              [playing]="playing()"
                            />
                          } @else if (canPlay(track)) {
                            <span class="group-hover:hidden">{{
                              trackNumber(track)
                            }}</span>
                            <svg
                              viewBox="0 0 12 12"
                              class="ml-auto hidden size-3 fill-ink group-hover:block"
                              aria-hidden="true"
                            >
                              <path d="M2 1l9 5-9 5z" />
                            </svg>
                          } @else {
                            {{ trackNumber(track) }}
                          }
                        </span>
                        <span class="flex min-w-0 items-center gap-2">
                          <span
                            class="truncate"
                            [class.font-semibold]="isCurrent(track)"
                            [class.text-ink-subtle]="!canPlay(track)"
                            >{{ track.title }}</span
                          >
                          @if (track.isPreview && !owned()) {
                            <span
                              class="rounded-full border border-line px-2 text-xs"
                              >Preview</span
                            >
                          }
                        </span>
                        <span class="font-mono text-sm text-ink-muted">
                          @if (canPlay(track)) {
                            {{ track.durationMs | duration }}
                          } @else {
                            <span class="group-hover:hidden">{{
                              track.durationMs | duration
                            }}</span>
                            <span
                              class="hidden font-sans text-ink group-hover:inline"
                              >Buy to hear</span
                            >
                          }
                        </span>
                      </button>
                    </li>
                  }
                </ol>
              </section>

              @if (page.release.description; as description) {
                <section
                  class="order-5 flex flex-col gap-3"
                  aria-labelledby="about-heading"
                >
                  <h2
                    id="about-heading"
                    class="text-2xl font-extrabold tracking-[-0.035em]"
                  >
                    About
                  </h2>
                  <p
                    class="max-w-prose text-[17px] leading-relaxed whitespace-pre-line"
                  >
                    {{ description }}
                  </p>
                </section>
              }

              @if (page.release.credits; as credits) {
                <section
                  class="order-6 flex flex-col gap-3"
                  aria-labelledby="credits-heading"
                >
                  <h2
                    id="credits-heading"
                    class="text-2xl font-extrabold tracking-[-0.035em]"
                  >
                    Credits
                  </h2>
                  <p
                    class="max-w-prose font-mono text-sm leading-relaxed whitespace-pre-line"
                  >
                    {{ credits }}
                  </p>
                </section>
              }

              @if (withLyrics().length) {
                <section
                  class="order-7 flex flex-col gap-3"
                  aria-labelledby="lyrics-heading"
                >
                  <h2
                    id="lyrics-heading"
                    class="text-2xl font-extrabold tracking-[-0.035em]"
                  >
                    Lyrics
                  </h2>
                  <div
                    class="flex flex-col divide-y divide-hairline border-y border-hairline"
                  >
                    @for (track of withLyrics(); track track.trackId) {
                      <details class="group">
                        <summary
                          class="flex cursor-pointer list-none items-center gap-3 px-2 py-2.5 hover:bg-wash [&::-webkit-details-marker]:hidden"
                        >
                          <span
                            class="w-8 text-right font-mono text-sm text-ink-muted"
                            >{{ trackNumber(track) }}</span
                          >
                          <span class="font-medium">{{ track.title }}</span>
                          <span
                            class="ml-auto text-lg leading-none text-ink-muted transition-transform group-open:rotate-45"
                            aria-hidden="true"
                            >+</span
                          >
                        </summary>
                        <p
                          class="px-2 pt-1 pb-5 pl-13 leading-relaxed whitespace-pre-line"
                        >
                          {{ track.lyrics }}
                        </p>
                      </details>
                    }
                  </div>
                </section>
              }

              @if (extras().length) {
                <section
                  class="order-8 flex flex-col gap-2"
                  aria-labelledby="extras-heading"
                >
                  <h2
                    id="extras-heading"
                    class="text-2xl font-extrabold tracking-[-0.035em]"
                  >
                    Included
                  </h2>
                  <ul class="flex flex-col divide-y divide-hairline">
                    @for (asset of extras(); track asset.id) {
                      <li
                        class="flex items-center justify-between gap-4 py-2 text-sm"
                      >
                        <span class="min-w-0">
                          <span class="block truncate font-medium">{{
                            asset.title || assetLabel(asset.kind)
                          }}</span>
                          @if (asset.description) {
                            <span class="block text-ink-muted">{{
                              asset.description
                            }}</span>
                          }
                        </span>
                        @if (asset.url) {
                          <a
                            imeButton
                            size="sm"
                            variant="secondary"
                            target="_blank"
                            rel="noopener"
                            [href]="asset.url"
                            >Open</a
                          >
                        } @else {
                          <span class="shrink-0 text-ink-subtle"
                            >For owners</span
                          >
                        }
                      </li>
                    }
                  </ul>
                </section>
              }
            </div>
          </div>

          @if (moreFromArtist().length) {
            <section class="flex flex-col gap-4" aria-labelledby="more-heading">
              <div class="flex items-baseline justify-between gap-4">
                <h2
                  id="more-heading"
                  class="text-2xl font-extrabold tracking-[-0.035em]"
                >
                  More from {{ page.artist.name }}
                </h2>
                <a
                  class="link shrink-0 text-sm"
                  [routerLink]="['/artists', page.artist.handle]"
                  >See all</a
                >
              </div>
              <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                @for (release of moreFromArtist(); track release.id) {
                  <li>
                    <ime-release-card
                      [title]="release.title"
                      [link]="['/artists', page.artist.handle, release.slug]"
                      [coverUrl]="release.coverUrl"
                      [subtitle]="cardSubtitle(release)"
                    />
                  </li>
                }
              </ul>
            </section>
          }

          @if (crates().length) {
            <section
              class="flex flex-col gap-4"
              aria-labelledby="crates-heading"
            >
              <h2
                id="crates-heading"
                class="text-2xl font-extrabold tracking-[-0.035em]"
              >
                In {{ crates().length }}
                {{ crates().length === 1 ? 'crate' : 'crates' }}
              </h2>
              <ul class="grid grid-cols-3 gap-4 sm:grid-cols-6">
                @for (crate of crates(); track crate.id) {
                  <li><ime-crate-card [crate]="crate" /></li>
                }
              </ul>
            </section>
          }
        </article>
      }
    } @else if (page.error(); as error) {
      <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
          {{ isNotFound(error) ? 'Release not found' : 'Something went wrong' }}
        </h1>
        <p class="text-ink-muted">
          {{
            isNotFound(error)
              ? 'It may have been withdrawn, or the address is mistyped.'
              : 'The release could not be loaded. Try again in a moment.'
          }}
        </p>
      </div>
    } @else {
      <ime-spinner />
    }
    @if (viewerPage.error() && page.hasValue()) {
      <ime-alert tone="error"
        >Your copy of this release could not be checked.</ime-alert
      >
    }
  `,
})
export class ReleasePage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);
  private readonly player = inject(PlayerService);
  private readonly meta = inject(PageMetaService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  public readonly handle = input.required<string>();
  public readonly slug = input.required<string>();

  /** The page as anyone sees it, rendered on the server. */
  protected readonly page = resource({
    id: 'release-page',
    params: () => ({ handle: this.handle(), slug: this.slug() }),
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.getReleasePage(params.handle, params.slug)),
  });

  /** The page again as the signed-in viewer, to learn whether they own it. */
  protected readonly viewerPage = resource({
    params: () => {
      const userId = this.session.user()?.id;
      return userId
        ? { handle: this.handle(), slug: this.slug(), userId }
        : undefined;
    },
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.getReleasePage(params.handle, params.slug)),
  });

  /** The design the release renders with, if its managers applied one. */
  private readonly renderResource = resource({
    id: 'release-design-render',
    params: () => currentValue(this.page)?.release.id,
    loader: async ({ params }) =>
      unwrap(await this.api.artistPages.getArtistReleasePageData(params)),
  });
  protected readonly bundleUrl = computed(
    () => currentValue(this.renderResource)?.bundleUrl ?? null,
  );
  protected readonly renderPayload = computed(
    () => currentValue(this.renderResource)?.payload ?? null,
  );

  /** A design asked for IME's buy panel, since buying never happens inside it. */
  protected readonly buyOpen = signal(false);
  private readonly buySection =
    viewChild<ElementRef<HTMLElement>>('buySection');
  private readonly formats = viewChild('formats', { read: ElementRef });

  private readonly editionsResource = resource({
    id: 'release-editions',
    params: () => currentValue(this.page)?.release.id,
    loader: async ({ params }) =>
      unwrap(await this.api.merch.listEditions(params)),
  });
  protected readonly editions = computed(
    () => currentValue(this.editionsResource) ?? [],
  );

  private readonly discography = resource({
    id: 'release-more-from-artist',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.listDiscography(params)),
  });
  protected readonly moreFromArtist = computed(() =>
    (currentValue(this.discography) ?? [])
      .filter((release) => release.slug !== this.slug())
      .slice(0, MORE_FROM_ARTIST),
  );

  private readonly cratesResource = resource({
    id: 'release-crates',
    params: () => currentValue(this.page)?.release.id,
    loader: async ({ params }) =>
      unwrap(
        await this.api.crates.listPublic({
          releaseId: params,
          limit: CRATES_SHOWN,
        }),
      ),
  });
  protected readonly crates = computed(
    () => currentValue(this.cratesResource) ?? [],
  );

  protected readonly withLyrics = computed(
    () => currentValue(this.page)?.tracks.filter((track) => track.lyrics) ?? [],
  );

  private readonly managedArtists = resource({
    params: () => this.session.user()?.id,
    loader: async () => unwrap(await this.api.artists.listMine()),
  });

  protected readonly owned = computed(
    () => currentValue(this.viewerPage)?.owned ?? false,
  );
  protected readonly extras = computed(
    () =>
      (currentValue(this.viewerPage) ?? currentValue(this.page))?.assets.filter(
        (asset) => asset.kind !== 'cover',
      ) ?? [],
  );
  protected readonly managesArtist = computed(() => {
    const artistId = currentValue(this.page)?.artist.id;
    return (
      currentValue(this.managedArtists)?.some(
        (artist) => artist.id === artistId,
      ) ?? false
    );
  });
  protected readonly kindLabel = computed(() => {
    const kind = currentValue(this.page)?.release.kind;
    return kind ? releaseKindLabel(kind) : '';
  });

  protected readonly trackCount = computed(() => {
    const count = currentValue(this.page)?.tracks.length ?? 0;
    return `${count} ${count === 1 ? 'track' : 'tracks'}`;
  });
  /** How long the whole release runs, once every track's length is known. */
  protected readonly runtime = computed(() => {
    const tracks = currentValue(this.page)?.tracks ?? [];
    if (!tracks.length || tracks.some((track) => !track.durationMs))
      return null;
    const minutes = Math.round(
      tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0) / 60000,
    );
    return minutes < 60
      ? `${minutes} min`
      : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
  });

  protected readonly releaseActions = computed<MenuAction[]>(() => [
    { label: 'Report', run: () => this.report() },
  ]);

  /** The tracks this viewer may stream, in running order. */
  protected readonly playable = computed(
    () =>
      currentValue(this.page)?.tracks.filter((track) => this.canPlay(track)) ??
      [],
  );

  protected readonly assetLabel = assetKindLabel;
  protected readonly genreName = genreName;

  /** Where each side after A begins, among the tracks on the release. */
  private readonly sideStarts = computed(() => {
    const page = currentValue(this.page);
    if (!page) return [];
    return page.release.sideStarts.filter(
      (start) => start <= page.tracks.length,
    );
  });

  constructor() {
    effect(() => {
      if (this.isNotFound(this.page.error())) this.meta.notFound();
      const page = currentValue(this.page);
      if (!page) return;
      this.meta.set({
        title: `${page.release.title} by ${page.artist.name}`,
        description: `${releaseKindLabel(page.release.kind)} by ${page.artist.name}, on IME.`,
        image: page.coverUrl,
      });
    });
  }

  /** The side this track opens, when the release has sides. */
  protected opensSide(track: TracklistItem): string | null {
    const starts = this.sideStarts();
    if (track.position !== 1 && !starts.includes(track.position)) return null;
    return sideOf(track.position, starts);
  }

  /** "3." on a release without sides, "B1" on one with them, as on a record. */
  protected trackNumber(track: TracklistItem): string {
    const starts = this.sideStarts();
    const side = sideOf(track.position, starts);
    if (!side) return `${track.position}.`;
    const sideStart = Math.max(
      1,
      ...starts.filter((start) => start <= track.position),
    );
    return `${side}${track.position - sideStart + 1}`;
  }

  protected canPlay(track: TracklistItem): boolean {
    return (
      this.owned() ||
      (track.isPreview && (currentValue(this.page)?.onSale ?? false))
    );
  }

  protected readonly playing = this.player.playing;

  protected isCurrent(track: TracklistItem): boolean {
    return this.player.current()?.trackId === track.trackId;
  }

  /** Bring the ways to get the release into view, for a track it unlocks. */
  protected showFormats(): void {
    this.formats()?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  protected cardSubtitle(release: ReleaseCard): string {
    const year = release.releasedAt?.slice(0, 4);
    return [releaseKindLabel(release.kind), year].filter(Boolean).join(' · ');
  }

  private async report(): Promise<void> {
    const page = currentValue(this.page);
    if (!page) return;
    if (this.session.status() === 'signed-out') {
      await this.router.navigate(['/sign-in'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    await openReport(this.injector, {
      targetType: 'release',
      targetId: page.release.id,
      label: page.release.title,
    });
  }

  protected openBuyPanel(): void {
    this.buyOpen.set(true);
    this.buySection()?.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  /** Play the track a design asked for, when this listener may. */
  protected async playPosition(position: number): Promise<void> {
    const track = currentValue(this.page)?.tracks.find(
      (candidate) => candidate.position === position,
    );
    if (track && this.canPlay(track)) await this.play(track);
  }

  protected isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === HttpStatus.NotFound;
  }

  /**
   * Queue every track this viewer may play, starting from the one chosen.
   */
  protected async play(from?: TracklistItem): Promise<void> {
    const page = currentValue(this.page);
    if (!page) return;
    const queue: QueueTrack[] = this.playable().map((track) => ({
      releaseId: page.release.id,
      trackId: track.trackId,
      title: track.title,
      durationMs: track.durationMs,
      releaseTitle: page.release.title,
      releaseSlug: page.release.slug,
      artistName: page.artist.name,
      artistHandle: page.artist.handle,
      coverUrl: page.coverUrl,
    }));
    const start = from
      ? queue.findIndex((track) => track.trackId === from.trackId)
      : 0;
    await this.player.play(queue, Math.max(start, 0));
  }
}
