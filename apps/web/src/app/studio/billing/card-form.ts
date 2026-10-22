import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ApiClient } from '@ime/api-client';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { StripeService } from './stripe.service';

/**
 * Save a card for hosting top-ups, with Stripe's own card fields.
 */
@Component({
  selector: 'ime-card-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, SpinnerComponent],
  template: `
    @if (!stripeService.configured) {
      <ime-alert>
        Cards cannot be saved here yet: this build has no Stripe publishable key
        (STRIPE_PUBLISHABLE_KEY).
      </ime-alert>
    } @else {
      <form class="flex flex-col gap-3" (submit)="save($event)">
        <div #cardFields class="min-h-24"></div>
        @if (!ready()) {
          <ime-spinner label="Loading card fields" />
        }
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div class="flex gap-2">
          <button
            imeButton
            type="submit"
            [disabled]="!ready()"
            [busy]="saving()"
          >
            Save card
          </button>
          <button
            imeButton
            type="button"
            variant="ghost"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
        </div>
      </form>
    }
  `,
})
export class CardForm {
  private readonly api = inject(ApiClient);
  protected readonly stripeService = inject(StripeService);

  public readonly saved = output<void>();
  public readonly cancelled = output<void>();

  private readonly cardFields =
    viewChild<ElementRef<HTMLElement>>('cardFields');
  protected readonly ready = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;

  constructor() {
    afterNextRender(() => void this.mount());
  }

  private async mount(): Promise<void> {
    const host = this.cardFields()?.nativeElement;
    if (!host) return;
    const [stripe, setup] = await Promise.all([
      this.stripeService.load(),
      this.api.funding.createCardSetup(),
    ]);
    if (!setup.ok) {
      this.error.set(setup.error.message);
      return;
    }
    if (!stripe) {
      this.error.set('Stripe could not be loaded. Check your connection.');
      return;
    }
    this.stripe = stripe;
    this.elements = stripe.elements({
      clientSecret: setup.data,
      appearance: {
        theme: matchMedia('(prefers-color-scheme: dark)').matches
          ? 'night'
          : 'stripe',
      },
    });
    const payment = this.elements.create('payment', { layout: 'tabs' });
    payment.on('ready', () => this.ready.set(true));
    payment.mount(host);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.stripe || !this.elements) return;
    this.saving.set(true);
    this.error.set(null);
    const { error, setupIntent } = await this.stripe.confirmSetup({
      elements: this.elements,
      redirect: 'if_required',
    });
    if (error || !setupIntent) {
      this.saving.set(false);
      this.error.set(error?.message ?? 'The card could not be saved.');
      return;
    }
    const confirmed = await this.api.funding.confirmCard(setupIntent.id);
    this.saving.set(false);
    if (confirmed.ok) this.saved.emit();
    else this.error.set(confirmed.error.message);
  }
}
