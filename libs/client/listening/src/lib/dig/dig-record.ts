import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { ArtistPageHost } from '@ime/client-artist-pages';
import {
  type ArtistPageRenderResponse,
  type DigRecord,
  genreName,
  placeLabel,
  type TracklistItem,
} from '@ime/models';
import { CoverComponent, DurationPipe } from '@ime/ui';
import {
  assetKindLabel,
  releaseKindLabel,
  releasePriceLabel,
} from '../releases/release-labels';

/** Extras shown as pictures rather than links. */
const PICTURES = new Set(['back_cover', 'photo']);

/**
 * One record in the dig booth: its cover, or its designed page with the
 * controls docked below; why it is in the crate; its whole tracklist with the
 * tracks the artist shares; and the scrub bar for the one playing.
 */
@Component({
  selector: 'ime-dig-record',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ArtistPageHost, CoverComponent, DurationPipe, RouterLink],
  template: `
    <article
      class="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start"
      [attr.aria-label]="record().release.title"
    >
      <div class="flex flex-col gap-2">
        @if (design(); as design) {
          @if (design.bundleUrl) {
            <div
              class="max-h-[60vh] overflow-y-auto rounded-card bg-canvas [scrollbar-width:thin]"
            >
              <ime-artist-page-host
                [bundleUrl]="design.bundleUrl"
                [payload]="design.payload"
                (playRequested)="playPosition.emit($event)"
                (purchaseRequested)="buy.emit()"
              />
            </div>
          }
        } @else {
          <ime-cover
            class="aspect-square w-full max-w-[min(26rem,55vh)] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            [src]="record().release.coverUrl"
            [alt]="'Cover of ' + record().release.title"
          />
        }
        @if (record().designed) {
          <button
            class="w-fit font-mono text-xs text-canvas/70 underline underline-offset-2 hover:text-canvas"
            (click)="toggleDesign.emit()"
          >
            {{ design() ? 'Show the cover' : 'Show its designed page' }}
          </button>
        }
      </div>

      <div class="flex min-w-0 flex-col gap-4">
        <div class="flex flex-col gap-1">
          <p class="font-mono text-xs tracking-wider text-canvas/60 uppercase">
            {{ kindAndYear() }}
          </p>
          <h2
            class="text-3xl leading-[0.95] font-black tracking-[-0.04em] md:text-5xl"
          >
            {{ record().release.title }}
          </h2>
          <p class="text-lg">
            <a
              class="underline-offset-2 hover:underline"
              target="_blank"
              [routerLink]="['/artists', record().release.artistHandle]"
              >{{ record().release.artistName }}</a
            >
            @if (place(); as place) {
              <span class="text-base text-canvas/60">, {{ place }}</span>
            }
          </p>
          <p class="font-mono text-xs text-canvas/70">
            {{ price() }}{{ record().owned ? ', in your library' : '' }}
          </p>
          @if (genres().length) {
            <ul class="mt-1 flex flex-wrap gap-1.5" aria-label="Genres">
              @for (genre of genres(); track genre) {
                <li
                  class="rounded-full border border-canvas/30 px-2.5 py-0.5 text-xs"
                >
                  {{ genreName(genre) }}
                </li>
              }
            </ul>
          }
          @if (record().note; as note) {
            <p class="mt-2 max-w-prose text-lg italic">“{{ note }}”</p>
          }
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            class="rounded-control px-4 py-2 font-bold"
            [class]="
              kept()
                ? 'bg-marker text-ink'
                : 'border border-canvas/60 hover:bg-canvas hover:text-ink'
            "
            [attr.aria-pressed]="kept()"
            (click)="keep.emit()"
          >
            {{ kept() ? 'Kept' : 'Keep' }}
            <span class="ml-1 hidden font-mono text-xs opacity-70 lg:inline"
              >K</span
            >
          </button>
          <a
            class="flex size-10 items-center justify-center rounded-control border border-canvas/30 text-lg hover:bg-canvas hover:text-ink"
            aria-label="Open its page in a new tab"
            title="Open its page in a new tab"
            [routerLink]="[
              '/artists',
              record().release.artistHandle,
              record().release.slug,
            ]"
            target="_blank"
            >↗</a
          >
        </div>

        <ol class="flex flex-col border-t border-canvas/15">
          @for (track of record().tracks; track track.trackId) {
            <li>
              <button
                class="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-canvas/10 px-2 py-2 text-left disabled:cursor-default"
                [class]="
                  isCurrent(track)
                    ? 'bg-marker text-ink'
                    : canPlay(track)
                      ? 'hover:bg-canvas/10'
                      : 'text-canvas/40'
                "
                [disabled]="!canPlay(track)"
                [attr.aria-current]="isCurrent(track) || null"
                (click)="playTrack.emit(track)"
              >
                <span class="text-right font-mono text-sm">{{
                  track.position
                }}</span>
                <span class="truncate">{{ track.title }}</span>
                <span class="font-mono text-xs">{{
                  track.durationMs | duration
                }}</span>
              </button>
            </li>
          }
        </ol>
        <p class="font-mono text-xs text-canvas/70">{{ sharing() }}</p>

        @if (page()?.release?.description; as description) {
          <p
            class="max-w-prose leading-relaxed whitespace-pre-line text-canvas/85"
          >
            {{ description }}
          </p>
        }

        @if (pictures().length || documents().length) {
          <section class="flex flex-col gap-2" aria-label="Also inside">
            @if (pictures().length) {
              <ul class="flex flex-wrap gap-2">
                @for (asset of pictures(); track asset.id) {
                  <li>
                    <a
                      class="block w-24"
                      target="_blank"
                      rel="noopener"
                      [href]="asset.url"
                      [attr.aria-label]="asset.title || assetLabel(asset.kind)"
                    >
                      <ime-cover
                        class="w-full"
                        [src]="asset.url"
                        [alt]="asset.title || assetLabel(asset.kind)"
                      />
                    </a>
                  </li>
                }
              </ul>
            }
            @for (asset of documents(); track asset.id) {
              <a
                class="w-fit text-sm underline underline-offset-2"
                target="_blank"
                rel="noopener"
                [href]="asset.url"
                >{{ asset.title || assetLabel(asset.kind) }} ↗</a
              >
            }
          </section>
        }

        @if (ranOut()) {
          <div
            class="flex flex-col gap-2 rounded-card border border-marker p-4"
            role="status"
          >
            <p class="font-semibold">{{ ranOutText() }}</p>
            <div class="flex flex-wrap gap-2">
              @if (!kept()) {
                <button
                  class="rounded-control bg-marker px-3 py-1.5 font-bold text-ink"
                  (click)="keep.emit()"
                >
                  Keep it for later
                </button>
              }
              <button
                class="rounded-control border border-canvas/60 px-3 py-1.5 font-semibold hover:bg-canvas hover:text-ink"
                (click)="buy.emit()"
              >
                Buy it
              </button>
            </div>
          </div>
        }
      </div>
    </article>
  `,
})
export class DigRecordView {
  private readonly api = inject(ApiClient);

  public readonly record = input.required<DigRecord>();
  public readonly kept = input(false);
  /** The track playing or paused from this record, if any. */
  public readonly currentTrackId = input<string | null>(null);
  /** The listener reached the end of the last track they may hear. */
  public readonly ranOut = input(false);
  /** The designed page to show instead of the cover, once loaded. */
  public readonly design = input<ArtistPageRenderResponse | null>(null);

  public readonly keep = output<void>();
  public readonly buy = output<void>();
  public readonly playTrack = output<TracklistItem>();
  public readonly playPosition = output<number>();
  public readonly toggleDesign = output<void>();

  protected readonly genreName = genreName;
  protected readonly assetLabel = assetKindLabel;

  /** The record's page and its artist, for the rest of what it is. */
  private readonly pageResource = resource({
    params: () => ({
      handle: this.record().release.artistHandle,
      slug: this.record().release.slug,
    }),
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.getReleasePage(params.handle, params.slug)),
  });
  protected readonly page = computed(() => currentValue(this.pageResource));
  private readonly artistResource = resource({
    params: () => this.record().release.artistHandle,
    loader: async ({ params }) =>
      unwrap(await this.api.artists.getProfile(params)),
  });

  protected readonly kindAndYear = computed(() => {
    const release = this.record().release;
    return [releaseKindLabel(release.kind), release.releasedAt?.slice(0, 4)]
      .filter(Boolean)
      .join(' / ');
  });
  protected readonly place = computed(() => {
    const artist = currentValue(this.artistResource)?.artist;
    return artist ? placeLabel(artist.city, artist.country) : '';
  });
  protected readonly genres = computed(() => this.page()?.release.genres ?? []);
  /** What else comes with the record that anyone can open. */
  private readonly extras = computed(() =>
    (this.page()?.assets ?? []).filter(
      (asset) => asset.kind !== 'cover' && asset.url,
    ),
  );
  protected readonly pictures = computed(() =>
    this.extras().filter((asset) => PICTURES.has(asset.kind)),
  );
  protected readonly documents = computed(() =>
    this.extras().filter((asset) => !PICTURES.has(asset.kind)),
  );

  /** The tracks the artist shares, or every track once the listener owns it. */
  protected readonly playable = computed(() =>
    this.record().tracks.filter((track) => this.canPlay(track)),
  );

  protected readonly price = computed(() =>
    releasePriceLabel(this.record().pricing),
  );

  protected readonly sharing = computed(() => {
    const total = this.record().tracks.length;
    const shared = this.playable().length;
    if (this.record().owned) return `All ${total} tracks are yours to hear.`;
    if (!shared) {
      return `The artist shares no tracks before you get it. ${total} on the record.`;
    }
    return `The artist shares ${shared} of ${total} tracks, in full.`;
  });

  protected readonly ranOutText = computed(() => {
    const more = this.record().tracks.length - this.playable().length;
    return more > 0
      ? `That's all the artist shares. ${more} more ${more === 1 ? 'track is' : 'tracks are'} on the record.`
      : "That's the whole record.";
  });

  protected canPlay(track: TracklistItem): boolean {
    return this.record().owned || track.isPreview;
  }

  protected isCurrent(track: TracklistItem): boolean {
    return this.currentTrackId() === track.trackId;
  }
}
