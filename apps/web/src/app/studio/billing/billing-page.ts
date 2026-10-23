import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import type { BalanceEntryResponse, BillingSettingsRequest } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';
import { CardForm } from './card-form';
import { StripeService } from './stripe.service';

type AutoTopUpMode = 'off' | 'monthly' | 'below_threshold';
type Destination = 'platform' | 'developers';

const ENTRY_LABELS: Record<BalanceEntryResponse['kind'], string> = {
  top_up: 'Top-up',
  monthly_charge: 'Monthly share',
  credit: 'Credit',
  withdrawal: 'Refund to card',
  adjustment: 'Adjustment',
};

/** Dollars as typed, in cents, or null when not a usable amount. */
const toCents = (value: string): number | null => {
  const amount = Math.round(Number(value) * 100);
  return value.trim() === '' || !Number.isFinite(amount) || amount < 0
    ? null
    : amount;
};
const isApproval = (
  data: unknown,
): data is { status: 'requires_action'; clientSecret: string } =>
  typeof data === 'object' &&
  data !== null &&
  (data as { status?: unknown }).status === 'requires_action';

const toDollars = (cents: number | null | undefined) =>
  cents == null ? '' : (cents / 100).toFixed(2);

/**
 * The signed-in seller's hosting balance: the card, top-ups, automatic
 * top-ups, alerts, and monthly statements. It pays for every artist and
 * design they host.
 */
@Component({
  selector: 'ime-billing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CardForm,
    DatePipe,
    MoneyPipe,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
          Hosting balance
        </h1>
        <p class="text-sm text-ink-muted">
          IME runs at cost. Each month you pay for what your artists and designs
          store and serve, plus an even share of the costs that keep the lights
          on. Never a cut of your sales.
        </p>
      </div>

      @if (overview.error()) {
        <ime-alert tone="error">Your balance could not be loaded.</ime-alert>
      } @else if (data(); as data) {
        @if (data.billing?.lapsedAt) {
          <ime-alert tone="error">
            Your balance is below zero. Top up within the grace period to keep
            everything you host on sale.
          </ime-alert>
        }

        <section
          class="grid gap-4 sm:grid-cols-2"
          aria-label="Balance and card"
        >
          <div
            class="flex flex-col gap-1 rounded-card border border-line bg-surface p-4"
          >
            <span class="text-sm text-ink-muted">Balance</span>
            <span
              class="text-3xl font-semibold tabular-nums"
              [class.text-danger]="data.balance < 0"
            >
              {{ data.balance | money: 'usd' }}
            </span>
          </div>
          <div
            class="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
          >
            <span class="text-sm text-ink-muted">Card</span>
            @if (addingCard()) {
              <ime-card-form
                (saved)="cardSaved()"
                (cancelled)="addingCard.set(false)"
              />
            } @else if (data.hasCard) {
              <span class="font-medium">A card is on file</span>
              <div class="flex gap-2">
                <button
                  imeButton
                  variant="secondary"
                  size="sm"
                  (click)="addingCard.set(true)"
                >
                  Replace
                </button>
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  (click)="removeCard()"
                >
                  Remove
                </button>
              </div>
            } @else {
              <span class="text-sm"
                >Add a card to top up and to put things on sale.</span
              >
              <div>
                <button imeButton size="sm" (click)="addingCard.set(true)">
                  Add a card
                </button>
              </div>
            }
          </div>
        </section>

        @if (data.hasCard) {
          <section class="flex flex-col gap-3" aria-labelledby="topup-heading">
            <h2 id="topup-heading" class="text-lg font-semibold">Top up</h2>
            <form
              class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
              (submit)="topUp($event)"
            >
              <label class="flex flex-col gap-1.5 text-sm font-medium">
                Amount
                <span
                  class="flex w-48 items-center gap-2 rounded-control border border-line bg-canvas px-3"
                >
                  <span class="text-ink-muted">$</span>
                  <input
                    class="h-10 w-full bg-transparent outline-none"
                    type="number"
                    inputmode="decimal"
                    min="1"
                    step="0.01"
                    [value]="topUpAmount()"
                    (input)="topUpAmount.set(text($event))"
                  />
                </span>
              </label>
              <fieldset class="flex flex-col gap-2 text-sm">
                <legend class="font-medium">
                  Something extra, if you like
                </legend>
                <p class="text-ink-muted">
                  Completely optional, and it changes nothing about your
                  account.
                </p>
                <span
                  class="flex w-48 items-center gap-2 rounded-control border border-line bg-canvas px-3"
                >
                  <span class="text-ink-muted">$</span>
                  <input
                    class="h-10 w-full bg-transparent outline-none"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="0.01"
                    aria-label="Extra amount"
                    [value]="extraAmount()"
                    (input)="extraAmount.set(text($event))"
                  />
                </span>
                @if (extraCents()) {
                  <label class="flex items-center gap-2">
                    <input
                      type="radio"
                      name="extra-destination"
                      [checked]="extraDestination() === 'platform'"
                      (change)="extraDestination.set('platform')"
                    />
                    To the platform: it goes into the reserve and lowers
                    everyone's share
                  </label>
                  <label class="flex items-center gap-2">
                    <input
                      type="radio"
                      name="extra-destination"
                      [checked]="extraDestination() === 'developers'"
                      (change)="extraDestination.set('developers')"
                    />
                    To the developers: supports the people building IME
                  </label>
                }
              </fieldset>
              @if (topUpDone()) {
                <ime-alert tone="success">Your balance is topped up.</ime-alert>
              }
              <div>
                <button imeButton type="submit" [busy]="working() === 'topUp'">
                  Top up
                </button>
              </div>
            </form>
          </section>
        }

        @if (data.billing; as billing) {
          <section
            class="flex flex-col gap-3"
            aria-labelledby="settings-heading"
          >
            <h2 id="settings-heading" class="text-lg font-semibold">
              Alerts and automatic top-ups
            </h2>
            <div
              class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 text-sm"
            >
              <label class="flex flex-col gap-1.5 font-medium">
                Email me when my balance falls below
                <span
                  class="flex w-48 items-center gap-2 rounded-control border border-line bg-canvas px-3"
                >
                  <span class="text-ink-muted">$</span>
                  <input
                    class="h-10 w-full bg-transparent font-normal outline-none"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="No alert"
                    [value]="alertAmount()"
                    (input)="alertAmount.set(text($event))"
                  />
                </span>
              </label>
              <fieldset class="flex flex-col gap-2">
                <legend class="font-medium">Top up automatically</legend>
                @for (option of autoModes; track option.value) {
                  <label class="flex items-center gap-2">
                    <input
                      type="radio"
                      name="auto-mode"
                      [checked]="autoMode() === option.value"
                      (change)="autoMode.set(option.value)"
                    />
                    {{ option.label }}
                  </label>
                }
              </fieldset>
              @if (autoMode() !== 'off') {
                <label class="flex flex-col gap-1.5 font-medium">
                  Amount each time
                  <span
                    class="flex w-48 items-center gap-2 rounded-control border border-line bg-canvas px-3"
                  >
                    <span class="text-ink-muted">$</span>
                    <input
                      class="h-10 w-full bg-transparent font-normal outline-none"
                      type="number"
                      inputmode="decimal"
                      min="1"
                      step="0.01"
                      [value]="autoAmount()"
                      (input)="autoAmount.set(text($event))"
                    />
                  </span>
                </label>
              }
              @if (settingsSaved()) {
                <ime-alert tone="success">Saved.</ime-alert>
              }
              <div>
                <button
                  imeButton
                  variant="secondary"
                  [busy]="working() === 'settings'"
                  (click)="saveSettings()"
                >
                  Save
                </button>
              </div>
            </div>
          </section>
        }

        <section
          class="flex flex-col gap-3"
          aria-labelledby="statements-heading"
        >
          <h2 id="statements-heading" class="text-lg font-semibold">
            Monthly statements
          </h2>
          <ul
            class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
          >
            @for (statement of data.statements; track statement.id) {
              <li>
                <details class="group p-4">
                  <summary
                    class="flex cursor-pointer items-center justify-between gap-4"
                  >
                    <span class="font-medium">{{
                      statement.month | date: 'MMMM y' : 'UTC'
                    }}</span>
                    <span class="tabular-nums">{{
                      statement.totalAmount | money: 'usd'
                    }}</span>
                  </summary>
                  <dl
                    class="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm"
                  >
                    <dt class="text-ink-muted">Your usage</dt>
                    <dd class="tabular-nums">
                      {{ statement.usageAmount | money: 'usd' }}
                    </dd>
                    <dt class="text-ink-muted">Your share of shared costs</dt>
                    <dd class="tabular-nums">
                      {{ statement.sharedAmount | money: 'usd' }}
                    </dd>
                    @if (statement.subsidyAmount) {
                      <dt class="text-ink-muted">Covered by IME's creators</dt>
                      <dd class="tabular-nums">
                        −{{ statement.subsidyAmount | money: 'usd' }}
                      </dd>
                    }
                    <dt class="text-ink-muted">Card fees</dt>
                    <dd class="tabular-nums">
                      {{ statement.cardFeesAmount | money: 'usd' }}
                    </dd>
                  </dl>
                  @if (statement.lines.length) {
                    <table class="mt-3 w-full text-sm">
                      <thead class="text-left text-ink-muted">
                        <tr>
                          <th class="py-1 font-normal">What you host</th>
                          <th class="py-1 font-normal">Your share</th>
                          <th class="py-1 text-right font-normal">Usage</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (line of statement.lines; track $index) {
                          <tr class="border-t border-line">
                            <td class="py-1">{{ line.name }}</td>
                            <td class="py-1">
                              {{ line.shareBasisPoints / 100 }}%
                            </td>
                            <td class="py-1 text-right tabular-nums">
                              {{ line.amount | money: 'usd' }}
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </details>
              </li>
            } @empty {
              <li class="p-4 text-sm text-ink-muted">
                Statements appear here after each month closes.
              </li>
            }
          </ul>
        </section>

        @if (data.recentEntries.length) {
          <section
            class="flex flex-col gap-3"
            aria-labelledby="activity-heading"
          >
            <h2 id="activity-heading" class="text-lg font-semibold">
              Recent activity
            </h2>
            <ul
              class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface text-sm"
            >
              @for (entry of data.recentEntries; track entry.id) {
                <li class="flex items-center justify-between gap-4 p-3">
                  <span>
                    {{ entryLabel(entry.kind) }}
                    <span class="text-ink-muted"
                      >({{ entry.createdAt | date: 'mediumDate' }})</span
                    >
                  </span>
                  <span
                    class="tabular-nums"
                    [class.text-success]="entry.amount > 0"
                  >
                    {{ entry.amount > 0 ? '+' : ''
                    }}{{ entry.amount | money: 'usd' }}
                  </span>
                </li>
              }
            </ul>
          </section>
        }

        @if (data.balance > 0) {
          <section class="flex flex-col gap-2" aria-labelledby="refund-heading">
            <h2 id="refund-heading" class="text-lg font-semibold">Leaving?</h2>
            <p class="text-sm text-ink-muted">
              Once nothing you pay for is on sale, you can get your unused
              balance back on your card.
            </p>
            <div>
              <button
                imeButton
                variant="secondary"
                [busy]="working() === 'refund'"
                (click)="refundBalance()"
              >
                Refund my balance
              </button>
            </div>
          </section>
        }
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class BillingPage {
  private readonly api = inject(ApiClient);
  private readonly stripe = inject(StripeService);

  protected readonly overview = resource({
    loader: async () => unwrap(await this.api.funding.getBilling()),
  });
  protected readonly data = computed(() => currentValue(this.overview));

  protected readonly autoModes: { value: AutoTopUpMode; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'monthly', label: 'Every month' },
    {
      value: 'below_threshold',
      label: 'Whenever it falls below my alert amount',
    },
  ];

  protected readonly addingCard = signal(false);
  protected readonly working = signal<'topUp' | 'settings' | 'refund' | null>(
    null,
  );
  protected readonly error = signal<string | null>(null);

  protected readonly topUpAmount = signal('10.00');
  protected readonly extraAmount = signal('0');
  protected readonly extraDestination = signal<Destination | null>(null);
  protected readonly extraCents = computed(
    () => toCents(this.extraAmount()) ?? 0,
  );
  protected readonly topUpDone = signal(false);
  /** The secret a top-up's approval is finished with. */
  private pendingApproval: string | null = null;

  private readonly billing = computed(() => this.data()?.billing ?? null);
  protected readonly alertAmount = linkedSignal(() =>
    toDollars(this.billing()?.alertThresholdAmount),
  );
  protected readonly autoMode = linkedSignal<AutoTopUpMode>(
    () => this.billing()?.autoTopUpMode ?? 'off',
  );
  protected readonly autoAmount = linkedSignal(() =>
    toDollars(this.billing()?.autoTopUpAmount ?? 1000),
  );
  protected readonly settingsSaved = signal(false);

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected entryLabel(kind: BalanceEntryResponse['kind']): string {
    return ENTRY_LABELS[kind];
  }

  protected cardSaved(): void {
    this.addingCard.set(false);
    this.overview.reload();
  }

  protected async removeCard(): Promise<void> {
    await this.run(null, () => this.api.funding.removeCard());
  }

  protected async topUp(event: Event): Promise<void> {
    event.preventDefault();
    this.topUpDone.set(false);
    const amount = toCents(this.topUpAmount());
    const extra = this.extraCents();
    if (!amount) {
      this.error.set('Enter how much to add.');
      return;
    }
    if (extra && !this.extraDestination()) {
      this.error.set('Choose where your extra goes, or set it to nothing.');
      return;
    }
    const done = await this.run('topUp', () =>
      this.api.funding.topUp({
        amount,
        ...(extra
          ? {
              extraAmount: extra,
              extraDestination: this.extraDestination() ?? undefined,
            }
          : {}),
      }),
    );
    if (done === 'requires_action') {
      await this.approveTopUp();
      return;
    }
    if (done) {
      this.topUpDone.set(true);
      this.extraAmount.set('0');
      this.extraDestination.set(null);
    }
  }

  /**
   * Let the card holder approve a top-up their bank stopped, in Stripe's own
   * window, then show the new balance.
   */
  private async approveTopUp(): Promise<void> {
    const clientSecret = this.pendingApproval;
    this.pendingApproval = null;
    const stripe = clientSecret ? await this.stripe.load() : null;
    if (!stripe || !clientSecret) {
      this.error.set(
        'Your bank needs to approve this top-up, but Stripe could not be loaded.',
      );
      return;
    }
    const { error } = await stripe.handleNextAction({ clientSecret });
    if (error) {
      this.error.set(error.message ?? 'The top-up was not approved.');
      return;
    }
    this.topUpDone.set(true);
    this.overview.reload();
  }

  protected async saveSettings(): Promise<void> {
    this.settingsSaved.set(false);
    const settings: BillingSettingsRequest = {
      alertThresholdAmount: toCents(this.alertAmount()),
      alertThresholdPercent: null,
      autoTopUpMode: this.autoMode(),
      autoTopUpAmount:
        this.autoMode() === 'off' ? null : toCents(this.autoAmount()),
    };
    const done = await this.run('settings', () =>
      this.api.funding.updateSettings(settings),
    );
    if (done) this.settingsSaved.set(true);
  }

  protected async refundBalance(): Promise<void> {
    await this.run('refund', () => this.api.funding.refundBalance());
  }

  /**
   * Make a call, showing its error or reloading the balance after it.
   *
   * @returns Whether it worked, or that a top-up awaits the card holder's
   * approval.
   */
  private async run(
    kind: 'topUp' | 'settings' | 'refund' | null,
    call: () => Promise<ApiResult<unknown>>,
  ): Promise<boolean | 'requires_action'> {
    this.working.set(kind);
    this.error.set(null);
    const result = await call();
    this.working.set(null);
    if (!result.ok) {
      this.error.set(result.error.message);
      return false;
    }
    if (isApproval(result.data)) {
      this.pendingApproval = result.data.clientSecret;
      return 'requires_action';
    }
    this.overview.reload();
    return true;
  }
}
