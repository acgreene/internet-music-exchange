import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ApiClient, type ApiResult } from '@ime/api-client';
import type { ManagedProductResponse, ShippingZone } from '@ime/models';
import { AlertComponent, ButtonDirective, InputDirective } from '@ime/ui';

const ZONES: { zone: ShippingZone; label: string; hint: string }[] = [
  { zone: 'domestic', label: 'Domestic', hint: 'Within your own country.' },
  {
    zone: 'international',
    label: 'International',
    hint: 'Everywhere else. Leave it off to ship only at home.',
  },
];

/** A price field in minor units, or null when it is not a price. */
const toCents = (value: string): number | null => {
  const amount = Math.round(Number(value) * 100);
  return value.trim() === '' || !Number.isFinite(amount) || amount < 0
    ? null
    : amount;
};

/**
 * Flat shipping rates, by where the order goes: a price for the first unit
 * and for each one after.
 */
@Component({
  selector: 'ime-shipping-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, InputDirective],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="shipping-heading">
      <h2 id="shipping-heading" class="text-lg font-semibold">Shipping</h2>
      <div
        class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
      >
        @for (row of zones; track row.zone) {
          <div class="flex flex-wrap items-end gap-3 p-4">
            <div class="min-w-40 flex-1">
              <span class="block font-medium">{{ row.label }}</span>
              <span class="block text-sm text-ink-muted">{{ row.hint }}</span>
            </div>
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              First item
              <input
                #first
                imeInput
                class="w-24"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.01"
                [value]="valueOf(row.zone, 'firstItemAmount')"
              />
            </label>
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              Each additional
              <input
                #additional
                imeInput
                class="w-24"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.01"
                [value]="valueOf(row.zone, 'additionalItemAmount')"
              />
            </label>
            <button
              imeButton
              variant="secondary"
              size="sm"
              (click)="save(row.zone, first.value, additional.value)"
            >
              Save
            </button>
            @if (rateFor(row.zone)) {
              <button
                imeButton
                variant="ghost"
                size="sm"
                (click)="remove(row.zone)"
              >
                Remove
              </button>
            }
          </div>
        }
      </div>
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </section>
  `,
})
export class ShippingSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedProductResponse>();
  public readonly changed = output<void>();

  protected readonly zones = ZONES;
  protected readonly error = signal<string | null>(null);

  protected rateFor(zone: ShippingZone) {
    return this.managed().shippingRates.find(
      (rate) => rate.destination === zone,
    );
  }

  protected valueOf(
    zone: ShippingZone,
    field: 'firstItemAmount' | 'additionalItemAmount',
  ): string {
    const amount = this.rateFor(zone)?.[field];
    return amount == null ? '' : (amount / 100).toFixed(2);
  }

  protected async save(
    zone: ShippingZone,
    first: string,
    additional: string,
  ): Promise<void> {
    const firstItemAmount = toCents(first);
    const additionalItemAmount = toCents(additional) ?? 0;
    if (firstItemAmount === null) {
      this.error.set('Enter what the first item costs to ship.');
      return;
    }
    this.finish(
      await this.api.merch.setShippingRate(this.managed().product.id, zone, {
        firstItemAmount,
        additionalItemAmount,
      }),
    );
  }

  protected async remove(zone: ShippingZone): Promise<void> {
    this.finish(
      await this.api.merch.removeShippingRate(this.managed().product.id, zone),
    );
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
