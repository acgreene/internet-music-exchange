import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ApiClient, type ApiResult } from '@ime/api-client';
import type { CloseSummary, PlatformCostRequest } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  MoneyPipe,
} from '@ime/ui';

const CATEGORIES: { value: PlatformCostRequest['category']; label: string }[] =
  [
    { value: 'storage_and_delivery', label: 'Storage and delivery' },
    { value: 'hosting', label: 'Hosting' },
    { value: 'database', label: 'Database' },
    { value: 'other_services', label: 'Other services' },
    { value: 'ownership_guarantee', label: 'Ownership guarantee' },
  ];

/** Dollars as typed, in millionths of a dollar, or NaN. */
const toMicrodollars = (dollars: string) =>
  Math.round(Number(dollars) * 1_000_000);

/** Last month, as a month field shows it. */
function lastMonth(): string {
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The monthly billing close, step by step: open the month at the storage
 * provider's rates, record the platform's bills, then close it to issue and
 * charge every seller's statement.
 */
@Component({
  selector: 'ime-billing-month-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, InputDirective, MoneyPipe],
  template: `
    <div class="flex max-w-3xl flex-col gap-8">
      <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
          Billing months
        </h1>
        <p class="text-sm text-ink-muted">
          Open a month, add its bills as they arrive, then close it. Closing is
          what the public costs page shows.
        </p>
        <label class="mt-2 flex w-48 flex-col gap-1.5 text-sm font-medium">
          Month
          <input
            imeInput
            type="month"
            [value]="month()"
            (input)="setMonth(text($event))"
          />
        </label>
      </div>

      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }

      <section
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
        aria-labelledby="open-heading"
      >
        <div>
          <h2 id="open-heading" class="font-semibold">1. Open it</h2>
          <p class="text-sm text-ink-muted">
            At the storage provider's rates for the month, with nothing added.
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Storage, $ per GB-month
            <input
              imeInput
              class="font-mono"
              inputmode="decimal"
              [value]="storageRate()"
              (input)="storageRate.set(text($event))"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Requests, $ per million
            <input
              imeInput
              class="font-mono"
              inputmode="decimal"
              [value]="requestRate()"
              (input)="requestRate.set(text($event))"
            />
          </label>
        </div>
        @if (done() === 'open') {
          <ime-alert tone="success">{{ monthLabel() }} is open.</ime-alert>
        }
        <div>
          <button
            imeButton
            variant="secondary"
            [busy]="working() === 'open'"
            (click)="open()"
          >
            Open {{ monthLabel() }}
          </button>
        </div>
      </section>

      <section
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
        aria-labelledby="cost-heading"
      >
        <div>
          <h2 id="cost-heading" class="font-semibold">2. Add its bills</h2>
          <p class="text-sm text-ink-muted">
            Each shows on the public costs page under its category.
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)_8rem]">
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Category
            <select imeInput (change)="category.set(selectValue($event))">
              @for (option of categories; track option.value) {
                <option
                  [value]="option.value"
                  [selected]="option.value === category()"
                >
                  {{ option.label }}
                </option>
              }
            </select>
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            What it is
            <input
              imeInput
              placeholder="Hosting provider, October"
              [value]="description()"
              (input)="description.set(text($event))"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Amount, $
            <input
              imeInput
              class="font-mono"
              inputmode="decimal"
              [value]="costAmount()"
              (input)="costAmount.set(text($event))"
            />
          </label>
        </div>
        @if (added().length) {
          <ul
            class="flex flex-col divide-y divide-hairline rounded-control border border-hairline text-sm"
          >
            @for (cost of added(); track $index) {
              <li class="flex justify-between gap-4 px-3 py-2">
                <span>{{ cost.description }}</span>
                <span class="font-mono">{{ cost.amount | money: 'usd' }}</span>
              </li>
            }
          </ul>
        }
        <div>
          <button
            imeButton
            variant="secondary"
            [busy]="working() === 'cost'"
            (click)="addCost()"
          >
            Add the bill
          </button>
        </div>
      </section>

      <section
        class="flex flex-col gap-4 rounded-card border border-danger/40 bg-surface p-4"
        aria-labelledby="close-heading"
      >
        <div>
          <h2 id="close-heading" class="font-semibold">3. Close it</h2>
          <p class="text-sm text-ink-muted">
            Issues every seller's statement and charges their balance, runs auto
            top-ups, and starts grace periods for anyone left below zero. It
            cannot be undone.
          </p>
        </div>
        @if (summary(); as summary) {
          <ime-alert tone="success">
            {{ monthLabel() }} is closed: {{ summary.sellers }} sellers shared
            {{ summary.sharedCostsTotal | money: 'usd' }}
            ({{ summary.sharedPerSeller | money: 'usd' }} each), the reserve
            paid {{ summary.coveredByReserve | money: 'usd' }} of their shares,
            {{ summary.autoTopUps }} auto top-ups ran, and {{ summary.lapsed }}
            sellers lapsed.
          </ime-alert>
          @if (summary.failures.length) {
            <ime-alert tone="error">
              Follow up by hand:
              <span class="font-mono">{{ summary.failures.join(', ') }}</span>
            </ime-alert>
          }
        } @else if (confirmingClose()) {
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <span>Close {{ monthLabel() }} and charge every seller?</span>
            <button
              imeButton
              variant="danger"
              size="sm"
              [busy]="working() === 'close'"
              (click)="close()"
            >
              Close it
            </button>
            <button
              imeButton
              variant="ghost"
              size="sm"
              (click)="confirmingClose.set(false)"
            >
              Not yet
            </button>
          </div>
        } @else {
          <div>
            <button
              imeButton
              variant="danger"
              (click)="confirmingClose.set(true)"
            >
              Close {{ monthLabel() }}
            </button>
          </div>
        }
      </section>

      <section
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
        aria-labelledby="fund-heading"
      >
        <div>
          <h2 id="fund-heading" class="font-semibold">Fund the reserve</h2>
          <p class="text-sm text-ink-muted">
            Record money IME puts in itself. Whatever the reserve holds past
            three months of costs pays sellers' shares at each close, and while
            it can cover a whole month, nobody needs a card or a top-up to sell.
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Amount, $
            <input
              imeInput
              class="font-mono"
              inputmode="decimal"
              [value]="fundAmount()"
              (input)="fundAmount.set(text($event))"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Note
            <input
              imeInput
              placeholder="Launch funding"
              maxlength="200"
              [value]="fundNote()"
              (input)="fundNote.set(text($event))"
            />
          </label>
        </div>
        @if (funded(); as amount) {
          <ime-alert tone="success"
            >{{ amount | money: 'usd' }} is in the reserve.</ime-alert
          >
        }
        <div>
          <button
            imeButton
            variant="secondary"
            [busy]="working() === 'fund'"
            (click)="fund()"
          >
            Add to the reserve
          </button>
        </div>
      </section>
    </div>
  `,
})
export class BillingMonthPage {
  private readonly api = inject(ApiClient);

  protected readonly categories = CATEGORIES;
  protected readonly month = signal(lastMonth());
  protected readonly storageRate = signal('0.015');
  protected readonly requestRate = signal('0.36');
  protected readonly category =
    signal<PlatformCostRequest['category']>('hosting');
  protected readonly description = signal('');
  protected readonly costAmount = signal('');

  protected readonly fundAmount = signal('');
  protected readonly fundNote = signal('');
  protected readonly funded = signal<number | null>(null);

  protected readonly working = signal<
    'open' | 'cost' | 'close' | 'fund' | null
  >(null);
  protected readonly done = signal<'open' | null>(null);
  protected readonly added = signal<PlatformCostRequest[]>([]);
  protected readonly confirmingClose = signal(false);
  protected readonly summary = signal<CloseSummary | null>(null);
  protected readonly error = signal<string | null>(null);

  /** The month as the API names it, its first day. */
  private readonly monthStart = computed(() => `${this.month()}-01`);
  protected readonly monthLabel = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    return year && month
      ? new Date(year, month - 1, 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      : 'the month';
  });

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected setMonth(month: string): void {
    this.month.set(month);
    this.done.set(null);
    this.added.set([]);
    this.summary.set(null);
    this.confirmingClose.set(false);
  }

  protected selectValue(event: Event): PlatformCostRequest['category'] {
    return (event.target as HTMLSelectElement)
      .value as PlatformCostRequest['category'];
  }

  protected async open(): Promise<void> {
    const storage = toMicrodollars(this.storageRate());
    const requests = toMicrodollars(this.requestRate());
    if (
      !Number.isFinite(storage) ||
      !Number.isFinite(requests) ||
      storage < 0 ||
      requests < 0
    ) {
      this.error.set('Rates must be dollar amounts.');
      return;
    }
    const ok = await this.run('open', () =>
      this.api.admin.openBillingPeriod({
        month: this.monthStart(),
        storageMicrodollarsPerGbMonth: storage,
        requestMicrodollarsPerMillion: requests,
      }),
    );
    if (ok) this.done.set('open');
  }

  protected async addCost(): Promise<void> {
    const amount = Math.round(Number(this.costAmount()) * 100);
    const description = this.description().trim();
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      this.error.set('Describe the bill and give its amount.');
      return;
    }
    const cost = { category: this.category(), description, amount };
    const ok = await this.run('cost', () =>
      this.api.admin.addPlatformCost(this.monthStart(), cost),
    );
    if (ok) {
      this.added.update((costs) => [...costs, cost]);
      this.description.set('');
      this.costAmount.set('');
    }
  }

  protected async close(): Promise<void> {
    this.working.set('close');
    this.error.set(null);
    const result = await this.api.admin.closeBillingPeriod(this.monthStart());
    this.working.set(null);
    this.confirmingClose.set(false);
    if (result.ok) this.summary.set(result.data);
    else this.error.set(result.error.message);
  }

  protected async fund(): Promise<void> {
    const amount = Math.round(Number(this.fundAmount()) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.error.set('Give an amount in dollars.');
      return;
    }
    this.funded.set(null);
    const ok = await this.run('fund', () =>
      this.api.admin.fundReserve({
        amount,
        note: this.fundNote().trim() || undefined,
      }),
    );
    if (ok) {
      this.funded.set(amount);
      this.fundAmount.set('');
      this.fundNote.set('');
    }
  }

  private async run(
    kind: 'open' | 'cost' | 'fund',
    call: () => Promise<ApiResult<unknown>>,
  ): Promise<boolean> {
    this.working.set(kind);
    this.error.set(null);
    this.done.set(null);
    const result = await call();
    this.working.set(null);
    if (!result.ok) this.error.set(result.error.message);
    return result.ok;
  }
}
