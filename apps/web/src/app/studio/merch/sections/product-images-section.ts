import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ApiClient, type ApiResult } from '@ime/api-client';
import { uploadFile } from '@ime/client-data';
import type { ManagedProductResponse } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  InputDirective,
} from '@ime/ui';

type ProductImage = ManagedProductResponse['images'][number];

/**
 * The product's photos, in the order buyers see them. A photo can belong to
 * one variant, so choosing that variant shows it.
 */
@Component({
  selector: 'ime-product-images-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, CoverComponent, InputDirective],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="images-heading">
      <div>
        <h2 id="images-heading" class="text-lg font-semibold">Photos</h2>
        <p class="text-sm text-ink-muted">
          JPEG, PNG, or WebP, up to 20 MB each. The first is the one in the
          store.
        </p>
      </div>
      @if (managed().images.length) {
        <ul
          class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
        >
          @for (
            image of managed().images;
            track image.id;
            let first = $first;
            let last = $last
          ) {
            <li class="flex flex-wrap items-center gap-3 p-3">
              <ime-cover
                class="w-16"
                [src]="image.url"
                [alt]="image.altText ?? ''"
              />
              <input
                imeInput
                class="min-w-40 flex-1"
                placeholder="Describe the photo"
                [attr.aria-label]="
                  'Description of photo ' + (image.position + 1)
                "
                [value]="image.altText ?? ''"
                (change)="setAltText(image, $event)"
              />
              @if (variantChoices().length) {
                <select
                  class="h-10 rounded-control border border-line bg-canvas px-2 text-sm"
                  [attr.aria-label]="
                    'Variant for photo ' + (image.position + 1)
                  "
                  (change)="setVariant(image, $event)"
                >
                  <option value="" [selected]="!image.variantId">
                    Every variant
                  </option>
                  @for (choice of variantChoices(); track choice.id) {
                    <option
                      [value]="choice.id"
                      [selected]="choice.id === image.variantId"
                    >
                      {{ choice.label }}
                    </option>
                  }
                </select>
              }
              <div class="flex gap-1">
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  [disabled]="first"
                  aria-label="Move earlier"
                  (click)="move(image, -1)"
                >
                  ↑
                </button>
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  [disabled]="last"
                  aria-label="Move later"
                  (click)="move(image, 1)"
                >
                  ↓
                </button>
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  (click)="remove(image)"
                >
                  Remove
                </button>
              </div>
            </li>
          }
        </ul>
      }
      <div class="flex items-center gap-3">
        <label imeButton variant="secondary" class="cursor-pointer">
          Add a photo
          <input
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            [disabled]="uploading()"
            (change)="upload($event)"
          />
        </label>
        @if (uploading()) {
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
export class ProductImagesSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedProductResponse>();
  public readonly changed = output<void>();

  protected readonly uploading = signal(false);
  protected readonly progress = signal(0);
  protected readonly error = signal<string | null>(null);

  protected variantChoices(): { id: string; label: string }[] {
    return this.managed()
      .variants.map((variant) => ({
        id: variant.id,
        label: [
          variant.option1Value,
          variant.option2Value,
          variant.option3Value,
        ]
          .filter(Boolean)
          .join(' / '),
      }))
      .filter((choice) => choice.label);
  }

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const productId = this.managed().product.id;
    this.uploading.set(true);
    this.progress.set(0.01);
    this.error.set(null);
    const target = await this.api.merch.createImageUpload(productId, file.type);
    let result: ApiResult<unknown> = target;
    if (target.ok) {
      try {
        await uploadFile(target.data.uploadUrl, file, (fraction) =>
          this.progress.set(Math.max(fraction, 0.01)),
        );
        result = await this.api.merch.confirmImage(productId, {
          objectKey: target.data.objectKey,
        });
      } catch (error) {
        this.uploading.set(false);
        this.error.set(
          error instanceof Error ? error.message : 'The upload failed.',
        );
        return;
      }
    }
    this.uploading.set(false);
    this.finish(result);
  }

  protected async setAltText(image: ProductImage, event: Event): Promise<void> {
    const altText = (event.target as HTMLInputElement).value.trim() || null;
    if (altText === image.altText) return;
    this.finish(await this.api.merch.updateImage(image.id, { altText }));
  }

  protected async setVariant(image: ProductImage, event: Event): Promise<void> {
    const variantId = (event.target as HTMLSelectElement).value || null;
    this.finish(await this.api.merch.updateImage(image.id, { variantId }));
  }

  protected async move(image: ProductImage, by: -1 | 1): Promise<void> {
    this.finish(
      await this.api.merch.updateImage(image.id, {
        position: image.position + by,
      }),
    );
  }

  protected async remove(image: ProductImage): Promise<void> {
    this.finish(await this.api.merch.deleteImage(image.id));
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
