import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerService } from '@ime/client-data';
import { CoverComponent, DurationPipe } from '@ime/ui';

/**
 * The player docked at the bottom of every page once something is playing:
 * the track, its controls, and the queue.
 */
@Component({
  selector: 'ime-player-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent, DurationPipe, RouterLink],
  host: { class: 'relative block' },
  template: `
    @if (player.current(); as track) {
      @if (showQueue()) {
        <section
          class="absolute right-2 bottom-full mb-2 max-h-96 w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-card border border-line bg-surface p-2 shadow-[4px_4px_0_var(--color-ink)]"
          aria-label="Queue"
        >
          <h2 class="px-2 py-1 text-sm font-semibold">Queue</h2>
          <ol>
            @for (
              item of player.queue();
              track item.trackId;
              let index = $index
            ) {
              <li>
                <button
                  class="flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left text-sm hover:bg-wash"
                  [class.font-semibold]="index === player.queueIndex()"
                  [attr.aria-current]="index === player.queueIndex() || null"
                  (click)="player.playAt(index)"
                >
                  <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
                  <span class="font-mono text-xs text-ink-muted">{{
                    item.durationMs | duration
                  }}</span>
                </button>
              </li>
            }
          </ol>
        </section>
      }

      <div class="flex items-center gap-3 px-3 py-3 md:gap-6 md:px-6 md:py-4">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <ime-cover
            class="w-14 shrink-0 border border-line"
            [src]="track.coverUrl"
            [alt]="'Cover of ' + track.releaseTitle"
          />
          <div class="min-w-0">
            <a
              class="block truncate text-[15px] font-semibold hover:underline"
              [routerLink]="['/artists', track.artistHandle, track.releaseSlug]"
              >{{ track.title }}</a
            >
            <a
              class="block truncate text-sm text-ink-muted hover:underline"
              [routerLink]="['/artists', track.artistHandle]"
              >{{ track.artistName }}</a
            >
          </div>
        </div>

        <div class="flex flex-col items-center gap-1 md:flex-[2]">
          <div class="flex items-center gap-2">
            <button
              class="hidden rounded-full p-2 hover:bg-surface md:block"
              aria-label="Previous"
              (click)="player.previous()"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-5 fill-current"
                aria-hidden="true"
              >
                <path d="M6 5h2v14H6zM20 5v14L9 12z" />
              </svg>
            </button>
            <button
              class="rounded-full bg-accent p-3 text-accent-ink transition-colors duration-100 hover:bg-ink"
              [attr.aria-label]="player.playing() ? 'Pause' : 'Play'"
              [attr.aria-busy]="player.loading() || null"
              (click)="player.toggle()"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-5 fill-current"
                aria-hidden="true"
              >
                @if (player.playing()) {
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                } @else {
                  <path d="M7 5v14l12-7z" />
                }
              </svg>
            </button>
            <button
              class="rounded-full p-2 hover:bg-surface disabled:opacity-40"
              aria-label="Next"
              [disabled]="!player.hasNext()"
              (click)="player.next()"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-5 fill-current"
                aria-hidden="true"
              >
                <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
              </svg>
            </button>
          </div>
          <div
            class="hidden w-full items-center gap-3 font-mono text-xs text-ink-muted md:flex"
          >
            <span class="w-10 text-right tabular-nums">{{
              player.elapsedMs() | duration
            }}</span>
            <input
              type="range"
              class="h-1 flex-1 accent-accent"
              aria-label="Seek"
              min="0"
              [max]="player.durationMs()"
              [value]="player.elapsedMs()"
              [attr.aria-valuetext]="player.elapsedMs() | duration"
              (input)="seek($event)"
            />
            <span class="w-10 tabular-nums">{{
              player.durationMs() | duration
            }}</span>
          </div>
        </div>

        <div class="flex flex-1 items-center justify-end gap-2">
          <input
            type="range"
            class="hidden w-24 accent-accent md:block"
            aria-label="Volume"
            min="0"
            max="1"
            step="0.05"
            [value]="player.volume()"
            (input)="setVolume($event)"
          />
          <button
            class="rounded-full p-2 hover:bg-surface"
            aria-label="Queue"
            [attr.aria-expanded]="showQueue()"
            (click)="showQueue.set(!showQueue())"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-5 fill-current"
              aria-hidden="true"
            >
              <path
                d="M4 6h12v2H4zm0 5h12v2H4zm0 5h8v2H4zm14-2v-8h2v8.5a2.5 2.5 0 1 1-2-2.45z"
              />
            </svg>
          </button>
        </div>
      </div>

      @if (player.error(); as error) {
        <p class="px-3 pb-2 text-sm text-danger" role="alert">{{ error }}</p>
      }
    }
  `,
})
export class PlayerBar {
  protected readonly player = inject(PlayerService);
  protected readonly showQueue = signal(false);

  protected seek(event: Event): void {
    this.player.seek(Number((event.target as HTMLInputElement).value));
  }

  protected setVolume(event: Event): void {
    this.player.volume.set(Number((event.target as HTMLInputElement).value));
  }
}
