import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import {
  PlayerService,
  type QueueTrack,
  SessionService,
} from '@ime/client-data';
import { ApiError, HttpStatus, type TracklistItem } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  DurationPipe,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';
import { ReleaseComments } from '../comments/release-comments';
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
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    DatePipe,
    DurationPipe,
    MoneyPipe,
    ReleaseComments,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (page.value(); as page) {
      <div
        class="mx-auto grid max-w-5xl gap-8 md:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <aside class="flex flex-col gap-4 md:order-2">
          <ime-cover
            class="w-full"
            [src]="page.coverUrl"
            [alt]="'Cover of ' + page.release.title"
          />

          <div
            class="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
          >
            @if (owned()) {
              <p class="font-medium">In your library</p>
              <p class="text-sm text-ink-muted">
                Stream every track, any time.
              </p>
            } @else if (!page.onSale) {
              <p class="text-sm text-ink-muted">
                Not available to buy right now.
              </p>
            } @else if (page.pricing; as pricing) {
              @switch (pricing.mode) {
                @case ('free') {
                  <p class="font-medium">Free</p>
                }
                @case ('fixed') {
                  <p class="font-medium">
                    {{
                      pricing.minimumPrice | money: pricing.currency ?? 'usd'
                    }}
                    <span class="font-normal text-ink-muted">or more</span>
                  </p>
                }
                @case ('name_your_price') {
                  <p class="font-medium">Name your price</p>
                  @if (pricing.minimumPrice > 0) {
                    <p class="text-sm text-ink-muted">
                      At least
                      {{
                        pricing.minimumPrice | money: pricing.currency ?? 'usd'
                      }}
                    </p>
                  }
                }
              }
              @if (pricing.suggestedPrice; as suggested) {
                <p class="text-sm text-ink-muted">
                  Suggested {{ suggested | money: pricing.currency ?? 'usd' }}
                </p>
              }
            }
          </div>
        </aside>

        <div class="flex min-w-0 flex-col gap-8 md:order-1">
          <header class="flex flex-col gap-2">
            <p class="text-sm text-ink-muted">
              {{ kindLabel() }}
              @if (page.release.releasedAt; as releasedAt) {
                · {{ releasedAt | date: 'longDate' : 'UTC' }}
              }
            </p>
            <h1 class="text-3xl font-semibold tracking-tight">
              {{ page.release.title }}
            </h1>
            <p>
              by
              <a
                class="font-medium hover:underline"
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

          <section aria-labelledby="tracks-heading">
            <h2 id="tracks-heading" class="sr-only">Tracks</h2>
            <ol class="flex flex-col">
              @for (track of page.tracks; track track.trackId) {
                <li>
                  <button
                    class="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-control px-2 py-2 text-left text-sm enabled:hover:bg-surface-muted disabled:text-ink-subtle"
                    [disabled]="!canPlay(track)"
                    [attr.aria-current]="isCurrent(track) || null"
                    [attr.aria-label]="
                      canPlay(track)
                        ? 'Play ' + track.title
                        : track.title + ', for owners'
                    "
                    (click)="play(track)"
                  >
                    <span class="text-right tabular-nums text-ink-subtle">
                      @if (isCurrent(track)) {
                        <span class="text-ink" aria-hidden="true">&#9654;</span>
                      } @else {
                        {{ track.position }}
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
                          class="rounded-full border border-line px-2 text-xs text-ink-muted"
                          >Preview</span
                        >
                      }
                    </span>
                    <span class="tabular-nums text-ink-subtle">{{
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
              <ul class="flex flex-col divide-y divide-line">
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
    } @else if (page.error(); as error) {
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">
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
    @if (viewerPage.error()) {
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

  private readonly managedArtists = resource({
    params: () => this.session.user()?.id,
    loader: async () => unwrap(await this.api.artists.listMine()),
  });

  protected readonly owned = computed(
    () => this.viewerPage.value()?.owned ?? false,
  );
  protected readonly extras = computed(
    () =>
      (this.viewerPage.value() ?? this.page.value())?.assets.filter(
        (asset) => asset.kind !== 'cover',
      ) ?? [],
  );
  protected readonly managesArtist = computed(() => {
    const artistId = this.page.value()?.artist.id;
    return (
      this.managedArtists.value()?.some((artist) => artist.id === artistId) ??
      false
    );
  });
  protected readonly kindLabel = computed(() => {
    const kind = this.page.value()?.release.kind;
    return kind ? releaseKindLabel(kind) : '';
  });

  /** The tracks this viewer may stream, in running order. */
  protected readonly playable = computed(
    () =>
      this.page.value()?.tracks.filter((track) => this.canPlay(track)) ?? [],
  );

  protected readonly assetLabel = assetKindLabel;

  constructor() {
    effect(() => {
      if (this.isNotFound(this.page.error())) this.meta.notFound();
      const page = this.page.value();
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
      this.owned() || (track.isPreview && (this.page.value()?.onSale ?? false))
    );
  }

  protected isCurrent(track: TracklistItem): boolean {
    return this.player.current()?.trackId === track.trackId;
  }

  protected isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === HttpStatus.NotFound;
  }

  /**
   * Queue every track this viewer may play, starting from the one chosen.
   */
  protected async play(from?: TracklistItem): Promise<void> {
    const page = this.page.value();
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
