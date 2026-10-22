import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { ApiClient, unwrap } from '@ime/api-client';
import type { ManagedReleaseResponse } from '@ime/models';
import { AlertComponent, ButtonDirective, CoverComponent } from '@ime/ui';
import { uploadAsset } from '../upload-asset';

/**
 * The cover, which every release needs before it is published.
 */
@Component({
  selector: 'ime-cover-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, CoverComponent],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="cover-heading">
      <h2 id="cover-heading" class="text-lg font-semibold">Cover</h2>
      <div
        class="flex flex-wrap items-start gap-6 rounded-card border border-line bg-surface p-4"
      >
        <ime-cover
          class="w-48"
          [src]="coverUrl.hasValue() ? coverUrl.value() : null"
          alt="The release's cover"
        />
        <div class="flex max-w-sm flex-col gap-3">
          <p class="text-sm text-ink-muted">
            Square, at least 1400 pixels wide. JPEG, PNG, or WebP, up to 20 MB.
            The cover is always public.
          </p>
          <label
            imeButton
            variant="secondary"
            class="w-fit cursor-pointer"
            [class.opacity-50]="progress() !== null"
          >
            {{ cover() ? 'Replace cover' : 'Upload cover' }}
            <input
              class="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              [disabled]="progress() !== null"
              (change)="upload($event)"
            />
          </label>
          @if (progress() !== null) {
            <progress
              class="w-full"
              max="1"
              [value]="progress()"
              aria-label="Upload progress"
            ></progress>
          }
          @if (error(); as message) {
            <ime-alert tone="error">{{ message }}</ime-alert>
          }
        </div>
      </div>
    </section>
  `,
})
export class CoverSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedReleaseResponse>();
  public readonly changed = output<void>();

  protected readonly progress = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly cover = computed(
    () => this.managed().assets.find((asset) => asset.kind === 'cover') ?? null,
  );

  protected readonly coverUrl = resource({
    params: () => this.cover()?.id,
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.getAssetUrl(params)).url,
  });

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    this.progress.set(0);
    const result = await uploadAsset(
      this.api,
      this.managed().release.id,
      file,
      { kind: 'cover' },
      (fraction) => this.progress.set(fraction),
    );
    this.progress.set(null);
    if (result.ok) {
      this.changed.emit();
    } else {
      this.error.set(result.error.message);
    }
  }
}
