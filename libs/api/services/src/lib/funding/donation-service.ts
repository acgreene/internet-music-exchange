import Stripe from 'stripe';
import {
  DatabaseRepository,
  type GivingCadence,
  type GivingDestination,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';

/** Marks a Stripe payment or subscription as a gift, for the webhook. */
export const DONATION_PURPOSE = 'donation';

const MIN_GIFT = 100;
const MAX_GIFT = 100_000;

const GIFT_NAMES: Record<GivingDestination, string> = {
  platform: "Support IME's hosting",
  developers: "Support IME's developers",
};

export interface DonationInput {
  destination: GivingDestination;
  cadence: GivingCadence;
  /** In cents. */
  amount: number;
  /** The signed-in donor, if any. */
  userId?: string;
  /** Leave the donor's name off the gift. */
  anonymous?: boolean;
}

/**
 * Gifts beyond anyone's share of hosting costs, through the donation page:
 * once or monthly, to the platform's reserve or to its developers. Gifts to
 * the platform lower every seller's share; gifts to the developers are
 * private and never pass through the reserve.
 */
export class DonationService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * Start a gift on Stripe's checkout page.
   *
   * @returns The checkout page to send the donor to.
   * @throws ApiError 400 for an amount out of range.
   */
  public async createDonationCheckout(input: DonationInput): Promise<string> {
    if (
      !Number.isInteger(input.amount) ||
      input.amount < MIN_GIFT ||
      input.amount > MAX_GIFT
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Gifts are between $${MIN_GIFT / 100} and $${MAX_GIFT / 100}.`,
      );
    }

    const metadata = {
      purpose: DONATION_PURPOSE,
      destination: input.destination,
      userId: input.userId ?? '',
      anonymous: String(Boolean(input.anonymous)),
    };
    const monthly = input.cadence === 'monthly';

    const session = await this.stripe.checkout.sessions.create({
      mode: monthly ? 'subscription' : 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: input.amount,
            product_data: { name: GIFT_NAMES[input.destination] },
            recurring: monthly ? { interval: 'month' } : undefined,
          },
        },
      ],
      // the webhook reads these to record each charge
      payment_intent_data: monthly ? undefined : { metadata },
      subscription_data: monthly ? { metadata } : undefined,
      success_url: `${this.webAppUrl}/donate?thanks=1`,
      cancel_url: `${this.webAppUrl}/donate`,
    });

    return session.url as string;
  }

  /**
   * Record a one-time gift once its payment settles. Safe to repeat.
   */
  public async recordOneTimeGift(intent: Stripe.PaymentIntent): Promise<void> {
    await this.record(intent.metadata, 'one_time', intent.amount_received, {
      stripePaymentIntentId: intent.id,
    });
  }

  /**
   * Record one month's charge of a monthly gift. Safe to repeat.
   */
  public async recordMonthlyGift(invoice: Stripe.Invoice): Promise<void> {
    const subscription = invoice.parent?.subscription_details;
    if (subscription?.metadata?.['purpose'] !== DONATION_PURPOSE) return;

    // an invoice no longer carries its payment directly
    const withPayments = await this.stripe.invoices.retrieve(invoice.id, {
      expand: ['payments'],
    });
    const intent = withPayments.payments?.data.find(
      (p) => p.payment.payment_intent,
    )?.payment.payment_intent;
    const intentId = typeof intent === 'string' ? intent : intent?.id;
    if (!intentId) return;

    await this.record(subscription.metadata, 'monthly', invoice.amount_paid, {
      stripePaymentIntentId: intentId,
      stripeSubscriptionId:
        typeof subscription.subscription === 'string'
          ? subscription.subscription
          : subscription.subscription.id,
    });
  }

  private async record(
    metadata: Stripe.Metadata,
    cadence: GivingCadence,
    amount: number,
    stripe: { stripePaymentIntentId: string; stripeSubscriptionId?: string },
  ): Promise<void> {
    await this.db.funding.recordContribution({
      userId: metadata['userId'] || null,
      isAnonymous: metadata['anonymous'] === 'true',
      destination: metadata['destination'] as GivingDestination,
      cadence,
      source: 'donation_page',
      amount,
      ...stripe,
    });
  }
}
