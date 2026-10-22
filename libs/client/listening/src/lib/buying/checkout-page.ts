import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '@ime/client-data';
import { AlertComponent, ButtonDirective, MoneyPipe } from '@ime/ui';

/**
 * A checkout's payments, made one artist at a time on Stripe's pages, which
 * send the buyer back here with `?paid=` or `?cancelled=` and the artist.
 */
@Component({
  selector: 'ime-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, MoneyPipe, RouterLink],
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Checkout</h1>

      @if (checkout(); as checkout) {
        @if (checkout.claimedCount) {
          <ime-alert tone="success">
            {{
              checkout.claimedCount === 1
                ? 'A free release is'
                : checkout.claimedCount + ' free releases are'
            }}
            now in your library.
          </ime-alert>
        }
        @if (cancelledArtist(); as artistName) {
          <ime-alert
            >The payment to {{ artistName }} was cancelled. You can try again
            below.</ime-alert
          >
        }

        @if (checkout.payments.length) {
          <ol
            class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
          >
            @for (
              payment of checkout.payments;
              track payment.artistId;
              let index = $index
            ) {
              <li class="flex items-center justify-between gap-4 p-4">
                <div class="flex flex-col">
                  <span class="font-medium"
                    >{{ index + 1 }}. {{ payment.artistName }}</span
                  >
                  <span class="text-sm text-ink-muted">
                    {{ payment.subtotal | money: payment.currency }}
                    @if (payment.shipping) {
                      plus
                      {{ payment.shipping | money: payment.currency }} shipping
                    }
                    and any tax
                  </span>
                </div>
                @if (checkout.paidArtistIds.includes(payment.artistId)) {
                  <span class="text-sm font-medium text-success">Paid</span>
                } @else if (payment.artistId === nextArtistId()) {
                  <a imeButton [href]="payment.url"
                    >Pay {{ payment.artistName }}</a
                  >
                } @else {
                  <span class="text-sm text-ink-muted">Next</span>
                }
              </li>
            }
          </ol>
        }

        @if (!nextArtistId()) {
          <div class="flex flex-col gap-3">
            <p>
              Thank you. Your music appears in your library as soon as each
              payment settles, usually within a few seconds. Receipts are on
              their way to your email.
            </p>
            <div class="flex gap-2">
              <a imeButton routerLink="/library">Go to your library</a>
              <a imeButton variant="secondary" routerLink="/purchases"
                >See purchases</a
              >
            </div>
          </div>
        }
      } @else {
        <p>
          This checkout was started in another browser. Anything you paid for
          appears in your purchases and library once the payment settles.
        </p>
        <div class="flex gap-2">
          <a imeButton routerLink="/purchases">See purchases</a>
          <a imeButton variant="secondary" routerLink="/cart">Back to cart</a>
        </div>
      }
    </div>
  `,
})
export class CheckoutPage {
  private readonly cart = inject(CartService);

  public readonly orderId = input.required<string>();
  /** The artist just paid, as Stripe sends the buyer back. */
  public readonly paid = input<string>();
  /** The artist whose payment the buyer backed out of. */
  public readonly cancelled = input<string>();

  protected readonly checkout = computed(() => {
    const checkout = this.cart.pendingCheckout(this.orderId());
    const paid = this.paid();
    return checkout && paid && !checkout.paidArtistIds.includes(paid)
      ? { ...checkout, paidArtistIds: [...checkout.paidArtistIds, paid] }
      : checkout;
  });

  /** The first artist still to be paid. */
  protected readonly nextArtistId = computed(
    () =>
      this.checkout()?.payments.find(
        (payment) => !this.checkout()?.paidArtistIds.includes(payment.artistId),
      )?.artistId ?? null,
  );

  constructor() {
    effect(() => {
      const paid = this.paid();
      if (paid) this.cart.markPaid(this.orderId(), paid);
    });
  }

  protected readonly cancelledArtist = computed(
    () =>
      this.checkout()?.payments.find(
        (payment) => payment.artistId === this.cancelled(),
      )?.artistName ?? null,
  );
}
