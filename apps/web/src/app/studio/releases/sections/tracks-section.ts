import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { ApiClient, type ApiResult } from '@ime/api-client';
import { readAudioDuration } from '@ime/client-data';
import type { ManagedReleaseResponse, TracklistItem } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  DurationPipe,
  FieldComponent,
  InputDirective,
} from '@ime/ui';
import { uploadTrackAudio } from '../upload-asset';

const MB = 1024 * 1024;

/**
 * The tracklist: titles, running order, audio, and which tracks anyone may
 * hear as a preview.
 */
@Component({
  selector: 'ime-tracks-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DurationPipe,
    FieldComponent,
    FormField,
    InputDirective,
  ],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="tracks-heading">
      <div>
        <h2 id="tracks-heading" class="text-lg font-semibold">Tracks</h2>
        <p class="text-sm text-ink-muted">
          Upload WAV, FLAC, or AIFF if you can; MP3 works too. Owners download
          exactly what you upload. Previews can be heard by anyone.
        </p>
      </div>

      <ol
        class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
      >
        @for (
          track of managed().tracks;
          track track.trackId;
          let first = $first;
          let last = $last
        ) {
          <li class="flex flex-col gap-3 p-4">
            <div class="flex flex-wrap items-center gap-3">
              <span
                class="w-6 text-right text-sm text-ink-subtle tabular-nums"
                >{{ track.position }}</span
              >
              <input
                imeInput
                class="min-w-48 flex-1"
                [attr.aria-label]="'Title of track ' + track.position"
                [value]="track.title"
                (change)="rename(track, $event)"
              />
              <span class="w-12 text-sm text-ink-muted tabular-nums">{{
                track.durationMs | duration
              }}</span>
              <div class="flex gap-1">
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  [disabled]="first || busy()"
                  [attr.aria-label]="'Move ' + track.title + ' up'"
                  (click)="move(track, -1)"
                >
                  ↑
                </button>
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  [disabled]="last || busy()"
                  [attr.aria-label]="'Move ' + track.title + ' down'"
                  (click)="move(track, 1)"
                >
                  ↓
                </button>
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  [disabled]="busy()"
                  (click)="remove(track)"
                >
                  Remove
                </button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-4 pl-9 text-sm">
              <span class="text-ink-muted">{{ audioLabel(track) }}</span>
              <label
                imeButton
                variant="secondary"
                size="sm"
                class="cursor-pointer"
              >
                {{ hasAudio(track) ? 'Replace audio' : 'Upload audio' }}
                <input
                  class="sr-only"
                  type="file"
                  accept="audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff,audio/mpeg,.wav,.flac,.aif,.aiff,.mp3"
                  [disabled]="uploading().has(track.trackId)"
                  (change)="upload(track, $event)"
                />
              </label>
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  [checked]="track.isPreview"
                  [disabled]="busy()"
                  (change)="setPreview(track, $event)"
                />
                Preview
              </label>
              @if (uploading().get(track.trackId); as fraction) {
                <progress
                  class="w-40"
                  max="1"
                  [value]="fraction"
                  [attr.aria-label]="'Uploading ' + track.title"
                ></progress>
              }
            </div>
          </li>
        } @empty {
          <li class="p-4 text-sm text-ink-muted">
            No tracks yet. Add the first below.
          </li>
        }
      </ol>

      <form class="flex items-end gap-2" novalidate (submit)="add($event)">
        <ime-field
          class="flex-1"
          label="New track"
          [errors]="addForm.title().errors()"
          [touched]="addForm.title().touched()"
        >
          <input
            imeInput
            placeholder="Track title"
            [formField]="addForm.title"
          />
        </ime-field>
        <button
          imeButton
          type="submit"
          variant="secondary"
          [busy]="addForm().submitting()"
        >
          Add track
        </button>
      </form>
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </section>
  `,
})
export class TracksSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedReleaseResponse>();
  public readonly changed = output<void>();

  protected readonly busy = signal(false);
  /** Upload progress by track. */
  protected readonly uploading = signal(new Map<string, number>());
  protected readonly error = signal<string | null>(null);

  private readonly newTrack = signal({ title: '' });
  protected readonly addForm = form(this.newTrack, (path) => {
    required(path.title, { message: 'Give the track a title.' });
  });

  private readonly originals = computed(
    () => new Map(this.managed().originals.map((file) => [file.trackId, file])),
  );
  private readonly streamable = computed(
    () => new Set(this.managed().streamCopies.map((file) => file.trackId)),
  );

  protected hasAudio(track: TracklistItem): boolean {
    return this.originals().has(track.trackId);
  }

  protected audioLabel(track: TracklistItem): string {
    const original = this.originals().get(track.trackId);
    if (!original) return 'No audio yet';
    const size = `${original.format.toUpperCase()}, ${(original.byteSize / MB).toFixed(1)} MB`;
    const ready =
      original.format === 'mp3' || this.streamable().has(track.trackId);
    return ready
      ? `${size} · ready to stream`
      : `${size} · preparing the stream`;
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.addForm, async () => {
      const ok = await this.run(() =>
        this.api.releases.addTrack(this.managed().release.id, {
          title: this.newTrack().title.trim(),
        }),
      );
      if (ok) this.addForm().reset({ title: '' });
      return undefined;
    });
  }

  protected async rename(track: TracklistItem, event: Event): Promise<void> {
    const title = (event.target as HTMLInputElement).value.trim();
    if (!title || title === track.title) return;
    await this.run(() =>
      this.api.releases.updateTrack(track.trackId, { title }),
    );
  }

  protected async move(track: TracklistItem, by: -1 | 1): Promise<void> {
    const ids = this.managed().tracks.map((item) => item.trackId);
    const from = ids.indexOf(track.trackId);
    [ids[from], ids[from + by]] = [ids[from + by], ids[from]];
    await this.run(() =>
      this.api.releases.reorderTracks(this.managed().release.id, ids),
    );
  }

  protected async remove(track: TracklistItem): Promise<void> {
    await this.run(() =>
      this.api.releases.removeTrack(this.managed().release.id, track.trackId),
    );
  }

  protected async setPreview(
    track: TracklistItem,
    event: Event,
  ): Promise<void> {
    const isPreview = (event.target as HTMLInputElement).checked;
    await this.run(() =>
      this.api.releases.setTrackPreview(
        this.managed().release.id,
        track.trackId,
        isPreview,
      ),
    );
  }

  protected async upload(track: TracklistItem, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    this.setProgress(track.trackId, 0);
    const durationMs = await readAudioDuration(file);
    const result = await uploadTrackAudio(
      this.api,
      this.managed().release.id,
      track.trackId,
      file,
      durationMs,
      (fraction) => this.setProgress(track.trackId, fraction),
    );
    this.setProgress(track.trackId, null);
    if (result.ok) {
      this.changed.emit();
    } else {
      this.error.set(result.error.message);
    }
  }

  private setProgress(trackId: string, fraction: number | null): void {
    const next = new Map(this.uploading());
    if (fraction === null) next.delete(trackId);
    // a tiny floor, so a just-started upload still shows its bar
    else next.set(trackId, Math.max(fraction, 0.01));
    this.uploading.set(next);
  }

  private async run(call: () => Promise<ApiResult<unknown>>): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    const result = await call();
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.error.message);
      return false;
    }
    this.changed.emit();
    return true;
  }
}
