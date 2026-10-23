import Stripe from 'stripe';
import {
  DatabaseRepository,
  type GivingCadence,
  type GivingDestination,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { EmailService, fundingEmails } from '../email';

/** Marks a Stripe payment or subscription as a gift, for the webhook. */
export const DONATION_PURPOSE = 'donation';

const MIN_GIFT = 100;
const MAX_GIFT = 100_000;
const THANKS_NAME_MAX_LENGTH = 60;

const GIFT_NAMES: Record<GivingDestination, string> = {
  platform: "Support IME's hosting",
  developers: "Support IME's developers",
};

export interface DonationInput {
  cadence: GivingCadence;
  /** How much goes to the platform's hosting, in cents. */
  platform: number;
  /** How much goes to the developers, in cents. */
  developers: number;
  /** The signed-in donor, if any. */
  userId?: string;
  /** The name to thank them by on the thank-you list, if they want to be. */
  thanksName?: string;
}

/**
 * Gifts beyond anyone's share of hosting costs, through the donation page:
 * once or monthly, split however the donor likes between the platform's
 * reserve and its developers. Gifts to the platform lower every seller's
 * share; gifts to the developers are private and never pass through the
 * reserve. Donors who give a name are thanked by it on the public list.
 */
export class DonationService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly webAppUrl: string = env.WEB_APP_URL,
    private readonly email: EmailService = new EmailService(),
  ) {}

  /**
   * Start a gift on Stripe's checkout page, as one payment however it is
   * split.
   *
   * @returns The checkout page to send the donor to.
   * @throws ApiError 400 for a split or total out of range, or an overlong
   * name.
   */
  public async createDonationCheckout(input: DonationInput): Promise<string> {
    const parts = { platform: input.platform, developers: input.developers };
    const total = parts.platform + parts.developers;
    if (
      !Object.values(parts).every(
        (part) => Number.isInteger(part) && part >= 0,
      ) ||
      total < MIN_GIFT ||
      total > MAX_GIFT
    ) {
      throw this.badRequest(
        `Gifts are between $${MIN_GIFT / 100} and $${MAX_GIFT / 100}.`,
      );
    }
    const thanksName = input.thanksName?.trim() ?? '';
    if (thanksName.length > THANKS_NAME_MAX_LENGTH) {
      throw this.badRequest(
        `Names on the thank-you list are up to ${THANKS_NAME_MAX_LENGTH} characters.`,
      );
    }

    const metadata = {
      purpose: DONATION_PURPOSE,
      platform: String(parts.platform),
      developers: String(parts.developers),
      userId: input.userId ?? '',
      thanksName,
    };
    const monthly = input.cadence === 'monthly';
    const destinations = (Object.keys(parts) as GivingDestination[]).filter(
      (destination) => parts[destination] > 0,
    );

    const session = await this.stripe.checkout.sessions.create({
      mode: monthly ? 'subscription' : 'payment',
      line_items: destinations.map((destination) => ({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: parts[destination],
          product_data: { name: GIFT_NAMES[destination] },
          recurring: monthly ? { interval: 'month' as const } : undefined,
        },
      })),
      customer_email: input.userId
        ? ((await this.db.users.getEmail(input.userId)) ?? undefined)
        : undefined,
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
    const recorded = await this.record(
      intent.metadata,
      'one_time',
      intent.amount_received,
      { stripePaymentIntentId: intent.id },
    );
    if (recorded) {
      await this.thank(
        intent.receipt_email ?? (await this.payerEmail(intent)),
        {
          ...recorded,
          monthly: false,
        },
      );
    }
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

    const recorded = await this.record(
      subscription.metadata,
      'monthly',
      invoice.amount_paid,
      {
        stripePaymentIntentId: intentId,
        stripeSubscriptionId:
          typeof subscription.subscription === 'string'
            ? subscription.subscription
            : subscription.subscription.id,
      },
    );
    // thank them once, for the first month, not every month after
    if (recorded && invoice.billing_reason === 'subscription_create') {
      await this.thank(invoice.customer_email, { ...recorded, monthly: true });
    }
  }

  /**
   * Record a charge as a row for each destination it funds, split the way
   * the donor chose. Gifts started before splitting carry one destination.
   *
   * @returns What was newly recorded, or null when this payment was already.
   */
  private async record(
    metadata: Stripe.Metadata,
    cadence: GivingCadence,
    amount: number,
    stripe: { stripePaymentIntentId: string; stripeSubscriptionId?: string },
  ): Promise<{
    parts: Record<GivingDestination, number>;
    thanksName: string | null;
  } | null> {
    const parts = splitOf(metadata, amount);
    const thanksName = metadata['thanksName']?.trim() || null;
    let recorded = false;
    for (const destination of Object.keys(parts) as GivingDestination[]) {
      if (parts[destination] <= 0) continue;
      const row = await this.db.funding.recordContribution({
        userId: metadata['userId'] || null,
        thanksName,
        destination,
        cadence,
        source: 'donation_page',
        amount: parts[destination],
        ...stripe,
      });
      recorded ||= !!row;
    }
    return recorded ? { parts, thanksName } : null;
  }

  /** The address a one-time gift's receipt went to. */
  private async payerEmail(
    intent: Stripe.PaymentIntent,
  ): Promise<string | null> {
    const chargeId =
      typeof intent.latest_charge === 'string'
        ? intent.latest_charge
        : intent.latest_charge?.id;
    if (!chargeId) return null;
    const charge = await this.stripe.charges.retrieve(chargeId);
    return charge.billing_details.email;
  }

  private async thank(
    to: string | null | undefined,
    gift: {
      parts: Record<GivingDestination, number>;
      thanksName: string | null;
      monthly: boolean;
    },
  ): Promise<void> {
    if (!to) return;
    await this.email.send(
      fundingEmails.giftThanks(to, {
        ...gift,
        costsUrl: `${this.webAppUrl}/costs`,
      }),
    );
  }

  private badRequest(message: string): ApiError {
    return new ApiError(ApiErrorKind.Http, HttpStatus.BadRequest, message);
  }
}

/**
 * How a charge divides between destinations: the amounts the donor chose,
 * scaled to what was actually paid in case the two differ.
 */
function splitOf(
  metadata: Stripe.Metadata,
  paid: number,
): Record<GivingDestination, number> {
  if (metadata['destination']) {
    const only = metadata['destination'] as GivingDestination;
    return {
      platform: only === 'platform' ? paid : 0,
      developers: only === 'developers' ? paid : 0,
    };
  }
  const platform = Number(metadata['platform']) || 0;
  const developers = Number(metadata['developers']) || 0;
  const chosen = platform + developers;
  if (chosen === paid || chosen === 0) {
    return { platform: chosen ? platform : paid, developers };
  }
  const toPlatform = Math.round((paid * platform) / chosen);
  return { platform: toPlatform, developers: paid - toPlatform };
}
