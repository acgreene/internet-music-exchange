import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  type Currency,
  type PayoutAccount,
  payoutAccounts,
  type StripeEvent,
  stripeEvents,
} from '../tables';

export interface SyncAccountParams {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  defaultCurrency?: Currency | null;
}

export interface ClaimEventParams {
  id: string;
  type: string;
  payload?: unknown;
}

const DEFAULT_EVENT_LIMIT = 50;

/**
 * Queries for the Stripe edge: each seller's connected account and what it is
 * cleared to do, and the webhook events already handled. A seller is an artist
 * or a designer.
 */
export class PaymentRepository {
  constructor(private readonly db: Db) {}

  /**
   * Read an artist's connected account and its onboarding state.
   *
   * @param artistId - The id of the artist.
   * @returns The payout account row, or null when the artist has not started
   * onboarding.
   */
  public async getAccountByArtistId(
    artistId: string,
  ): Promise<PayoutAccount | null> {
    const [account] = await this.db
      .select()
      .from(payoutAccounts)
      .where(eq(payoutAccounts.artistId, artistId))
      .limit(1);

    return account ?? null;
  }

  /**
   * Read a designer's connected account and its onboarding state.
   *
   * @param designerUserId - The id of the designer.
   * @returns The payout account row, or null when the designer has not started
   * onboarding.
   */
  public async getAccountByDesignerUserId(
    designerUserId: string,
  ): Promise<PayoutAccount | null> {
    const [account] = await this.db
      .select()
      .from(payoutAccounts)
      .where(eq(payoutAccounts.designerUserId, designerUserId))
      .limit(1);

    return account ?? null;
  }

  /**
   * Find the account a Stripe webhook refers to.
   *
   * @param stripeAccountId - The connected account identifier from Stripe.
   * @returns The payout account row, or null when that account is not on file.
   */
  public async getAccountByStripeAccountId(
    stripeAccountId: string,
  ): Promise<PayoutAccount | null> {
    const [account] = await this.db
      .select()
      .from(payoutAccounts)
      .where(eq(payoutAccounts.stripeAccountId, stripeAccountId))
      .limit(1);

    return account ?? null;
  }

  /**
   * Record the connected account an artist is onboarding with, replacing the
   * one they had if they started over.
   *
   * @param artistId - The id of the artist onboarding.
   * @param stripeAccountId - The connected account identifier from Stripe.
   * @returns The stored payout account row.
   */
  public async upsertArtistAccount(
    artistId: string,
    stripeAccountId: string,
  ): Promise<PayoutAccount> {
    const [account] = await this.db
      .insert(payoutAccounts)
      .values({ artistId, stripeAccountId })
      // the capability flags stay as Stripe last reported them until it says
      // otherwise
      .onConflictDoUpdate({
        target: payoutAccounts.artistId,
        set: { stripeAccountId, updatedAt: new Date() },
      })
      .returning();

    return account;
  }

  /**
   * Record the connected account a designer is onboarding with, replacing the
   * one they had if they started over.
   *
   * @param designerUserId - The id of the designer onboarding.
   * @param stripeAccountId - The connected account identifier from Stripe.
   * @returns The stored payout account row.
   */
  public async upsertDesignerAccount(
    designerUserId: string,
    stripeAccountId: string,
  ): Promise<PayoutAccount> {
    const [account] = await this.db
      .insert(payoutAccounts)
      .values({ designerUserId, stripeAccountId })
      .onConflictDoUpdate({
        target: payoutAccounts.designerUserId,
        set: { stripeAccountId, updatedAt: new Date() },
      })
      .returning();

    return account;
  }

  /**
   * Write what Stripe reports an account may now do.
   *
   * @param stripeAccountId - The connected account Stripe reported on.
   * @param params - Whether the account may take charges, be paid out, has
   * finished onboarding, and the currency it settles in.
   */
  public async syncAccountFromStripe(
    stripeAccountId: string,
    params: SyncAccountParams,
  ): Promise<void> {
    await this.db
      .update(payoutAccounts)
      .set({
        chargesEnabled: params.chargesEnabled,
        payoutsEnabled: params.payoutsEnabled,
        detailsSubmitted: params.detailsSubmitted,
        defaultCurrency: params.defaultCurrency ?? null,
        updatedAt: new Date(),
      })
      .where(eq(payoutAccounts.stripeAccountId, stripeAccountId));
  }

  /**
   * Report whether an artist may take money yet.
   *
   * @param artistId - The id of the artist.
   * @returns True when Stripe has cleared their account to accept charges.
   * Payouts being held for review does not stop a sale.
   */
  public async canArtistSell(artistId: string): Promise<boolean> {
    const [account] = await this.db
      .select({ artistId: payoutAccounts.artistId })
      .from(payoutAccounts)
      .where(
        and(
          eq(payoutAccounts.artistId, artistId),
          eq(payoutAccounts.chargesEnabled, true),
        ),
      )
      .limit(1);

    return Boolean(account);
  }

  /**
   * Report whether a designer may take money for paid designs yet.
   *
   * @param designerUserId - The id of the designer.
   * @returns True when Stripe has cleared their account to accept charges.
   */
  public async canDesignerSell(designerUserId: string): Promise<boolean> {
    const [account] = await this.db
      .select({ id: payoutAccounts.id })
      .from(payoutAccounts)
      .where(
        and(
          eq(payoutAccounts.designerUserId, designerUserId),
          eq(payoutAccounts.chargesEnabled, true),
        ),
      )
      .limit(1);

    return Boolean(account);
  }

  /**
   * Take ownership of a webhook event, so a redelivery of it does no work
   * twice.
   *
   * @param params - The Stripe event id, its type, and the raw event to keep
   * for reconciliation.
   * @returns True when this delivery is the first and the caller should handle
   * it, false when the event was already recorded.
   */
  public async claimEvent(params: ClaimEventParams): Promise<boolean> {
    // claiming and checking are the same statement, so two concurrent
    // deliveries cannot both decide they are the first
    const claimed = await this.db
      .insert(stripeEvents)
      .values({ id: params.id, type: params.type, payload: params.payload })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });

    return claimed.length > 0;
  }

  /**
   * Read a recorded webhook event, as when reconciling a disputed charge.
   *
   * @param eventId - The Stripe event id.
   * @returns The event row with its raw payload, or null when it was never
   * received.
   */
  public async getEventById(eventId: string): Promise<StripeEvent | null> {
    const [event] = await this.db
      .select()
      .from(stripeEvents)
      .where(eq(stripeEvents.id, eventId))
      .limit(1);

    return event ?? null;
  }

  /**
   * List recorded webhook events of one type, newest first.
   *
   * @param type - The Stripe event type, such as `checkout.session.completed`.
   * @param limit - The maximum number of events to return.
   * @returns The matching event rows with their raw payloads.
   */
  public async listEventsByType(
    type: string,
    limit: number = DEFAULT_EVENT_LIMIT,
  ): Promise<StripeEvent[]> {
    return this.db
      .select()
      .from(stripeEvents)
      .where(eq(stripeEvents.type, type))
      .orderBy(desc(stripeEvents.createdAt))
      .limit(limit);
  }
}
