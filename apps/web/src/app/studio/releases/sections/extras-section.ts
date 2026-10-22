import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ApiClient, type ApiResult } from '@ime/api-client';
import { assetKindLabel } from '@ime/client-listening';
import type {
  ManagedReleaseResponse,
  ReleaseAssetKind,
  ReleaseAssetResponse,
} from '@ime/models';
import { AlertComponent, ButtonDirective, InputDirective } from '@ime/ui';
import { EXTRA_KINDS } from '../release-options';
import { uploadAsset } from '../upload-asset';

const MB = 1024 * 1024;

/** What the file picker offers for each kind of extra. */
const ACCEPT: Record<Exclude<ReleaseAssetKind, 'cover'>, string> = {
  back_cover: 'image/jpeg,image/png,image/webp',
  photo: 'image/jpeg,image/png,image/webp',
  liner_notes: 'image/jpeg,image/png,image/webp,application/pdf',
  document: 'application/pdf',
  video: 'video/mp4,video/webm',
  audio:
    'audio/wav,audio/flac,audio/aiff,audio/mpeg,.wav,.flac,.aif,.aiff,.mp3',
  other: 'image/*,application/pdf,video/mp4,video/webm,audio/*',
};

/**
 * Everything a release carries besides its music and cover: back cover,
 * liner notes, photos, videos, documents. Each is public or for owners.
 */
@Component({
  selector: 'ime-extras-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, InputDirective],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="extras-heading">
      <div>
        <h2 id="extras-heading" class="text-lg font-semibold">Extras</h2>
        <p class="text-sm text-ink-muted">
          Liner notes, photos, videos and more. Mark an extra "for owners" to
          make it a bonus for people who buy.
        </p>
      </div>

      @if (extras().length) {
        <ul
          class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
        >
          @for (asset of extras(); track asset.id) {
            <li class="flex flex-wrap items-center gap-3 p-4">
              <span class="w-28 text-sm text-ink-muted">{{
                kindLabel(asset.kind)
              }}</span>
              <input
                imeInput
                class="min-w-40 flex-1"
                placeholder="Title"
                [attr.aria-label]="'Title of ' + kindLabel(asset.kind)"
                [value]="asset.title ?? ''"
                (change)="retitle(asset, $event)"
              />
              <span class="text-sm text-ink-muted"
                >{{ (asset.byteSize / mb).toFixed(1) }} MB</span
              >
              @if (asset.kind !== 'back_cover') {
                <label class="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    [checked]="asset.requiresPurchase"
                    (change)="setOwnersOnly(asset, $event)"
                  />
                  For owners
                </label>
              }
              <button
                imeButton
                variant="ghost"
                size="sm"
                (click)="remove(asset)"
              >
                Remove
              </button>
            </li>
          }
        </ul>
      }

      <div
        class="flex flex-wrap items-end gap-3 rounded-card border border-dashed border-line p-4"
      >
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          Kind
          <select imeInput [value]="kind()" (change)="onKind($event)">
            @for (option of kinds; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>
        <label class="flex items-center gap-2 pb-2.5 text-sm">
          <input
            type="checkbox"
            [checked]="ownersOnly()"
            (change)="onOwnersOnly($event)"
          />
          For owners
        </label>
        <label imeButton variant="secondary" class="cursor-pointer">
          Upload
          <input
            class="sr-only"
            type="file"
            [accept]="accept()"
            [disabled]="progress() !== null"
            (change)="upload($event)"
          />
        </label>
        @if (progress() !== null) {
          <progress
            class="w-48"
            max="1"
            [value]="progress()"
            aria-label="Upload progress"
          ></progress>
        }
      </div>
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </section>
  `,
})
export class ExtrasSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedReleaseResponse>();
  public readonly changed = output<void>();

  protected readonly kinds = EXTRA_KINDS;
  protected readonly mb = MB;
  protected readonly kind =
    signal<Exclude<ReleaseAssetKind, 'cover'>>('liner_notes');
  protected readonly ownersOnly = signal(false);
  protected readonly progress = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly extras = computed(() =>
    this.managed().assets.filter((asset) => asset.kind !== 'cover'),
  );
  protected readonly accept = computed(() => ACCEPT[this.kind()]);
  protected readonly kindLabel = assetKindLabel;

  protected onKind(event: Event): void {
    this.kind.set(
      (event.target as HTMLSelectElement).value as Exclude<
        ReleaseAssetKind,
        'cover'
      >,
    );
  }

  protected onOwnersOnly(event: Event): void {
    this.ownersOnly.set((event.target as HTMLInputElement).checked);
  }

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    this.progress.set(0);
    const kind = this.kind();
    const result = await uploadAsset(
      this.api,
      this.managed().release.id,
      file,
      {
        kind,
        title: file.name.replace(/\.[^.]+$/, ''),
        requiresPurchase: kind === 'back_cover' ? false : this.ownersOnly(),
      },
      (fraction) => this.progress.set(Math.max(fraction, 0.01)),
    );
    this.progress.set(null);
    this.finish(result);
  }

  protected async retitle(
    asset: ReleaseAssetResponse,
    event: Event,
  ): Promise<void> {
    const title = (event.target as HTMLInputElement).value.trim() || null;
    if (title === asset.title) return;
    this.finish(await this.api.releases.updateAsset(asset.id, { title }));
  }

  protected async setOwnersOnly(
    asset: ReleaseAssetResponse,
    event: Event,
  ): Promise<void> {
    const requiresPurchase = (event.target as HTMLInputElement).checked;
    this.finish(
      await this.api.releases.updateAsset(asset.id, { requiresPurchase }),
    );
  }

  protected async remove(asset: ReleaseAssetResponse): Promise<void> {
    this.finish(await this.api.releases.deleteAsset(asset.id));
  }

  private finish(result: ApiResult<unknown>): void {
    if (result.ok) {
      this.error.set(null);
      this.changed.emit();
    } else {
      this.error.set(result.error.message);
    }
  }
}
