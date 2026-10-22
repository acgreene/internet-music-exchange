import Stripe from 'stripe';
import {
  type AutoTopUpMode,
  type BalanceEntry,
  DatabaseRepository,
  getPostgresErrorCode,
  type GivingDestination,
  PostgresErrorCode,
  type SellerBilling,
  type Statement,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { FundingService } from './funding-service';

/** Small enough to start with, large enough that card fees stay a small share. */
export const MIN_TOP_UP = 500;
/** Catches a mistyped amount before a card is charged. */
export const MAX_TOP_UP = 50_000;

/** Marks a PaymentIntent as a top-up, for the webhook that records it. */
export const TOP_UP_PURPOSE = 'top_up';

export interface TopUpInput {
  /** What goes into the balance, in cents. */
  amount: number;
  /** An optional gift on top, in cents. */
  extraAmount?: number;
  extraDestination?: GivingDestination;
}

/**
 * How a top-up went. A card that needs the holder to approve the charge
 * returns a client secret for the browser to finish it with; the webhook
 * records the top-up once it succeeds.
 */
export type TopUpResult =
  | { status: 'succeeded' }
  | { status: 'requires_action'; clientSecret: string };

export interface BillingSettingsInput {
  alertThresholdAmount?: number | null;
  alertThresholdPercent?: number | null;
  autoTopUpMode?: AutoTopUpMode;
  autoTopUpAmount?: number | null;
  autoTopUpExtraAmount?: number;
  autoTopUpExtraDestination?: GivingDestination | null;
}

/**
 * Everything a seller sees about paying for hosting.
 */
export interface BillingOverview {
  billing: SellerBilling | null;
  hasCard: boolean;
  balance: number;
  recentEntries: BalanceEntry[];
  statements: Statement[];
}

/**
 * Sellers' prepaid balances: their card, top-ups and the optional extra given
 * with them, alert and auto top-up settings, and refunds of unused balance.
 * All amounts are USD cents, charged on the platform's own Stripe account.
 */
export class BillingService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly funding: FundingService = new FundingService(db),
  ) {}

  /**
   * A seller's balance, settings, recent activity, and statements.
   */
  public async getOverview(userId: string): Promise<BillingOverview> {
    const [billing, balance, recentEntries, statements] = await Promise.all([
      this.db.funding.getBilling(userId),
      this.db.funding.getBalance(userId),
      this.db.funding.listBalanceEntries(userId),
      this.db.funding.listStatements(userId),
    ]);
    return {
      billing,
      hasCard: Boolean(billing?.stripePaymentMethodId),
      balance,
      recentEntries,
      statements,
    };
  }

  /**
   * Start saving a card: returns the client secret the browser confirms the
   * card with through Stripe.
   */
  public async createCardSetup(userId: string): Promise<string> {
    const billing = await this.setUp(userId);
    const setup = await this.stripe.setupIntents.create({
      customer: billing.stripeCustomerId,
      usage: 'off_session',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
    return setup.client_secret as string;
  }

  /**
   * Save the card a seller just confirmed, making it the one top-ups charge.
   *
   * @throws ApiError 403 when the setup belongs to someone else, 409 when it
   * has not succeeded.
   */
  public async confirmCard(
    userId: string,
    setupIntentId: string,
  ): Promise<void> {
    const billing = await this.requireBilling(userId);
    const setup = await this.stripe.setupIntents.retrieve(setupIntentId);

    if (setup.customer !== billing.stripeCustomerId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'That card setup is not yours.',
      );
    }
    if (
      setup.status !== 'succeeded' ||
      typeof setup.payment_method !== 'string'
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'The card has not been confirmed yet.',
      );
    }

    await this.stripe.customers.update(billing.stripeCustomerId, {
      invoice_settings: { default_payment_method: setup.payment_method },
    });
    await this.db.funding.setPaymentMethod(userId, setup.payment_method);
  }

  /**
   * Remove a seller's card. Not allowed while it pays for anything on sale.
   *
   * @throws ApiError 409 while the seller is active.
   */
  public async removeCard(userId: string): Promise<void> {
    const billing = await this.requireBilling(userId);
    if (await this.funding.isSellerActive(userId)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Your card pays for music, merch, or designs on sale. Take them off sale first.',
      );
    }
    if (!billing.stripePaymentMethodId) return;

    // auto top-up has nothing to charge without a card
    await this.db.transaction(async (repos) => {
      await repos.funding.updateSettings(userId, { autoTopUpMode: 'off' });
      await repos.funding.setPaymentMethod(userId, null);
    });
    await this.stripe.paymentMethods.detach(billing.stripePaymentMethodId);
  }

  /**
   * Change a seller's alert threshold and auto top-up settings.
   *
   * @throws ApiError 400 for a combination that cannot work.
   */
  public async updateSettings(
    userId: string,
    settings: BillingSettingsInput,
  ): Promise<SellerBilling> {
    await this.requireBilling(userId);
    if (
      settings.autoTopUpAmount !== undefined &&
      settings.autoTopUpAmount !== null &&
      (settings.autoTopUpAmount < MIN_TOP_UP ||
        settings.autoTopUpAmount > MAX_TOP_UP)
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Auto top-ups are between $${MIN_TOP_UP / 100} and $${MAX_TOP_UP / 100}.`,
      );
    }

    try {
      await this.db.funding.updateSettings(userId, settings);
    } catch (error) {
      if (getPostgresErrorCode(error) === PostgresErrorCode.CheckViolation) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          'Auto top-up needs a card and an amount, topping up below a threshold needs a threshold, only one kind of threshold can be set, and an extra gift needs somewhere to go.',
        );
      }
      throw error;
    }

    return this.requireBilling(userId);
  }

  /**
   * Charge a seller's saved card and add the amount to their balance, with an
   * optional extra gift to the platform or the developers.
   *
   * @throws ApiError 400 for an amount out of range, 409 without a card.
   */
  public async topUp(userId: string, input: TopUpInput): Promise<TopUpResult> {
    const billing = await this.requireBilling(userId);
    const extraAmount = input.extraAmount ?? 0;

    if (
      !Number.isInteger(input.amount) ||
      input.amount < MIN_TOP_UP ||
      input.amount > MAX_TOP_UP
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Top-ups are between $${MIN_TOP_UP / 100} and $${MAX_TOP_UP / 100}.`,
      );
    }
    if (!Number.isInteger(extraAmount) || extraAmount < 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'The extra gift must be a whole number of cents.',
      );
    }
    if (extraAmount > 0 && !input.extraDestination) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Choose whether the extra goes to the platform or the developers.',
      );
    }
    if (!billing.stripePaymentMethodId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Add a card before topping up.',
      );
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: input.amount + extraAmount,
      currency: 'usd',
      customer: billing.stripeCustomerId,
      payment_method: billing.stripePaymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: 'IME hosting balance top-up',
      metadata: {
        purpose: TOP_UP_PURPOSE,
        userId,
        balanceAmount: String(input.amount),
        extraAmount: String(extraAmount),
        extraDestination: input.extraDestination ?? '',
      },
    });

    if (intent.status === 'succeeded') {
      await this.recordTopUp(intent.id);
      return { status: 'succeeded' };
    }
    if (intent.status === 'requires_action' && intent.client_secret) {
      return { status: 'requires_action', clientSecret: intent.client_secret };
    }
    throw new ApiError(
      ApiErrorKind.Http,
      HttpStatus.Conflict,
      'The card was declined.',
    );
  }

  /**
   * Record a settled top-up: the balance it adds, the card fee Stripe kept,
   * and any extra gift. Safe to call more than once for the same payment, as
   * the API and the webhook both do.
   */
  public async recordTopUp(paymentIntentId: string): Promise<void> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    });
    const { purpose, userId, balanceAmount, extraAmount, extraDestination } =
      intent.metadata;
    if (purpose !== TOP_UP_PURPOSE || intent.status !== 'succeeded') return;

    // Stripe can take a moment to work out the fee; recordCardFee fills it in
    // when it does
    const charge = intent.latest_charge as Stripe.Charge;
    const cardFee =
      (charge.balance_transaction as Stripe.BalanceTransaction | null)?.fee ??
      null;

    const recorded = await this.db.transaction(async (repos) => {
      const entry = await repos.funding.recordTopUp({
        userId,
        amount: Number(balanceAmount),
        cardFee,
        stripePaymentIntentId: intent.id,
      });
      if (entry && Number(extraAmount) > 0) {
        await repos.funding.recordContribution({
          userId,
          destination: extraDestination as GivingDestination,
          cadence: 'one_time',
          source: 'top_up',
          amount: Number(extraAmount),
          stripePaymentIntentId: intent.id,
        });
      }
      return Boolean(entry);
    });

    if (recorded) await this.restoreIfPaidUp(userId);
  }

  /**
   * Fill in a top-up's card fee once Stripe has worked it out, as when the
   * charge's `charge.updated` event arrives.
   */
  public async recordCardFee(charge: Stripe.Charge): Promise<void> {
    if (
      !charge.balance_transaction ||
      typeof charge.payment_intent !== 'string'
    ) {
      return;
    }
    const transaction =
      typeof charge.balance_transaction === 'string'
        ? await this.stripe.balanceTransactions.retrieve(
            charge.balance_transaction,
          )
        : charge.balance_transaction;
    await this.db.funding.setTopUpCardFee(
      charge.payment_intent,
      transaction.fee,
    );
  }

  /**
   * Run a seller's auto top-up while they are away, as the monthly close does.
   *
   * @returns True when the card was charged, false when auto top-up is off,
   * the card was declined, or the bank wants the card holder to approve it.
   */
  public async autoTopUp(userId: string): Promise<boolean> {
    const billing = await this.db.funding.getBilling(userId);
    if (
      !billing?.stripePaymentMethodId ||
      billing.autoTopUpMode === 'off' ||
      !billing.autoTopUpAmount
    ) {
      return false;
    }

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create({
        amount: billing.autoTopUpAmount + billing.autoTopUpExtraAmount,
        currency: 'usd',
        customer: billing.stripeCustomerId,
        payment_method: billing.stripePaymentMethodId,
        confirm: true,
        // fails instead of waiting when the bank wants the holder's approval
        off_session: true,
        description: 'IME hosting balance auto top-up',
        metadata: {
          purpose: TOP_UP_PURPOSE,
          userId,
          balanceAmount: String(billing.autoTopUpAmount),
          extraAmount: String(billing.autoTopUpExtraAmount),
          extraDestination: billing.autoTopUpExtraDestination ?? '',
        },
      });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeCardError) return false;
      throw error;
    }

    if (intent.status !== 'succeeded') return false;
    await this.recordTopUp(intent.id);
    return true;
  }

  /**
   * Refund a seller's unused balance to their card, once nothing of theirs is
   * on sale. Refunds come out of their most recent top-ups first, and never
   * include the extra they gave.
   *
   * @returns How much was refunded, in cents.
   * @throws ApiError 409 while the seller is active or has nothing to refund.
   */
  public async refundUnusedBalance(userId: string): Promise<number> {
    await this.requireBilling(userId);
    if (await this.funding.isSellerActive(userId)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Take everything you pay for off sale before asking for your balance back.',
      );
    }

    let remaining = await this.db.funding.getBalance(userId);
    if (remaining <= 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'There is no unused balance to refund.',
      );
    }

    const topUps = (
      await this.db.funding.listBalanceEntries(userId, 1000)
    ).filter((entry) => entry.kind === 'top_up' && entry.stripePaymentIntentId);

    let refunded = 0;
    for (const topUp of topUps) {
      if (remaining <= 0) break;

      const intent = await this.stripe.paymentIntents.retrieve(
        topUp.stripePaymentIntentId as string,
        { expand: ['latest_charge'] },
      );
      const charge = intent.latest_charge as Stripe.Charge | null;
      if (!charge) continue;

      // only the balance part of a top-up is ever refunded, so whatever was
      // refunded before came out of it
      const refundable = topUp.amount - charge.amount_refunded;
      const amount = Math.min(remaining, refundable);
      if (amount <= 0) continue;

      const refund = await this.stripe.refunds.create({
        payment_intent: intent.id,
        amount,
      });
      await this.db.funding.recordWithdrawal(userId, amount, refund.id);
      remaining -= amount;
      refunded += amount;
    }

    return refunded;
  }

  /**
   * Create a seller's billing record and Stripe customer, the first time they
   * need one.
   */
  private async setUp(userId: string): Promise<SellerBilling> {
    const existing = await this.db.funding.getBilling(userId);
    if (existing) return existing;

    const customer = await this.stripe.customers.create({
      metadata: { userId },
    });
    return this.db.funding.createBilling(userId, customer.id);
  }

  private async requireBilling(userId: string): Promise<SellerBilling> {
    const billing = await this.db.funding.getBilling(userId);
    if (!billing) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Add a card to set up hosting payments first.',
      );
    }
    return billing;
  }

  /**
   * End a lapse once a top-up brings the balance back above zero, and put back
   * on sale what the seller pays for.
   */
  private async restoreIfPaidUp(userId: string): Promise<void> {
    const billing = await this.db.funding.getBilling(userId);
    if (!billing?.lapsedAt) return;
    if ((await this.db.funding.getBalance(userId)) <= 0) return;

    await this.db.transaction(async (repos) => {
      await repos.funding.clearLapse(userId);
      // checked inside the transaction, where this seller is no longer lapsed
      const funding = new FundingService(repos);
      for (const share of await repos.funding.listSharesPaidBy(userId)) {
        // another manager sharing the costs may still be lapsed
        if (await funding.isArtistFunded(share.artistId)) {
          await repos.funding.putArtistsOnSale([share.artistId]);
        }
      }
      await repos.funding.putDesignsOnSale(userId);
    });
  }
}
