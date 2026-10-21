import Stripe from 'stripe';
import { DatabaseRepository } from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { BillingService, TOP_UP_PURPOSE } from './billing-service';
import { DONATION_PURPOSE, DonationService } from './donation-service';

/**
 * Webhooks about the platform's own Stripe account: sellers' top-ups and
 * donors' gifts. Events from sellers' connected accounts arrive separately.
 */
export class PlatformWebhookService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly billing: BillingService = new BillingService(db, stripe),
    private readonly giving: DonationService = new DonationService(db, stripe),
    private readonly webhookSecret: string = env.STRIPE_WEBHOOK_SECRET,
  ) {}

  /**
   * Handle one event. Recording a top-up or a gift is safe to repeat, so the
   * work runs first and the event is claimed after: a failure leaves it
   * unclaimed for Stripe to retry. (Recording calls back to Stripe, which
   * should not happen inside a database transaction.)
   *
   * @param payload - The raw request body, exactly as received.
   * @param signature - The `Stripe-Signature` header.
   * @throws ApiError 400 when the signature does not check out.
   */
  public async handle(payload: string, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Invalid Stripe signature.',
      );
    }

    if (await this.db.payments.getEventById(event.id)) return;

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      // a top-up that needed the card holder's approval lands here
      if (intent.metadata['purpose'] === TOP_UP_PURPOSE) {
        await this.billing.recordTopUp(intent.id);
      }
      if (intent.metadata['purpose'] === DONATION_PURPOSE) {
        await this.giving.recordOneTimeGift(intent);
      }
    }
    if (event.type === 'charge.updated') {
      await this.billing.recordCardFee(event.data.object);
    }
    if (event.type === 'invoice.paid') {
      await this.giving.recordMonthlyGift(event.data.object);
    }

    await this.db.payments.claimEvent({
      id: event.id,
      type: event.type,
      payload: event,
    });
  }
}
