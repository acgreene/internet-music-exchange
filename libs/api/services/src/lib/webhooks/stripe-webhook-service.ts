import Stripe from 'stripe';
import { DatabaseRepository } from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { BillingService, DONATION_PURPOSE, DonationService, TOP_UP_PURPOSE } from '../funding';
import { PaymentAccountService } from '../payments';

/**
 * Stripe's webhooks, one route each: the platform's own account (top-ups,
 * card fees, gifts) and sellers' connected accounts (their status).
 *
 * Every handler is safe to repeat, so an event is handled first and claimed
 * after: a failure leaves it unclaimed for Stripe to retry, and a repeat
 * delivery of a claimed event does nothing. Handlers call back to Stripe,
 * which should not happen inside a database transaction.
 */
export class StripeWebhookService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly billing: BillingService = new BillingService(db, stripe),
    private readonly donations: DonationService = new DonationService(
      db,
      stripe,
    ),
    private readonly paymentAccounts: PaymentAccountService = new PaymentAccountService(
      db,
      stripe,
    ),
    private readonly platformSecret: string = env.STRIPE_WEBHOOK_SECRET,
    private readonly connectSecret: string = env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ) {}

  /**
   * Handle an event about the platform's own Stripe account.
   *
   * @param payload - The raw request body, exactly as received.
   * @param signature - The `Stripe-Signature` header.
   * @throws ApiError 400 when the signature does not check out.
   */
  public handlePlatformEvent(
    payload: string,
    signature: string,
  ): Promise<void> {
    return this.handle(payload, signature, this.platformSecret, (event) =>
      this.onPlatformEvent(event),
    );
  }

  /**
   * Handle an event about a seller's connected account.
   *
   * @param payload - The raw request body, exactly as received.
   * @param signature - The `Stripe-Signature` header.
   * @throws ApiError 400 when the signature does not check out.
   */
  public handleConnectEvent(payload: string, signature: string): Promise<void> {
    return this.handle(payload, signature, this.connectSecret, (event) =>
      this.onConnectEvent(event),
    );
  }

  private async onPlatformEvent(event: Stripe.Event): Promise<void> {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      // a top-up that needed the cardholder's approval lands here
      if (intent.metadata['purpose'] === TOP_UP_PURPOSE) {
        await this.billing.recordTopUp(intent.id);
      }
      if (intent.metadata['purpose'] === DONATION_PURPOSE) {
        await this.donations.recordOneTimeGift(intent);
      }
    }
    if (event.type === 'charge.updated') {
      await this.billing.recordCardFee(event.data.object);
    }
    if (event.type === 'invoice.paid') {
      await this.donations.recordMonthlyGift(event.data.object);
    }
  }

  private async onConnectEvent(event: Stripe.Event): Promise<void> {
    if (event.type === 'account.updated') {
      await this.paymentAccounts.syncFromStripe(event.data.object.id);
    }
    // the seller disconnected IME from their Stripe account
    if (event.type === 'account.application.deauthorized' && event.account) {
      await this.paymentAccounts.markDisconnected(event.account);
    }
  }

  private async handle(
    payload: string,
    signature: string,
    secret: string,
    onEvent: (event: Stripe.Event) => Promise<void>,
  ): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Invalid Stripe signature.',
      );
    }

    if (await this.db.payments.getEventById(event.id)) return;
    await onEvent(event);
    await this.db.payments.claimEvent({
      id: event.id,
      type: event.type,
      payload: event,
    });
  }
}
