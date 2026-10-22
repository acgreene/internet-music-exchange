import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiClient } from '@ime/api-client';

/**
 * A track in the queue, with what the player bar shows beside it.
 */
export interface QueueTrack {
  releaseId: string;
  trackId: string;
  title: string;
  durationMs: number | null;
  releaseTitle: string;
  releaseSlug: string;
  artistName: string;
  artistHandle: string;
  coverUrl: string | null;
}

/** Going back this far into a track restarts it rather than going back. */
const RESTART_THRESHOLD_MS = 3000;

/**
 * The one player behind the player bar, kept across pages. Each track's
 * stream link is fetched just before it plays, since the links expire.
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly api = inject(ApiClient);
  private readonly audio = isPlatformBrowser(inject(PLATFORM_ID))
    ? new Audio()
    : null;

  private readonly tracks = signal<QueueTrack[]>([]);
  private readonly index = signal(-1);
  private readonly isPlaying = signal(false);
  private readonly isLoading = signal(false);
  private readonly elapsed = signal(0);
  private readonly duration = signal(0);
  private readonly failure = signal<string | null>(null);
  /** Bumped on every load, so a slow link fetch cannot replace a newer one. */
  private loads = 0;

  public readonly queue = this.tracks.asReadonly();
  public readonly queueIndex = this.index.asReadonly();
  public readonly current = computed(() => this.tracks()[this.index()] ?? null);
  public readonly playing = this.isPlaying.asReadonly();
  public readonly loading = this.isLoading.asReadonly();
  public readonly elapsedMs = this.elapsed.asReadonly();
  /** The track's length, from the audio once known, else from the catalog. */
  public readonly durationMs = computed(
    () => this.duration() || this.current()?.durationMs || 0,
  );
  public readonly error = this.failure.asReadonly();
  public readonly hasNext = computed(
    () => this.index() < this.tracks().length - 1,
  );
  public readonly volume = signal(1);

  constructor() {
    const audio = this.audio;
    if (!audio) return;

    const listeners: [string, () => void][] = [
      ['play', () => this.isPlaying.set(true)],
      ['pause', () => this.isPlaying.set(false)],
      ['waiting', () => this.isLoading.set(true)],
      ['playing', () => this.isLoading.set(false)],
      ['timeupdate', () => this.elapsed.set(audio.currentTime * 1000)],
      [
        'durationchange',
        () =>
          this.duration.set(
            Number.isFinite(audio.duration) ? audio.duration * 1000 : 0,
          ),
      ],
      ['ended', () => (this.hasNext() ? void this.next() : this.stop())],
      [
        'error',
        () => {
          if (!audio.getAttribute('src')) return;
          this.isLoading.set(false);
          this.failure.set('This track could not be played.');
        },
      ],
    ];
    for (const [event, listener] of listeners) {
      audio.addEventListener(event, listener);
    }
    inject(DestroyRef).onDestroy(() => {
      for (const [event, listener] of listeners) {
        audio.removeEventListener(event, listener);
      }
      audio.pause();
    });

    effect(() => (audio.volume = this.volume()));
    this.connectMediaSession();
  }

  /**
   * Replace the queue with these tracks and play from one of them.
   */
  public async play(tracks: QueueTrack[], startAt = 0): Promise<void> {
    this.tracks.set(tracks);
    await this.playAt(startAt);
  }

  /**
   * Play the queue's track at this index.
   */
  public async playAt(index: number): Promise<void> {
    if (index < 0 || index >= this.tracks().length) return;
    this.index.set(index);
    await this.load();
  }

  public async toggle(): Promise<void> {
    const audio = this.audio;
    if (!audio || !this.current()) return;
    if (!audio.getAttribute('src')) {
      await this.load();
    } else if (audio.paused) {
      await this.resume();
    } else {
      audio.pause();
    }
  }

  public async next(): Promise<void> {
    if (this.hasNext()) await this.playAt(this.index() + 1);
  }

  /**
   * Back to the start of the track, or to the one before when already near
   * its start.
   */
  public async previous(): Promise<void> {
    if (this.elapsed() > RESTART_THRESHOLD_MS || this.index() === 0) {
      this.seek(0);
      return;
    }
    await this.playAt(this.index() - 1);
  }

  public seek(ms: number): void {
    if (!this.audio) return;
    this.audio.currentTime = ms / 1000;
    this.elapsed.set(ms);
  }

  private stop(): void {
    this.audio?.pause();
    this.seek(0);
  }

  private async load(): Promise<void> {
    const audio = this.audio;
    const track = this.current();
    if (!audio || !track) return;

    const load = ++this.loads;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    this.failure.set(null);
    this.isLoading.set(true);
    this.elapsed.set(0);
    this.duration.set(0);

    const result = await this.api.catalog.getStreamUrl(
      track.releaseId,
      track.trackId,
    );
    if (load !== this.loads) return;
    if (!result.ok) {
      this.isLoading.set(false);
      this.failure.set(result.error.message);
      return;
    }
    audio.src = result.data.url;
    await this.resume();
  }

  private async resume(): Promise<void> {
    try {
      await this.audio?.play();
    } catch (error) {
      // a newer load interrupting this one is expected, anything else is not
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.isLoading.set(false);
      this.failure.set('Playback was blocked. Press play to start.');
    }
  }

  /**
   * Show the track on the lock screen and media keys, and take their
   * controls.
   */
  private connectMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;

    session.setActionHandler('play', () => void this.toggle());
    session.setActionHandler('pause', () => this.audio?.pause());
    session.setActionHandler('previoustrack', () => void this.previous());
    session.setActionHandler('nexttrack', () => void this.next());
    session.setActionHandler('seekto', ({ seekTime }) => {
      if (seekTime !== undefined) this.seek(seekTime * 1000);
    });

    effect(() => {
      const track = this.current();
      session.metadata = track
        ? new MediaMetadata({
            title: track.title,
            artist: track.artistName,
            album: track.releaseTitle,
            artwork: track.coverUrl ? [{ src: track.coverUrl }] : [],
          })
        : null;
    });
    effect(() => {
      session.playbackState = this.isPlaying() ? 'playing' : 'paused';
    });
  }
}
