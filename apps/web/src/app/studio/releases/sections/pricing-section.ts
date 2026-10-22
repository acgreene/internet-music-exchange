import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { ApiClient } from '@ime/api-client';
import type { ManagedReleaseResponse, PricingMode } from '@ime/models';
import { AlertComponent, ButtonDirective } from '@ime/ui';

const MODES: { value: PricingMode; label: string; hint: string }[] = [
  { value: 'free', label: 'Free', hint: 'Anyone can add it to their library.' },
  {
    value: 'fixed',
    label: 'Fixed price',
    hint: 'Buyers pay at least the price, and may pay more.',
  },
  {
    value: 'name_your_price',
    label: 'Name your price',
    hint: 'Buyers choose, at or above a minimum that can be zero.',
  },
];

/** Minor units as a price field shows them, or empty for none. */
const toField = (amount: number | null | undefined) =>
  amount == null ? '' : (amount / 100).toFixed(2);

/** A price field in minor units, null when empty, NaN when not a number. */
const fromField = (value: string) =>
  value.trim() === '' ? null : Math.round(Number(value) * 100);

/**
 * How the release is priced. Paid releases are charged in the artist's
 * selling currency.
 */
@Component({
  selector: 'ime-pricing-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="pricing-heading">
      <h2 id="pricing-heading" class="text-lg font-semibold">Price</h2>
      <div
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
      >
        <fieldset class="flex flex-col gap-2">
          <legend class="sr-only">Pricing</legend>
          @for (option of modes; track option.value) {
            <label
              class="flex items-start gap-3 rounded-control border border-line p-3"
              [class.border-ink]="mode() === option.value"
            >
              <input
                type="radio"
                name="pricing-mode"
                class="mt-1"
                [checked]="mode() === option.value"
                (change)="mode.set(option.value)"
              />
              <span class="flex flex-col">
                <span class="font-medium">{{ option.label }}</span>
                <span class="text-sm text-ink-muted">{{ option.hint }}</span>
              </span>
            </label>
          }
        </fieldset>

        @if (mode() !== 'free') {
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              {{ mode() === 'fixed' ? 'Price' : 'Minimum' }}
              <span
                class="flex items-center gap-2 rounded-control border border-line bg-canvas px-3"
              >
                <span class="text-ink-muted">{{ symbol() }}</span>
                <input
                  class="h-10 w-full bg-transparent outline-none"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0"
                  [value]="minimum()"
                  (input)="minimum.set(value($event))"
                />
              </span>
            </label>
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              Suggested price
              <span
                class="flex items-center gap-2 rounded-control border border-line bg-canvas px-3"
              >
                <span class="text-ink-muted">{{ symbol() }}</span>
                <input
                  class="h-10 w-full bg-transparent outline-none"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  [value]="suggested()"
                  (input)="suggested.set(value($event))"
                />
              </span>
            </label>
          </div>
        }

        @if (saved()) {
          <ime-alert tone="success">Price saved.</ime-alert>
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
            Save price
          </button>
        </div>
      </div>
    </section>
  `,
})
export class PricingSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedReleaseResponse>();
  public readonly changed = output<void>();

  protected readonly modes = MODES;
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly mode = linkedSignal<PricingMode>(
    () => this.managed().pricing?.mode ?? 'name_your_price',
  );
  protected readonly minimum = linkedSignal(() =>
    toField(this.managed().pricing?.minimumPrice ?? 0),
  );
  protected readonly suggested = linkedSignal(() =>
    toField(this.managed().pricing?.suggestedPrice),
  );
  protected readonly symbol = computed(() =>
    this.managed().pricing?.currency === 'eur' ? '€' : '$',
  );

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async save(): Promise<void> {
    this.saved.set(false);
    this.error.set(null);
    const mode = this.mode();
    const minimumPrice = fromField(this.minimum()) ?? 0;
    const suggestedPrice = fromField(this.suggested());
    if (
      Number.isNaN(minimumPrice) ||
      (suggestedPrice !== null && Number.isNaN(suggestedPrice))
    ) {
      this.error.set('Prices must be numbers.');
      return;
    }
    this.saving.set(true);
    const result = await this.api.releases.setPricing(
      this.managed().release.id,
      mode === 'free' ? { mode } : { mode, minimumPrice, suggestedPrice },
    );
    this.saving.set(false);
    if (result.ok) {
      this.saved.set(true);
      this.changed.emit();
    } else {
      this.error.set(result.error.message);
    }
  }
}
