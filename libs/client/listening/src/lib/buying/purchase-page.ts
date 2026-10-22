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
import { form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';
import { paymentLabel, shippingLabel } from './purchase-labels';
import { currentValue } from '@ime/client-data';

/**
 * One purchase: what was bought, what it cost, its shipping, and a way to
 * ask the artist for a refund.
 */
@Component({
  selector: 'ime-purchase-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    FieldComponent,
    FormField,
    InputDirective,
    MoneyPipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-6">
      <a class="text-sm text-ink-muted hover:underline" routerLink="/purchases"
        >← Purchases</a
      >
      @if (detail.hasValue() ? detail.value() : null; as detail) {
        <header class="flex flex-col gap-1">
          <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
            @if (detail.artist; as artist) {
              <a
                class="hover:underline"
                [routerLink]="['/artists', artist.handle]"
                >{{ artist.name }}</a
              >
            } @else {
              Purchase
            }
          </h1>
          <p class="text-sm text-ink-muted">
            {{ detail.purchase.createdAt | date: 'medium' }} ·
            {{ statusLabel(detail.purchase.status) }}
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
                  item.unitPrice * item.quantity
                    | money: detail.purchase.currency
                }}</span>
              </li>
            }
          </ul>
          <dl
            class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line p-4 text-sm"
          >
            <dt class="text-ink-muted">Items</dt>
            <dd>{{ itemsTotal() | money: detail.purchase.currency }}</dd>
            @if (detail.purchase.shippingAmount) {
              <dt class="text-ink-muted">Shipping</dt>
              <dd>
                {{
                  detail.purchase.shippingAmount
                    | money: detail.purchase.currency
                }}
              </dd>
            }
            <dt class="text-ink-muted">Tax</dt>
            <dd>
              {{ detail.purchase.taxAmount | money: detail.purchase.currency }}
            </dd>
            <dt class="font-medium">Total</dt>
            <dd class="font-medium">
              {{ detail.purchase.amount | money: detail.purchase.currency }}
            </dd>
          </dl>
        </section>

        @if (detail.fulfillment; as fulfillment) {
          <section
            class="flex flex-col gap-1 rounded-card border border-line bg-surface p-4"
            aria-label="Shipping"
          >
            <span class="font-medium">{{ shipLabel(fulfillment.status) }}</span>
            @if (fulfillment.shippedAt) {
              <span class="text-sm text-ink-muted"
                >Shipped {{ fulfillment.shippedAt | date: 'mediumDate' }}</span
              >
            }
            @if (fulfillment.trackingNumber) {
              <span class="text-sm">
                {{ fulfillment.carrier || 'Tracking' }}:
                {{ fulfillment.trackingNumber }}
              </span>
            }
          </section>
        }

        @if (detail.purchase.status === 'completed') {
          <section class="flex flex-col gap-3" aria-labelledby="refund-heading">
            <h2 id="refund-heading" class="text-lg font-semibold">
              Ask for a refund
            </h2>
            <p class="text-sm text-ink-muted">
              Your message goes to the artist, who decides. A refund removes the
              music from your library.
            </p>
            @if (refundSent()) {
              <ime-alert tone="success"
                >Your request was sent to the artist.</ime-alert
              >
            } @else {
              <form
                class="flex flex-col gap-3"
                novalidate
                (submit)="requestRefund($event)"
              >
                <ime-field
                  label="Message"
                  [errors]="refundForm.message().errors()"
                  [touched]="refundForm.message().touched()"
                >
                  <textarea
                    imeInput
                    rows="3"
                    [formField]="refundForm.message"
                  ></textarea>
                </ime-field>
                @if (refundError(); as message) {
                  <ime-alert tone="error">{{ message }}</ime-alert>
                }
                <div>
                  <button
                    imeButton
                    variant="secondary"
                    type="submit"
                    [busy]="refundForm().submitting()"
                  >
                    Send request
                  </button>
                </div>
              </form>
            }
          </section>
        }
      } @else if (detail.error()) {
        <ime-alert tone="error">This purchase could not be found.</ime-alert>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class PurchasePage {
  private readonly api = inject(ApiClient);

  public readonly artistOrderId = input.required<string>();

  protected readonly detail = resource({
    params: () => this.artistOrderId(),
    loader: async ({ params }) =>
      unwrap(await this.api.orders.getPurchase(params)),
  });

  protected readonly itemsTotal = computed(
    () =>
      currentValue(this.detail)?.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      ) ?? 0,
  );

  private readonly refund = signal({ message: '' });
  protected readonly refundForm = form(this.refund, (path) => {
    required(path.message, { message: 'Tell the artist why.' });
  });
  protected readonly refundSent = signal(false);
  protected readonly refundError = signal<string | null>(null);

  protected readonly statusLabel = paymentLabel;
  protected readonly shipLabel = shippingLabel;

  protected async requestRefund(event: Event): Promise<void> {
    event.preventDefault();
    this.refundError.set(null);
    await submit(this.refundForm, async () => {
      const result = await this.api.orders.requestRefund(
        this.artistOrderId(),
        this.refund().message.trim(),
      );
      if (result.ok) {
        this.refundSent.set(true);
      } else {
        this.refundError.set(result.error.message);
      }
      return undefined;
    });
  }
}
