import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import type { DonationRequest } from '@ime/models';
import { AlertComponent, ButtonDirective, MoneyPipe } from '@ime/ui';

const PRESETS = [500, 1000, 2500, 5000];
const MIN_GIFT = 100;
const MAX_GIFT = 100_000;

/**
 * Giving beyond anyone's share, `/donate`: once or monthly, to the
 * platform's hosting or, if someone chooses, to its developers.
 */
@Component({
  selector: 'ime-donate-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, MoneyPipe, RouterLink],
  template: `
    <div class="mx-auto flex max-w-xl flex-col gap-8">
      <header class="flex flex-col gap-3">
        <h1 class="text-5xl leading-[0.95] font-black tracking-[-0.05em]">
          Chip in
        </h1>
        <p class="text-lg">
          IME runs at cost on what its sellers contribute. A gift to the
          platform goes into its reserve and lowers every seller's share.
        </p>
        <p class="text-sm text-ink-muted">
          Giving never buys features or placement. You can always
          <a class="link" routerLink="/costs">see where the money goes</a>.
        </p>
      </header>

      @if (thanks()) {
        <ime-alert tone="success"
          >Thank you. Your gift is on its way.</ime-alert
        >
      }

      <form
        class="flex flex-col gap-6 rounded-card border border-line bg-surface p-5"
        (submit)="give($event)"
      >
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-sm font-semibold">How often</legend>
          <div class="flex gap-2">
            @for (option of cadences; track option.value) {
              <button
                imeButton
                type="button"
                size="sm"
                [variant]="cadence() === option.value ? 'primary' : 'secondary'"
                [attr.aria-pressed]="cadence() === option.value"
                (click)="cadence.set(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </fieldset>

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-sm font-semibold">Amount</legend>
          <div class="flex flex-wrap gap-2">
            @for (preset of presets; track preset) {
              <button
                imeButton
                type="button"
                size="sm"
                class="font-mono"
                [variant]="
                  amount() === preset && !custom() ? 'primary' : 'secondary'
                "
                [attr.aria-pressed]="amount() === preset && !custom()"
                (click)="pick(preset)"
              >
                {{ preset | money: 'usd' }}
              </button>
            }
          </div>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Or another amount
            <span
              class="flex w-40 items-center gap-2 rounded-control border border-line bg-canvas px-3"
            >
              <span class="text-ink-muted">$</span>
              <input
                class="h-10 w-full bg-transparent font-mono outline-none"
                type="number"
                inputmode="decimal"
                min="1"
                max="1000"
                step="1"
                [value]="custom()"
                (input)="custom.set(text($event))"
              />
            </span>
          </label>
        </fieldset>

        <fieldset class="flex flex-col gap-3">
          <legend class="mb-2 text-sm font-semibold">Where it goes</legend>
          <label class="flex items-start gap-3">
            <input
              type="radio"
              name="destination"
              class="mt-1"
              [checked]="destination() === 'platform'"
              (change)="destination.set('platform')"
            />
            <span>
              <span class="font-medium">IME's hosting</span>
              <span class="block text-sm text-ink-muted"
                >Pays real bills and lowers every seller's share.</span
              >
            </span>
          </label>
          <label class="flex items-start gap-3">
            <input
              type="radio"
              name="destination"
              class="mt-1"
              [checked]="destination() === 'developers'"
              (change)="destination.set('developers')"
            />
            <span>
              <span class="font-medium">IME's developers</span>
              <span class="block text-sm text-ink-muted">
                Entirely optional. Supports the people building IME, kept apart
                from the platform's money.
              </span>
            </span>
          </label>
        </fieldset>

        @if (session.isSignedIn()) {
          <label class="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              [checked]="anonymous()"
              (change)="anonymous.set(checked($event))"
            />
            Leave my name off this gift
          </label>
        }

        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div class="flex flex-col gap-2">
          <div>
            <button
              imeButton
              type="submit"
              [disabled]="!cents()"
              [busy]="sending()"
            >
              @if (cents(); as cents) {
                Give {{ cents | money: 'usd'
                }}{{ cadence() === 'monthly' ? ' a month' : '' }}
              } @else {
                Give
              }
            </button>
          </div>
          <p class="text-xs text-ink-muted">
            You pay on Stripe's page. A monthly gift can be cancelled any time.
            IME is an LLC run at cost, so gifts are not tax-deductible.
          </p>
        </div>
      </form>
    </div>
  `,
})
export class DonatePage {
  private readonly api = inject(ApiClient);
  protected readonly session = inject(SessionService);

  /** Set by Stripe when a donor comes back from paying. */
  public readonly thanks = input<string>();

  protected readonly presets = PRESETS;
  protected readonly cadences: {
    value: DonationRequest['cadence'];
    label: string;
  }[] = [
    { value: 'one_time', label: 'Once' },
    { value: 'monthly', label: 'Monthly' },
  ];

  protected readonly cadence = signal<DonationRequest['cadence']>('one_time');
  protected readonly amount = signal(PRESETS[1]);
  protected readonly custom = signal('');
  protected readonly destination =
    signal<DonationRequest['destination']>('platform');
  protected readonly anonymous = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The gift in cents, or null while the amount is not a valid one. */
  protected readonly cents = computed(() => {
    const custom = this.custom().trim();
    const cents = custom ? Math.round(Number(custom) * 100) : this.amount();
    return Number.isInteger(cents) && cents >= MIN_GIFT && cents <= MAX_GIFT
      ? cents
      : null;
  });

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected pick(preset: number): void {
    this.amount.set(preset);
    this.custom.set('');
  }

  protected async give(event: Event): Promise<void> {
    event.preventDefault();
    const amount = this.cents();
    if (!amount) {
      this.error.set(
        `Gifts are between $${MIN_GIFT / 100} and $${MAX_GIFT / 100}.`,
      );
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    const result = await this.api.funding.donate({
      destination: this.destination(),
      cadence: this.cadence(),
      amount,
      anonymous: this.session.isSignedIn() ? this.anonymous() : undefined,
    });
    if (result.ok) {
      window.location.assign(result.data.url);
      return;
    }
    this.sending.set(false);
    this.error.set(result.error.message);
  }
}
