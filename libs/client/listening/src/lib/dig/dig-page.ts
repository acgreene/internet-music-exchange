import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { PlayerService, type QueueTrack, currentValue } from '@ime/client-data';
import {
  type ArtistPageRenderResponse,
  type DigRecord,
  type TracklistItem,
} from '@ime/models';
import { CoverComponent, DurationPipe, SpinnerComponent } from '@ime/ui';
import { PageMetaService } from '../page-meta';
import { DigEnd } from './dig-end';
import { DigRecordView } from './dig-record';

type Phase = 'digging' | 'end';

/** How far a finger must travel to count as a swipe, in pixels. */
const SWIPE_PX = 48;
/** A track counts as finished this close to its end. */
const END_SLACK_MS = 1500;

/**
 * Dig mode, `/dig/crates/<id>` or `/dig/sound?genre=`: a whole crate one
 * record at a time, starting at once, then the bottom of the crate.
 * Up and down move between records and left and right between the tracks
 * the artist shares, by keyboard or by swiping. Nothing plays until the
 * listener presses play.
 */
@Component({
  selector: 'ime-dig-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CoverComponent,
    DigEnd,
    DigRecordView,
    DurationPipe,
    RouterLink,
    SpinnerComponent,
  ],
  host: {
    class:
      'fixed inset-0 z-40 flex flex-col bg-ink text-canvas [color-scheme:dark]',
    '(document:keydown)': 'key($event)',
  },
  template: `
    <header
      class="flex items-center gap-4 border-b border-canvas/15 px-4 py-3 md:px-8"
    >
      <a class="text-sm underline underline-offset-2" [routerLink]="leaveLink()"
        >Leave</a
      >
      <span class="min-w-0 flex-1 truncate font-semibold">{{
        dig()?.name ?? 'Dig'
      }}</span>
      @if (phase() === 'digging') {
        <span class="font-mono text-xs" aria-live="polite"
          >{{ index() + 1 }} / {{ records().length }}</span
        >
        <button
          class="rounded-control border border-canvas/30 px-2.5 py-1 text-xs font-semibold hover:bg-canvas hover:text-ink"
          (click)="finish()"
        >
          Finish ({{ bag().length }} kept)
        </button>
      }
    </header>

    @if (dig(); as dig) {
      @switch (phase()) {
        @case ('digging') {
          <div class="flex min-h-0 flex-1">
            <nav
              class="hidden w-64 shrink-0 overflow-y-auto border-r border-canvas/15 lg:block"
              aria-label="Records in this dig"
            >
              <ol>
                @for (
                  record of records();
                  track record.release.id;
                  let i = $index
                ) {
                  <li>
                    <button
                      class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm"
                      [class]="
                        i === index() ? 'bg-canvas/15' : 'hover:bg-canvas/5'
                      "
                      [attr.aria-current]="i === index() || null"
                      (click)="goTo(i)"
                    >
                      <ime-cover
                        class="size-9 shrink-0"
                        [src]="record.release.coverUrl"
                        alt=""
                      />
                      <span class="flex min-w-0 flex-col">
                        <span class="truncate font-semibold">{{
                          record.release.title
                        }}</span>
                        <span class="truncate text-xs text-canvas/60">{{
                          record.release.artistName
                        }}</span>
                      </span>
                      @if (isKept(record)) {
                        <span class="ml-auto text-marker" aria-label="kept"
                          >●</span
                        >
                      }
                    </button>
                  </li>
                }
              </ol>
            </nav>

            <main
              class="flex min-w-0 flex-1 touch-pan-y flex-col overflow-y-auto px-4 py-6 md:px-8"
              (touchstart)="swipeStart($event)"
              (touchend)="swipeEnd($event)"
            >
              @if (current(); as record) {
                <ime-dig-record
                  [record]="record"
                  [kept]="isKept(record)"
                  [currentTrackId]="currentTrackId()"
                  [ranOut]="ranOut()"
                  [design]="showDesign() ? design() : null"
                  (keep)="keep()"
                  (buy)="buyCurrent()"
                  (playTrack)="playTrack($event)"
                  (playPosition)="playPosition($event)"
                  (toggleDesign)="designOff.set(!designOff())"
                />
              }
            </main>
          </div>

          <footer
            class="flex flex-col gap-2 border-t border-canvas/15 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8"
          >
            @if (currentTrackId()) {
              <div class="flex items-center gap-3 font-mono text-xs">
                <span>{{ player.elapsedMs() | duration }}</span>
                <input
                  type="range"
                  class="flex-1 accent-marker"
                  aria-label="Position in the track"
                  min="0"
                  [max]="player.durationMs() || 1"
                  [value]="player.elapsedMs()"
                  (input)="player.seek(+$any($event.target).value)"
                />
                <span>{{ player.durationMs() | duration }}</span>
              </div>
            }
            <div class="flex items-center justify-between gap-2">
              <button
                class="rounded-control px-3 py-2 hover:bg-canvas/10 disabled:opacity-30"
                aria-label="Previous record"
                [disabled]="index() === 0"
                (click)="move(-1)"
              >
                ↑<span class="hidden sm:inline"> Record</span>
              </button>
              <div class="flex items-center gap-1">
                <button
                  class="rounded-control px-3 py-2 hover:bg-canvas/10 disabled:opacity-30"
                  aria-label="Previous track"
                  [disabled]="!shared().length"
                  (click)="step(-1)"
                >
                  ←
                </button>
                <button
                  class="min-w-24 rounded-control bg-canvas px-4 py-2 font-bold text-ink disabled:opacity-30"
                  [disabled]="!shared().length"
                  (click)="togglePlay()"
                >
                  {{ playingHere() ? 'Pause' : 'Play' }}
                </button>
                <button
                  class="rounded-control px-3 py-2 hover:bg-canvas/10 disabled:opacity-30"
                  aria-label="Next track"
                  [disabled]="!shared().length"
                  (click)="step(1)"
                >
                  →
                </button>
              </div>
              <button
                class="rounded-control px-3 py-2 hover:bg-canvas/10"
                aria-label="Next record"
                (click)="move(1)"
              >
                @if (index() === records().length - 1) {
                  Finish
                } @else {
                  <span class="hidden sm:inline">Record </span>↓
                }
              </button>
            </div>
          </footer>
        }
        @case ('end') {
          <div class="flex-1 overflow-y-auto px-4 py-10 md:px-8">
            <ime-dig-end
              [bag]="bag()"
              [dug]="reached()"
              [listenedMs]="listenedMs()"
              [crateName]="dig.name"
              [leaveLink]="leaveLink()"
            />
          </div>
        }
      }
    } @else if (session.error()) {
      <div
        class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <p class="text-xl font-bold">This crate can't be dug.</p>
        <p class="text-canvas/70">It may be private, or empty.</p>
        <a class="underline" routerLink="/crates">Back to crates</a>
      </div>
    } @else {
      <div class="flex flex-1 items-center justify-center"><ime-spinner /></div>
    }
  `,
})
export class DigPage {
  private readonly api = inject(ApiClient);
  private readonly meta = inject(PageMetaService);
  protected readonly player = inject(PlayerService);

  /** The `crateId` route parameter, when digging a crate someone made. */
  public readonly crateId = input<string>();
  /** `?genre=` or `?tag=`, when digging a crate by sound. */
  public readonly genre = input<string>();
  public readonly tag = input<string>();

  /** The whole crate, to dig from the top. */
  protected readonly session = resource({
    params: () => ({
      crateId: this.crateId(),
      genre: this.genre(),
      tag: this.tag(),
    }),
    loader: async ({ params }) =>
      unwrap(
        params.crateId
          ? await this.api.crates.digCrate(params.crateId)
          : await this.api.crates.digSound({
              genre: params.genre,
              tag: params.tag,
            }),
      ),
  });
  protected readonly dig = computed(() => currentValue(this.session));

  protected readonly phase = signal<Phase>('digging');
  protected readonly index = signal(0);
  /** How far into the crate the listener got. */
  protected readonly reached = signal(1);
  protected readonly bag = signal<DigRecord[]>([]);
  protected readonly listenedMs = signal(0);
  /** The listener chose the cover over a record's designed page. */
  protected readonly designOff = signal(false);

  protected readonly records = computed(() => this.dig()?.records ?? []);
  protected readonly current = computed(
    () => this.records()[this.index()] ?? null,
  );
  protected readonly leaveLink = computed(() =>
    this.crateId() ? ['/crates', this.crateId() as string] : ['/crates'],
  );

  /** The tracks the listener may hear on this record, in running order. */
  protected readonly shared = computed(() => {
    const record = this.current();
    if (!record) return [];
    return record.tracks.filter((track) => record.owned || track.isPreview);
  });

  /** The track playing or paused, if it is from this record. */
  protected readonly currentTrackId = computed(() => {
    const track = this.player.current();
    return track && track.releaseId === this.current()?.release.id
      ? track.trackId
      : null;
  });
  protected readonly playingHere = computed(
    () => !!this.currentTrackId() && this.player.playing(),
  );

  /** The last track the listener may hear has played to its end. */
  protected readonly ranOut = computed(() => {
    const shared = this.shared();
    const last = shared[shared.length - 1];
    return (
      !!last &&
      this.currentTrackId() === last.trackId &&
      !this.player.playing() &&
      this.player.durationMs() > 0 &&
      this.player.elapsedMs() >= this.player.durationMs() - END_SLACK_MS
    );
  });

  private readonly designs = signal(
    new Map<string, ArtistPageRenderResponse>(),
  );
  protected readonly design = computed(() => {
    const id = this.current()?.release.id;
    return id ? (this.designs().get(id) ?? null) : null;
  });
  protected readonly showDesign = computed(
    () => !!this.current()?.designed && !this.designOff(),
  );

  private swipeFrom: { x: number; y: number } | null = null;

  constructor() {
    effect(() => {
      const dig = this.dig();
      if (!dig) return;
      this.meta.set({
        title: `Digging ${dig.name}`,
        description:
          dig.reason ?? `Dig through ${dig.available} records on IME.`,
      });
    });

    // count only time actually spent listening in this dig
    let last = 0;
    effect(() => {
      const elapsed = this.player.elapsedMs();
      const listening = this.player.playing() && this.phase() === 'digging';
      const gained = elapsed - last;
      last = elapsed;
      if (listening && gained > 0 && gained < 2000) {
        untracked(() => this.listenedMs.update((ms) => ms + gained));
      }
    });

    // a designed record's page loads when it comes up
    effect(() => {
      const record = this.current();
      if (!record?.designed || !this.showDesign()) return;
      const id = record.release.id;
      if (untracked(this.designs).has(id)) return;
      void this.api.artistPages.getArtistReleasePageData(id).then((result) => {
        if (result.ok) {
          this.designs.update((designs) =>
            new Map(designs).set(id, result.data),
          );
        }
      });
    });
  }

  protected finish(): void {
    if (this.playingHere()) void this.player.toggle();
    this.phase.set('end');
  }

  protected goTo(index: number): void {
    const wasPlaying = this.playingHere();
    this.index.set(index);
    this.reached.update((reached) => Math.max(reached, index + 1));
    this.designOff.set(false);
    // flipping keeps the music going if it was, starting the next record
    if (wasPlaying) {
      if (this.shared().length) void this.playAt(0);
      else void this.player.toggle();
    }
  }

  protected move(by: -1 | 1): void {
    const next = this.index() + by;
    if (next < 0) return;
    if (next >= this.records().length) {
      this.finish();
      return;
    }
    this.goTo(next);
  }

  protected step(by: -1 | 1): void {
    const shared = this.shared();
    if (!shared.length) return;
    const playing = shared.findIndex(
      (track) => track.trackId === this.currentTrackId(),
    );
    const next = Math.min(Math.max(playing + by, 0), shared.length - 1);
    void this.playAt(playing < 0 ? 0 : next);
  }

  protected togglePlay(): void {
    if (this.currentTrackId()) void this.player.toggle();
    else void this.playAt(0);
  }

  protected playTrack(track: TracklistItem): void {
    const at = this.shared().findIndex((t) => t.trackId === track.trackId);
    if (at >= 0) void this.playAt(at);
  }

  /** A designed page asked to play a track by its place on the record. */
  protected playPosition(position: number): void {
    const at = this.shared().findIndex((t) => t.position === position);
    if (at >= 0) void this.playAt(at);
  }

  protected isKept(record: DigRecord): boolean {
    return this.bag().some((kept) => kept.release.id === record.release.id);
  }

  protected keep(): void {
    const record = this.current();
    if (!record) return;
    this.bag.update((bag) =>
      this.isKept(record)
        ? bag.filter((kept) => kept.release.id !== record.release.id)
        : [...bag, record],
    );
  }

  /** Buying from a record keeps it, and the bag is bought at the end. */
  protected buyCurrent(): void {
    const record = this.current();
    if (record && !this.isKept(record)) this.keep();
    this.finish();
  }

  protected key(event: KeyboardEvent): void {
    if (this.phase() !== 'digging') return;
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    const actions: Record<string, () => void> = {
      ArrowDown: () => this.move(1),
      ArrowUp: () => this.move(-1),
      ArrowRight: () => this.step(1),
      ArrowLeft: () => this.step(-1),
      ' ': () => this.togglePlay(),
      k: () => this.keep(),
      K: () => this.keep(),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  protected swipeStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    this.swipeFrom = { x: touch.clientX, y: touch.clientY };
  }

  /**
   * Left and right change tracks. Up and down change records once the
   * record is scrolled to that edge, so a long tracklist still scrolls.
   */
  protected swipeEnd(event: TouchEvent): void {
    const from = this.swipeFrom;
    this.swipeFrom = null;
    const touch = event.changedTouches[0];
    if (!from || !touch) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.step(dx < 0 ? 1 : -1);
      return;
    }
    const area = event.currentTarget as HTMLElement;
    const atTop = area.scrollTop <= 0;
    const atBottom =
      area.scrollTop + area.clientHeight >= area.scrollHeight - 2;
    if (dy < 0 && atBottom) this.move(1);
    else if (dy > 0 && atTop) this.move(-1);
  }

  private async playAt(index: number): Promise<void> {
    const record = this.current();
    if (!record) return;
    const queue: QueueTrack[] = this.shared().map((track) => ({
      releaseId: record.release.id,
      trackId: track.trackId,
      title: track.title,
      durationMs: track.durationMs,
      releaseTitle: record.release.title,
      releaseSlug: record.release.slug,
      artistName: record.release.artistName,
      artistHandle: record.release.artistHandle,
      coverUrl: record.release.coverUrl,
    }));
    await this.player.play(queue, index);
  }
}
