import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import {
  PlayerService,
  type QueueTrack,
  SessionService,
  currentValue,
} from '@ime/client-data';
import { ApiError, HttpStatus, type TracklistItem } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  DurationPipe,
  EqualizerComponent,
  SpinnerComponent,
} from '@ime/ui';
import { ArtistPageHost } from '@ime/client-artist-pages';
import { BuyPanel } from '../buying/buy-panel';
import { MerchGrid } from '../merch/merch-grid';
import { ReleaseComments } from '../comments/release-comments';
import { ReportButton } from '../reporting/report-button';
import { PageMetaService } from '../page-meta';
import { assetKindLabel, releaseKindLabel } from './release-labels';

/**
 * A release's page, `/artists/<handle>/<slug>`: the cover and what it costs
 * beside the tracklist, then its extras and comments.
 */
@Component({
  selector: 'ime-release-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ArtistPageHost,
    AlertComponent,
    BuyPanel,
    MerchGrid,
    ButtonDirective,
    CoverComponent,
    DatePipe,
    DurationPipe,
    EqualizerComponent,
    ReleaseComments,
    ReportButton,
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
              <div>
                <button imeButton (click)="openBuyPanel()">
                  {{ page.pricing?.mode === 'free' ? 'Get it free' : 'Buy' }}
                </button>
                <ime-report-button
                  class="ml-2"
                  targetType="release"
                  [targetId]="page.release.id"
                  [label]="page.release.title"
                />
              </div>
            }
          </section>
          <ime-release-comments
            [releaseId]="page.release.id"
            [canModerate]="managesArtist()"
          />
        </div>
      } @else {
        <div
          class="mx-auto grid max-w-5xl gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[auto_1fr]"
        >
          <header class="flex flex-col gap-2 md:col-start-1 md:row-start-1">
            <p class="text-sm text-ink-muted">
              {{ kindLabel() }}
              @if (page.release.releasedAt; as releasedAt) {
                · {{ releasedAt | date: 'longDate' : 'UTC' }}
              }
            </p>
            <h1 class="text-5xl leading-[0.95] font-black tracking-[-0.05em]">
              {{ page.release.title }}
            </h1>
            <p>
              by
              <a
                class="link font-medium"
                [routerLink]="['/artists', page.artist.handle]"
                >{{ page.artist.name }}</a
              >
            </p>
            @if (playable().length) {
              <div class="mt-2">
                <button imeButton (click)="play()">
                  {{ owned() ? 'Play' : 'Play preview' }}
                </button>
              </div>
            }
          </header>
          <aside
            class="flex flex-col gap-4 md:col-start-2 md:row-span-2 md:row-start-1"
          >
            <ime-cover
              class="w-full"
              [src]="page.coverUrl"
              [alt]="'Cover of ' + page.release.title"
            />

            <ime-buy-panel
              [page]="page"
              [owned]="owned()"
              (claimed)="viewerPage.reload()"
            />
            @if (editions().length) {
              <section
                class="flex flex-col gap-3"
                aria-labelledby="editions-heading"
              >
                <h2 id="editions-heading" class="font-semibold">Also on</h2>
                <ime-merch-grid
                  compact
                  [items]="editions()"
                  [handle]="page.artist.handle"
                />
              </section>
            }
            <div>
              <ime-report-button
                targetType="release"
                [targetId]="page.release.id"
                [label]="page.release.title"
              />
            </div>
          </aside>

          <div
            class="flex min-w-0 flex-col gap-8 md:col-start-1 md:row-start-2"
          >
            <section aria-labelledby="tracks-heading">
              <h2 id="tracks-heading" class="sr-only">Tracks</h2>
              <ol class="flex flex-col border-t border-line">
                @for (track of page.tracks; track track.trackId) {
                  <li>
                    <button
                      class="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline px-2 py-2.5 text-left text-[15px] disabled:text-ink-subtle"
                      [class]="
                        isCurrent(track) ? 'bg-marker' : 'enabled:hover:bg-wash'
                      "
                      [disabled]="!canPlay(track)"
                      [attr.aria-current]="isCurrent(track) || null"
                      [attr.aria-label]="
                        canPlay(track)
                          ? 'Play ' + track.title
                          : track.title + ', for owners'
                      "
                      (click)="play(track)"
                    >
                      <span class="text-right font-mono text-sm text-ink-muted">
                        @if (isCurrent(track)) {
                          <ime-equalizer
                            class="text-ink"
                            [playing]="playing()"
                          />
                        } @else {
                          {{ track.position }}.
                        }
                      </span>
                      <span class="flex min-w-0 items-center gap-2">
                        <span
                          class="truncate"
                          [class.font-semibold]="isCurrent(track)"
                          >{{ track.title }}</span
                        >
                        @if (track.isPreview && !owned()) {
                          <span
                            class="rounded-full border border-line px-2 text-xs"
                            >Preview</span
                          >
                        }
                      </span>
                      <span class="font-mono text-sm text-ink-muted">{{
                        track.durationMs | duration
                      }}</span>
                    </button>
                  </li>
                }
              </ol>
            </section>

            @if (extras().length) {
              <section
                class="flex flex-col gap-2"
                aria-labelledby="extras-heading"
              >
                <h2 id="extras-heading" class="text-lg font-semibold">
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
                        <span class="shrink-0 text-ink-subtle">For owners</span>
                      }
                    </li>
                  }
                </ul>
              </section>
            }

            <ime-release-comments
              [releaseId]="page.release.id"
              [canModerate]="managesArtist()"
            />
          </div>
        </div>
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

  private readonly editionsResource = resource({
    id: 'release-editions',
    params: () => currentValue(this.page)?.release.id,
    loader: async ({ params }) =>
      unwrap(await this.api.merch.listEditions(params)),
  });
  protected readonly editions = computed(
    () => currentValue(this.editionsResource) ?? [],
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

  /** The tracks this viewer may stream, in running order. */
  protected readonly playable = computed(
    () =>
      currentValue(this.page)?.tracks.filter((track) => this.canPlay(track)) ??
      [],
  );

  protected readonly assetLabel = assetKindLabel;

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
