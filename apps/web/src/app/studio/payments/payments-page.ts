import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { StudioService } from '../studio.service';

/**
 * Getting paid: connect the artist's Stripe account, or the designer's own,
 * and see what it is cleared to do. Stripe sends people back here from
 * onboarding.
 */
@Component({
  selector: 'ime-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, SpinnerComponent],
  template: `
    <div class="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Getting paid</h1>
        <p class="text-sm text-ink-muted">
          {{ scope() === 'designer' ? 'Artists' : 'Buyers' }} pay you directly
          through your own Stripe account. IME takes no cut and never holds your
          money.
        </p>
      </div>

      @if (account.error()) {
        <ime-alert tone="error"
          >Your payment account could not be loaded.</ime-alert
        >
      } @else if (status(); as status) {
        @if (!status.connected) {
          <div
            class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
          >
            <p>
              Connect a Stripe account to sell {{ selling() }}. Stripe asks for
              your details and bank account, and pays you out. Free
              {{ scope() === 'designer' ? 'designs' : 'releases' }} need no
              payment account.
            </p>
            <div>
              <button imeButton [busy]="starting()" (click)="startOnboarding()">
                Set up payments with Stripe
              </button>
            </div>
          </div>
        } @else {
          <dl
            class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
          >
            <div class="flex items-center justify-between gap-4 p-4">
              <dt>
                <span class="font-medium">Accepting payments</span>
                <span class="block text-sm text-ink-muted"
                  >Needed to sell anything paid.</span
                >
              </dt>
              <dd
                class="text-sm font-medium"
                [class.text-success]="status.chargesEnabled"
              >
                {{ status.chargesEnabled ? 'Yes' : 'Not yet' }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 p-4">
              <dt>
                <span class="font-medium">Payouts to your bank</span>
                <span class="block text-sm text-ink-muted"
                  >Can still be under review while you sell.</span
                >
              </dt>
              <dd
                class="text-sm font-medium"
                [class.text-success]="status.payoutsEnabled"
              >
                {{ status.payoutsEnabled ? 'On' : 'Under review' }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 p-4">
              <dt><span class="font-medium">Stripe's form</span></dt>
              <dd
                class="text-sm font-medium"
                [class.text-success]="status.detailsSubmitted"
              >
                {{ status.detailsSubmitted ? 'Complete' : 'Unfinished' }}
              </dd>
            </div>
            @if (status.currency) {
              <div class="flex items-center justify-between gap-4 p-4">
                <dt>
                  <span class="font-medium">Selling currency</span>
                  <span class="block text-sm text-ink-muted"
                    >Everything you sell is priced in it.</span
                  >
                </dt>
                <dd class="text-sm font-medium uppercase">
                  {{ status.currency }}
                </dd>
              </div>
            }
          </dl>
          <div class="flex flex-wrap gap-2">
            @if (!status.detailsSubmitted || !status.chargesEnabled) {
              <button imeButton [busy]="starting()" (click)="startOnboarding()">
                Continue setup with Stripe
              </button>
            }
            <button
              imeButton
              variant="secondary"
              [busy]="refreshing()"
              (click)="refresh()"
            >
              Check status again
            </button>
            <a
              imeButton
              variant="ghost"
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener"
              >Open your Stripe dashboard</a
            >
          </div>
          <p class="text-sm text-ink-muted">
            Payouts, refunds, disputes, and tax settings are managed in your
            Stripe dashboard.
          </p>
        }
      } @else {
        <ime-spinner />
      }
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </div>
  `,
})
export class PaymentsPage {
  private readonly api = inject(ApiClient);
  private readonly studio = inject(StudioService);

  /** Set by Stripe when an onboarding link expired before it was used. */
  public readonly onboarding = input<string>();
  /** Whose account: the artist being worked on, or the signed-in designer's. */
  public readonly scope = input<'artist' | 'designer'>('artist');

  protected readonly selling = computed(() =>
    this.scope() === 'designer' ? 'paid designs' : 'paid releases and merch',
  );

  /** The calls for whose account this is, or none until the artist is known. */
  private readonly calls = computed(() => {
    const funding = this.api.funding;
    if (this.scope() === 'designer') {
      return {
        get: () => funding.getMyPaymentAccount(),
        start: () => funding.startMyOnboarding(),
        refresh: () => funding.refreshMyPaymentAccount(),
      };
    }
    const artistId = this.studio.currentArtistId();
    if (!artistId) return undefined;
    return {
      get: () => funding.getArtistPaymentAccount(artistId),
      start: () => funding.startArtistOnboarding(artistId),
      refresh: () => funding.refreshArtistPaymentAccount(artistId),
    };
  });

  protected readonly account = resource({
    params: () => this.calls(),
    loader: async ({ params }) => {
      const recorded = unwrap(await params.get());
      // an account mid-setup may have changed on Stripe's side, as when the
      // owner just came back from onboarding, so ask Stripe
      return recorded.connected &&
        !(recorded.chargesEnabled && recorded.detailsSubmitted)
        ? unwrap(await params.refresh())
        : recorded;
    },
  });
  protected readonly status = computed(() => currentValue(this.account));

  protected readonly starting = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.onboarding() === 'expired') void this.startOnboarding();
    });
  }

  protected async startOnboarding(): Promise<void> {
    const calls = this.calls();
    if (!calls) return;
    this.starting.set(true);
    this.error.set(null);
    const result = await calls.start();
    if (result.ok) {
      window.location.assign(result.data.url);
      return;
    }
    this.starting.set(false);
    this.error.set(result.error.message);
  }

  protected async refresh(): Promise<void> {
    const calls = this.calls();
    if (!calls) return;
    this.refreshing.set(true);
    this.error.set(null);
    const result = await calls.refresh();
    this.refreshing.set(false);
    if (result.ok) this.account.set(result.data);
    else this.error.set(result.error.message);
  }
}
