import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArtistPageHost } from '@ime/client-artist-pages';
import type {
  ArtistPageRenderResponse,
  DigRecord,
  TracklistItem,
} from '@ime/models';
import { CoverComponent, DurationPipe } from '@ime/ui';
import { releasePriceLabel } from '../releases/release-labels';

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
          <h2
            class="text-3xl leading-[0.95] font-black tracking-[-0.04em] md:text-5xl"
          >
            {{ record().release.title }}
          </h2>
          <p class="text-lg">{{ record().release.artistName }}</p>
          <p class="font-mono text-xs text-canvas/70">
            {{ price() }}
            @if (record().owned) {
              · in your library
            }
          </p>
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
            class="rounded-control border border-canvas/30 px-4 py-2 font-semibold hover:bg-canvas hover:text-ink"
            [routerLink]="[
              '/artists',
              record().release.artistHandle,
              record().release.slug,
            ]"
            target="_blank"
            >Open its page</a
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
