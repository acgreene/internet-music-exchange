import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { currentValue, uploadFile } from '@ime/client-data';
import type { DesignSlot, ManagedReleaseResponse } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  InputDirective,
} from '@ime/ui';

/**
 * The page design the release renders with, and the artist's words and
 * images in its slots. Without one, the release uses IME's own layout.
 */
@Component({
  selector: 'ime-design-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    InputDirective,
    RouterLink,
  ],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="design-heading">
      <div>
        <h2 id="design-heading" class="text-lg font-semibold">Page design</h2>
        <p class="text-sm text-ink-muted">
          Give this release its own page, made by a designer. The tracklist,
          cover, and buying always stay IME's.
        </p>
      </div>

      @if (design(); as design) {
        @if (design.applied; as applied) {
          <div
            class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span class="flex items-baseline gap-2">
                <b>{{ applied.designName }}</b>
                <span class="font-mono text-sm text-ink-muted"
                  >v{{ applied.version }}</span
                >
              </span>
              <div class="flex gap-2">
                @if (design.newerVersion; as newer) {
                  <button
                    imeButton
                    size="sm"
                    [busy]="working() === 'update'"
                    (click)="updateToLatest()"
                  >
                    Update to v{{ newer }}
                  </button>
                }
                <button
                  imeButton
                  size="sm"
                  variant="ghost"
                  [busy]="working() === 'remove'"
                  (click)="remove()"
                >
                  Use IME's layout
                </button>
              </div>
            </div>

            @for (slot of applied.slots; track slot.name) {
              @if (slot.kind === 'text') {
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  {{ slot.label }}
                  <textarea
                    imeInput
                    rows="2"
                    [value]="values()[slot.name] ?? ''"
                    (input)="setValue(slot, $event)"
                  ></textarea>
                </label>
              } @else if (slot.kind === 'color') {
                <label class="flex items-center gap-3 text-sm font-medium">
                  <input
                    class="h-10 w-12 cursor-pointer rounded-control border border-line bg-canvas"
                    type="color"
                    [value]="values()[slot.name] || slot.default || '#000000'"
                    (input)="setValue(slot, $event)"
                  />
                  {{ slot.label }}
                </label>
              } @else {
                <div class="flex flex-col gap-1.5 text-sm">
                  <span class="font-medium">{{ slot.label }}</span>
                  <div class="flex items-center gap-3">
                    <ime-cover
                      class="w-20 border border-line"
                      [src]="imageUrl(values()[slot.name])"
                      [alt]="slot.label"
                    />
                    <label
                      imeButton
                      variant="secondary"
                      size="sm"
                      class="cursor-pointer"
                    >
                      {{ values()[slot.name] ? 'Replace' : 'Upload' }}
                      <input
                        class="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        (change)="uploadImage(slot, $event)"
                      />
                    </label>
                    @if (uploading() === slot.name) {
                      <span class="text-ink-muted">Uploading…</span>
                    }
                  </div>
                </div>
              }
            }
            @if (applied.slots.length) {
              @if (saved()) {
                <ime-alert tone="success"
                  >Saved. The page shows it now.</ime-alert
                >
              }
              <div>
                <button
                  imeButton
                  variant="secondary"
                  [busy]="working() === 'save'"
                  (click)="save()"
                >
                  Save content
                </button>
              </div>
            }
          </div>
        } @else {
          <div
            class="flex flex-wrap items-end gap-3 rounded-card border border-dashed border-line p-4"
          >
            @if (licensed().length) {
              <label class="flex flex-col gap-1.5 text-sm font-medium">
                Design
                <select
                  imeInput
                  class="min-w-56"
                  (change)="chosen.set(selectValue($event))"
                >
                  @for (option of licensed(); track option.id) {
                    <option
                      [value]="option.id"
                      [selected]="option.id === chosen()"
                    >
                      {{ option.name }}
                    </option>
                  }
                </select>
              </label>
              <button
                imeButton
                [busy]="working() === 'apply'"
                (click)="apply()"
              >
                Apply
              </button>
            } @else {
              <p class="text-sm">
                This artist has no designs yet.
                <a class="link" routerLink="/studio/marketplace"
                  >Find one on the marketplace</a
                >.
              </p>
            }
          </div>
        }
      }
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </section>
  `,
})
export class DesignSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedReleaseResponse>();

  private readonly releaseId = computed(() => this.managed().release.id);

  protected readonly designResource = resource({
    params: () => this.releaseId(),
    loader: async ({ params }) =>
      unwrap(await this.api.designs.getReleaseDesign(params)),
  });
  protected readonly design = computed(() => currentValue(this.designResource));

  private readonly licensedResource = resource({
    params: () => this.managed().release.artistId,
    loader: async ({ params }) =>
      unwrap(await this.api.designs.listLicensed(params)),
  });
  protected readonly licensed = computed(
    () => currentValue(this.licensedResource) ?? [],
  );
  protected readonly chosen = linkedSignal(
    () => this.licensed()[0]?.id ?? null,
  );

  /** The slot values being edited, starting from what is saved. */
  protected readonly values = linkedSignal<Record<string, string>>(
    () => this.design()?.applied?.customization ?? {},
  );
  /** Images uploaded while editing, until the design reloads with them. */
  private readonly uploaded = signal<{ id: string; url: string }[]>([]);

  protected readonly working = signal<
    'apply' | 'update' | 'remove' | 'save' | null
  >(null);
  protected readonly uploading = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  protected selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected imageUrl(imageId: string | undefined): string | null {
    if (!imageId) return null;
    const images = [...(this.design()?.images ?? []), ...this.uploaded()];
    return images.find((image) => image.id === imageId)?.url ?? null;
  }

  protected setValue(slot: DesignSlot, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.values.update((values) => ({ ...values, [slot.name]: value }));
    this.saved.set(false);
  }

  protected async uploadImage(slot: DesignSlot, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(slot.name);
    this.error.set(null);
    const target = await this.api.designs.createSlotImageUpload(
      this.releaseId(),
      file.type,
    );
    if (!target.ok) {
      this.uploading.set(null);
      this.error.set(target.error.message);
      return;
    }
    try {
      await uploadFile(target.data.uploadUrl, file);
    } catch (error) {
      this.uploading.set(null);
      this.error.set(
        error instanceof Error ? error.message : 'The upload failed.',
      );
      return;
    }
    const image = await this.api.designs.confirmSlotImage(
      this.releaseId(),
      target.data.objectKey,
    );
    this.uploading.set(null);
    if (!image.ok) {
      this.error.set(image.error.message);
      return;
    }
    this.uploaded.update((images) => [...images, image.data]);
    this.values.update((values) => ({ ...values, [slot.name]: image.data.id }));
    this.saved.set(false);
  }

  protected async apply(): Promise<void> {
    const designId = this.chosen();
    if (designId)
      await this.run('apply', () =>
        this.api.designs.applyToRelease(this.releaseId(), designId),
      );
  }

  protected async updateToLatest(): Promise<void> {
    await this.run('update', () =>
      this.api.designs.updateReleaseToLatest(this.releaseId()),
    );
  }

  protected async remove(): Promise<void> {
    await this.run('remove', () =>
      this.api.designs.removeFromRelease(this.releaseId()),
    );
  }

  protected async save(): Promise<void> {
    const done = await this.run('save', () =>
      this.api.designs.customizeRelease(this.releaseId(), this.values()),
    );
    if (done) this.saved.set(true);
  }

  private async run(
    kind: 'apply' | 'update' | 'remove' | 'save',
    call: () => Promise<ApiResult<unknown>>,
  ): Promise<boolean> {
    this.working.set(kind);
    this.error.set(null);
    const result = await call();
    this.working.set(null);
    if (!result.ok) {
      this.error.set(result.error.message);
      return false;
    }
    this.designResource.reload();
    return true;
  }
}
