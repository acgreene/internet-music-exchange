import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
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
const NAME_MAX_LENGTH = 60;

/** Quick splits between hosting and the developers, as hosting's share. */
const SPLITS = [
  { hosting: 100, label: 'All to hosting' },
  { hosting: 50, label: 'Half and half' },
  { hosting: 0, label: 'All to developers' },
];

/**
 * Giving beyond anyone's share, `/donate`: once or monthly, split however
 * the giver likes between the platform's hosting and its developers, with
 * their name on the month's thank-you list if they want it there.
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
          IME runs at cost on what its sellers contribute. A gift to its hosting
          pays real bills and lowers every seller's share.
        </p>
        <p class="text-sm text-ink-muted">
          Giving never buys features or placement. You can always
          <a class="link" routerLink="/costs">see where the money goes</a>.
        </p>
      </header>

      @if (thanks()) {
        <ime-alert tone="success"
          >Thank you. Your gift is on its way, and a thank-you note is in your
          inbox.</ime-alert
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
          <div class="flex flex-wrap gap-2">
            @for (split of splits; track split.hosting) {
              <button
                imeButton
                type="button"
                size="sm"
                [variant]="
                  hosting() === split.hosting ? 'primary' : 'secondary'
                "
                [attr.aria-pressed]="hosting() === split.hosting"
                (click)="hosting.set(split.hosting)"
              >
                {{ split.label }}
              </button>
            }
          </div>
          <label class="flex flex-col gap-2 text-sm">
            <span class="sr-only">Share to IME's hosting, in percent</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              class="w-full accent-[var(--color-accent)]"
              [value]="hosting()"
              (input)="hosting.set(count($event))"
            />
          </label>
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div
              class="flex flex-col gap-0.5 rounded-control border border-line bg-canvas p-3"
            >
              <dt class="font-medium">IME's hosting</dt>
              <dd class="font-mono text-lg">
                {{ parts().platform | money: 'usd' }}
                <span class="text-sm text-ink-muted">{{ hosting() }}%</span>
              </dd>
              <dd class="text-ink-muted">
                Pays real bills and lowers every seller's share.
              </dd>
            </div>
            <div
              class="flex flex-col gap-0.5 rounded-control border border-line bg-canvas p-3"
            >
              <dt class="font-medium">IME's developers</dt>
              <dd class="font-mono text-lg">
                {{ parts().developers | money: 'usd' }}
                <span class="text-sm text-ink-muted"
                  >{{ 100 - hosting() }}%</span
                >
              </dd>
              <dd class="text-ink-muted">
                Optional. Supports the people building IME, kept apart from the
                platform's money.
              </dd>
            </div>
          </dl>
        </fieldset>

        <fieldset class="flex flex-col gap-3">
          <legend class="mb-2 text-sm font-semibold">Thank-you list</legend>
          <label class="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              class="mt-0.5"
              [checked]="listed()"
              (change)="listed.set(checked($event))"
            />
            <span>
              Put my name on this month's thank-you list
              <span class="block text-ink-muted"
                >Names only. Amounts and where they went stay private.</span
              >
            </span>
          </label>
          @if (listed()) {
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              Name to show
              <input
                class="h-10 rounded-control border border-line bg-canvas px-3"
                type="text"
                autocomplete="name"
                [attr.maxlength]="nameMaxLength"
                [value]="name()"
                (input)="name.set(text($event))"
              />
            </label>
          }
        </fieldset>

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
            You pay on Stripe's page, and a thank-you note follows by email. A
            monthly gift can be cancelled any time. IME is an LLC run at cost,
            so gifts are not tax-deductible.
          </p>
        </div>
      </form>
    </div>
  `,
})
export class DonatePage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);

  /** Set by Stripe when a donor comes back from paying. */
  public readonly thanks = input<string>();

  protected readonly presets = PRESETS;
  protected readonly splits = SPLITS;
  protected readonly nameMaxLength = NAME_MAX_LENGTH;
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
  /** Hosting's share of the gift, in percent; the developers get the rest. */
  protected readonly hosting = signal(100);
  protected readonly listed = signal(false);
  /** Starts as the account's name, for a donor who is signed in. */
  protected readonly name = linkedSignal(() => this.session.user()?.name ?? '');
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

  protected readonly parts = computed(() => {
    const total = this.cents() ?? 0;
    const platform = Math.round((total * this.hosting()) / 100);
    return { platform, developers: total - platform };
  });

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected count(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected pick(preset: number): void {
    this.amount.set(preset);
    this.custom.set('');
  }

  protected async give(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.cents()) {
      this.error.set(
        `Gifts are between $${MIN_GIFT / 100} and $${MAX_GIFT / 100}.`,
      );
      return;
    }
    const thanksName = this.name().trim();
    if (this.listed() && !thanksName) {
      this.error.set('Add the name to show on the thank-you list.');
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    const result = await this.api.funding.donate({
      cadence: this.cadence(),
      ...this.parts(),
      thanksName: this.listed() ? thanksName : undefined,
    });
    if (result.ok) {
      window.location.assign(result.data.url);
      return;
    }
    this.sending.set(false);
    this.error.set(result.error.message);
  }
}
