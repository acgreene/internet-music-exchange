import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import type { ManagedProductResponse, ProductType } from '@ime/models';
import { AlertComponent, ButtonDirective, InputDirective } from '@ime/ui';
import { PRODUCT_TYPES } from '../merch-options';

/**
 * A product's name, type, description, and the release it is an edition of.
 */
@Component({
  selector: 'ime-product-details-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, InputDirective],
  template: `
    <section
      class="flex flex-col gap-4"
      aria-labelledby="product-details-heading"
    >
      <h2 id="product-details-heading" class="text-lg font-semibold">
        Details
      </h2>
      <div
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
      >
        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Name
            <input imeInput [value]="name()" (input)="name.set(text($event))" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Type
            <select imeInput (change)="onType($event)">
              @for (option of types; track option.value) {
                <option
                  [value]="option.value"
                  [selected]="option.value === type()"
                >
                  {{ option.label }}
                </option>
              }
            </select>
          </label>
        </div>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          Description
          <textarea
            imeInput
            rows="4"
            [value]="description()"
            (input)="description.set(text($event))"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          Edition of
          <select imeInput (change)="onRelease($event)">
            <option value="" [selected]="!releaseId()">
              No release (stands alone)
            </option>
            @for (release of releases(); track release.id) {
              <option
                [value]="release.id"
                [selected]="release.id === releaseId()"
              >
                {{ release.title }}
              </option>
            }
          </select>
        </label>
        @if (releaseId()) {
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              [checked]="includesDigital()"
              (change)="onDigital($event)"
            />
            Buying it also gives the buyer the digital release
          </label>
        }
        <p class="text-sm text-ink-muted">
          Options: {{ managed().product.option1Name ? optionNames() : 'none' }}.
          Options are set when the product is created.
        </p>
        @if (saved()) {
          <ime-alert tone="success">Saved.</ime-alert>
        }
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div>
          <button
            imeButton
            variant="secondary"
            [busy]="saving()"
            (click)="save()"
          >
            Save details
          </button>
        </div>
      </div>
    </section>
  `,
})
export class ProductDetailsSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedProductResponse>();
  public readonly changed = output<void>();

  protected readonly types = PRODUCT_TYPES;
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly name = linkedSignal(() => this.managed().product.name);
  protected readonly type = linkedSignal<ProductType>(
    () => this.managed().product.type,
  );
  protected readonly description = linkedSignal(
    () => this.managed().product.description ?? '',
  );
  protected readonly releaseId = linkedSignal<string | null>(
    () => this.managed().product.releaseId,
  );
  protected readonly includesDigital = linkedSignal(
    () => this.managed().product.includesDigital,
  );

  private readonly releasesResource = resource({
    params: () => this.managed().product.artistId,
    loader: async ({ params }) =>
      unwrap(await this.api.releases.listForArtist(params)),
  });
  protected readonly releases = computed(
    () => currentValue(this.releasesResource) ?? [],
  );

  protected readonly optionNames = computed(() => {
    const product = this.managed().product;
    return [product.option1Name, product.option2Name, product.option3Name]
      .filter(Boolean)
      .join(', ');
  });

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected onType(event: Event): void {
    this.type.set((event.target as HTMLSelectElement).value as ProductType);
  }

  protected onRelease(event: Event): void {
    this.releaseId.set((event.target as HTMLSelectElement).value || null);
  }

  protected onDigital(event: Event): void {
    this.includesDigital.set((event.target as HTMLInputElement).checked);
  }

  protected async save(): Promise<void> {
    this.saved.set(false);
    this.error.set(null);
    this.saving.set(true);
    const releaseId = this.releaseId();
    const result = await this.api.merch.update(this.managed().product.id, {
      name: this.name().trim(),
      type: this.type(),
      description: this.description().trim() || null,
      releaseId,
      includesDigital: releaseId ? this.includesDigital() : false,
    });
    this.saving.set(false);
    if (result.ok) {
      this.saved.set(true);
      this.changed.emit();
    } else {
      this.error.set(result.error.message);
    }
  }
}
