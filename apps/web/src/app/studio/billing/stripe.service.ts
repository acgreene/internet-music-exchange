import { Injectable } from '@angular/core';
import { clientEnv } from '@ime/client-env';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * Stripe.js, loaded from Stripe the first time a card is needed. Card
 * details go straight to Stripe and never touch IME.
 */
@Injectable({ providedIn: 'root' })
export class StripeService {
  private stripe: Promise<Stripe | null> | null = null;

  /** Whether this build has a publishable key to take cards with. */
  public readonly configured = clientEnv.STRIPE_PUBLISHABLE_KEY !== '';

  public load(): Promise<Stripe | null> {
    this.stripe ??= this.configured
      ? loadStripe(clientEnv.STRIPE_PUBLISHABLE_KEY)
      : Promise.resolve(null);
    return this.stripe;
  }
}
