import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { paymentLabel, shippingLabel } from '@ime/client-listening';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';
import { StudioService } from '../studio.service';

/**
 * One sale: what was bought, by whom, where it ships, and the actions on it:
 * ship, mark delivered, refund.
 */
@Component({
  selector: 'ime-sale-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    InputDirective,
    MoneyPipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-3xl flex-col gap-6">
      <a
        class="text-sm text-ink-muted hover:underline"
        [routerLink]="['/studio/artists', studio.currentArtistId(), 'sales']"
        >← Sales</a
      >
      @if (sale.error()) {
        <ime-alert tone="error">This sale could not be found.</ime-alert>
      } @else if (detail(); as detail) {
        <header class="flex flex-col gap-1">
          <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
            {{ detail.buyerName || 'A buyer' }}
          </h1>
          <p class="text-sm text-ink-muted">
            {{ detail.sale.createdAt | date: 'medium' }},
            {{ statusLabel(detail.sale.status) }}
          </p>
        </header>

        <section
          class="rounded-card border border-line bg-surface"
          aria-label="Items"
        >
          <ul class="flex flex-col divide-y divide-hairline">
            @for (item of detail.items; track item.id) {
              <li class="flex items-center justify-between gap-4 p-4">
                <span class="flex flex-col">
                  <span class="font-medium">{{ item.name }}</span>
                  @if (item.variantLabel || item.quantity > 1) {
                    <span class="text-sm text-ink-muted">
                      {{ item.variantLabel }}
                      @if (item.quantity > 1) {
                        × {{ item.quantity }}
                      }
                    </span>
                  }
                </span>
                <span>{{
                  item.unitPrice * item.quantity | money: detail.sale.currency
                }}</span>
              </li>
            }
          </ul>
          <dl
            class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line p-4 text-sm"
          >
            @if (detail.sale.shippingAmount) {
              <dt class="text-ink-muted">Shipping</dt>
              <dd>
                {{ detail.sale.shippingAmount | money: detail.sale.currency }}
              </dd>
            }
            <dt class="text-ink-muted">Tax</dt>
            <dd>{{ detail.sale.taxAmount | money: detail.sale.currency }}</dd>
            <dt class="font-medium">Total</dt>
            <dd class="font-medium">
              {{ detail.sale.amount | money: detail.sale.currency }}
            </dd>
          </dl>
        </section>

        @if (detail.shippingAddress; as address) {
          <section
            class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
            aria-labelledby="ship-heading"
          >
            <h2 id="ship-heading" class="font-semibold">Shipping</h2>
            <address class="text-sm whitespace-pre-line not-italic">
              {{ addressLines() }}
            </address>
            @if (detail.fulfillment; as fulfillment) {
              <p class="text-sm">
                <span class="font-medium">{{
                  shipLabel(fulfillment.status)
                }}</span>
                @if (fulfillment.shippedAt) {
                  <span
                    >, shipped
                    {{ fulfillment.shippedAt | date: 'mediumDate' }}</span
                  >
                }
                @if (fulfillment.trackingNumber) {
                  <span
                    >, {{ fulfillment.carrier || 'Tracking' }}
                    {{ fulfillment.trackingNumber }}</span
                  >
                }
              </p>
              @if (detail.sale.status === 'completed') {
                @if (fulfillment.status === 'unfulfilled') {
                  <form
                    class="flex flex-wrap items-end gap-2"
                    novalidate
                    (submit)="ship($event)"
                  >
                    <label class="flex flex-col gap-1.5 text-sm font-medium">
                      Carrier
                      <input
                        imeInput
                        class="w-40"
                        placeholder="Optional"
                        [value]="carrier()"
                        (input)="carrier.set(text($event))"
                      />
                    </label>
                    <label
                      class="flex flex-1 flex-col gap-1.5 text-sm font-medium"
                    >
                      Tracking number
                      <input
                        imeInput
                        placeholder="Optional"
                        [value]="tracking()"
                        (input)="tracking.set(text($event))"
                      />
                    </label>
                    <button
                      imeButton
                      type="submit"
                      [busy]="working() === 'ship'"
                    >
                      Mark shipped
                    </button>
                  </form>
                  <p class="text-sm text-ink-muted">
                    The buyer is emailed when you mark it shipped.
                  </p>
                } @else if (fulfillment.status === 'shipped') {
                  <div>
                    <button
                      imeButton
                      variant="secondary"
                      [busy]="working() === 'deliver'"
                      (click)="deliver()"
                    >
                      Mark delivered
                    </button>
                  </div>
                }
              }
            }
          </section>
        }

        @if (detail.sale.status === 'completed') {
          <section class="flex flex-col gap-3" aria-labelledby="refund-heading">
            <h2 id="refund-heading" class="text-lg font-semibold">Refund</h2>
            <p class="text-sm text-ink-muted">
              Refunds the whole sale from your Stripe account. The buyer loses
              any music it gave them, and merch goes back into stock.
            </p>
            @if (confirmingRefund()) {
              <div
                class="flex flex-wrap items-center gap-3 rounded-card border border-danger/40 bg-danger/10 p-3 text-sm"
              >
                <span
                  >Refund
                  {{ detail.sale.amount | money: detail.sale.currency }} to the
                  buyer?</span
                >
                <button
                  imeButton
                  variant="danger"
                  size="sm"
                  [busy]="working() === 'refund'"
                  (click)="refund()"
                >
                  Refund
                </button>
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  (click)="confirmingRefund.set(false)"
                >
                  Cancel
                </button>
              </div>
            } @else {
              <div>
                <button
                  imeButton
                  variant="secondary"
                  (click)="confirmingRefund.set(true)"
                >
                  Refund this sale
                </button>
              </div>
            }
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
export class SalePage {
  private readonly api = inject(ApiClient);
  protected readonly studio = inject(StudioService);

  public readonly artistOrderId = input.required<string>();

  protected readonly sale = resource({
    params: () => this.artistOrderId(),
    loader: async ({ params }) => unwrap(await this.api.orders.getSale(params)),
  });
  protected readonly detail = computed(() => currentValue(this.sale));

  protected readonly addressLines = computed(() => {
    const address = this.detail()?.shippingAddress;
    if (!address) return '';
    return [
      address.name,
      address.line1,
      address.line2,
      [address.city, address.state, address.postalCode]
        .filter(Boolean)
        .join(' '),
      address.country,
    ]
      .filter(Boolean)
      .join('\n');
  });

  protected readonly carrier = signal('');
  protected readonly tracking = signal('');
  protected readonly confirmingRefund = signal(false);
  protected readonly working = signal<'ship' | 'deliver' | 'refund' | null>(
    null,
  );
  protected readonly error = signal<string | null>(null);

  protected readonly statusLabel = paymentLabel;
  protected readonly shipLabel = shippingLabel;

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async ship(event: Event): Promise<void> {
    event.preventDefault();
    await this.act('ship', () =>
      this.api.orders.markShipped(this.artistOrderId(), {
        carrier: this.carrier().trim() || null,
        trackingNumber: this.tracking().trim() || null,
      }),
    );
  }

  protected async deliver(): Promise<void> {
    await this.act('deliver', () =>
      this.api.orders.markDelivered(this.artistOrderId()),
    );
  }

  protected async refund(): Promise<void> {
    await this.act('refund', () =>
      this.api.orders.refund(this.artistOrderId()),
    );
    this.confirmingRefund.set(false);
  }

  private async act(
    kind: 'ship' | 'deliver' | 'refund',
    call: () => Promise<ApiResult<unknown>>,
  ): Promise<void> {
    this.working.set(kind);
    this.error.set(null);
    const result = await call();
    this.working.set(null);
    if (result.ok) this.sale.reload();
    else this.error.set(result.error.message);
  }
}
