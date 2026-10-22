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
import type { ManagedProductResponse, VariantResponse } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  MoneyPipe,
} from '@ime/ui';

/** A price field in minor units, or null when it is not a price. */
const toCents = (value: string): number | null => {
  const amount = Math.round(Number(value) * 100);
  return value.trim() === '' || !Number.isFinite(amount) || amount < 0
    ? null
    : amount;
};

/**
 * What buyers pick between: one variant per combination of options, each
 * with its price, stock, and SKU.
 */
@Component({
  selector: 'ime-variants-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, InputDirective, MoneyPipe],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="variants-heading">
      <div>
        <h2 id="variants-heading" class="text-lg font-semibold">
          Variants and stock
        </h2>
        <p class="text-sm text-ink-muted">
          @if (optionNames().length) {
            One for each combination buyers can choose, such as each size and
            color.
          } @else {
            The product's price and stock. It has no options, so one variant is
            enough.
          }
        </p>
      </div>

      <div class="overflow-x-auto rounded-card border border-line bg-surface">
        <table class="w-full text-sm">
          <thead class="text-left text-ink-muted">
            <tr>
              @for (name of optionNames(); track name) {
                <th class="px-3 py-2 font-normal">{{ name }}</th>
              }
              <th class="px-3 py-2 font-normal">Price</th>
              <th class="px-3 py-2 font-normal">Stock</th>
              <th class="px-3 py-2 font-normal">SKU</th>
              <th class="px-3 py-2"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (variant of managed().variants; track variant.id) {
              <tr class="border-t border-line">
                @for (value of valuesOf(variant); track $index) {
                  <td class="px-3 py-2">{{ value }}</td>
                }
                <td class="px-3 py-2">
                  <input
                    imeInput
                    class="w-24"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="0.01"
                    [attr.aria-label]="'Price of ' + describe(variant)"
                    [value]="(variant.price / 100).toFixed(2)"
                    (change)="setPrice(variant, $event)"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    imeInput
                    class="w-20"
                    type="number"
                    min="0"
                    step="1"
                    [attr.aria-label]="'Stock of ' + describe(variant)"
                    [value]="variant.stock"
                    (change)="setStock(variant, $event)"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    imeInput
                    class="w-28"
                    [attr.aria-label]="'SKU of ' + describe(variant)"
                    [value]="variant.sku ?? ''"
                    (change)="setSku(variant, $event)"
                  />
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    imeButton
                    variant="ghost"
                    size="sm"
                    (click)="remove(variant)"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td
                  class="px-3 py-3 text-ink-muted"
                  [attr.colspan]="optionNames().length + 4"
                >
                  No variants yet. Add one below.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <form
        class="flex flex-wrap items-end gap-2 rounded-card border border-dashed border-line p-4"
        (submit)="add($event)"
      >
        @for (name of optionNames(); track name; let axis = $index) {
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            {{ name }}
            <input
              imeInput
              class="w-28"
              [value]="newOptions()[axis] ?? ''"
              (input)="setNewOption(axis, $event)"
            />
          </label>
        }
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          Price
          <input
            imeInput
            class="w-24"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            [value]="newPrice()"
            (input)="newPrice.set(text($event))"
          />
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          Stock
          <input
            imeInput
            class="w-20"
            type="number"
            min="0"
            step="1"
            [value]="newStock()"
            (input)="newStock.set(text($event))"
          />
        </label>
        <button imeButton type="submit" variant="secondary" [busy]="busy()">
          Add variant
        </button>
      </form>
      @if (newPriceCents(); as cents) {
        <p class="-mt-2 text-sm text-ink-muted">
          Adds a variant at
          {{ cents | money: managed().product.currency }}.
        </p>
      }
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </section>
  `,
})
export class VariantsSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedProductResponse>();
  public readonly changed = output<void>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly newOptions = signal<string[]>([]);
  protected readonly newPrice = signal('');
  protected readonly newStock = signal('0');
  protected readonly newPriceCents = computed(() => toCents(this.newPrice()));

  protected readonly optionNames = computed(() => {
    const product = this.managed().product;
    return [
      product.option1Name,
      product.option2Name,
      product.option3Name,
    ].filter((name): name is string => Boolean(name));
  });

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected valuesOf(variant: VariantResponse): (string | null)[] {
    return [
      variant.option1Value,
      variant.option2Value,
      variant.option3Value,
    ].slice(0, this.optionNames().length);
  }

  protected describe(variant: VariantResponse): string {
    return this.valuesOf(variant).filter(Boolean).join(' / ') || 'the product';
  }

  protected setNewOption(axis: number, event: Event): void {
    const value = this.text(event);
    this.newOptions.update((options) => {
      const next = [...options];
      next[axis] = value;
      return next;
    });
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    const price = this.newPriceCents();
    if (price === null) {
      this.error.set('Give the variant a price.');
      return;
    }
    const options = this.optionNames().map((_, axis) =>
      (this.newOptions()[axis] ?? '').trim(),
    );
    if (options.some((option) => !option)) {
      this.error.set(`Fill in ${this.optionNames().join(' and ')}.`);
      return;
    }
    const done = await this.run(() =>
      this.api.merch.addVariant(this.managed().product.id, {
        price,
        stock: Math.max(0, Math.floor(Number(this.newStock()) || 0)),
        options: options.length ? options : undefined,
      }),
    );
    if (done) {
      this.newOptions.set([]);
      this.newPrice.set('');
      this.newStock.set('0');
    }
  }

  protected async setPrice(
    variant: VariantResponse,
    event: Event,
  ): Promise<void> {
    const price = toCents(this.text(event));
    if (price === null || price === variant.price) return;
    await this.run(() => this.api.merch.updateVariant(variant.id, { price }));
  }

  protected async setStock(
    variant: VariantResponse,
    event: Event,
  ): Promise<void> {
    const stock = Math.floor(Number(this.text(event)));
    if (!Number.isFinite(stock) || stock < 0 || stock === variant.stock) return;
    await this.run(() => this.api.merch.setStock(variant.id, stock));
  }

  protected async setSku(
    variant: VariantResponse,
    event: Event,
  ): Promise<void> {
    const sku = this.text(event).trim() || null;
    if (sku === variant.sku) return;
    await this.run(() => this.api.merch.updateVariant(variant.id, { sku }));
  }

  protected async remove(variant: VariantResponse): Promise<void> {
    await this.run(() => this.api.merch.removeVariant(variant.id));
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
