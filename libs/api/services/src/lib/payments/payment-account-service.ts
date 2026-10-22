import Stripe from 'stripe';
import {
  type Currency,
  currencyEnum,
  DatabaseRepository,
  type PayoutAccount,
} from '@ime/db';
import { env } from '@ime/env';
import { AccessService } from '../access/access-service';

/**
 * Stripe's own dashboard. Sellers on Standard accounts manage payouts,
 * refunds, disputes, and tax settings there.
 */
export const STRIPE_DASHBOARD_URL = 'https://dashboard.stripe.com';

const SUPPORTED_CURRENCIES = new Set<string>(currencyEnum.enumValues);

/**
 * What a seller's payment account can do, as IME last heard from Stripe.
 */
export interface PayoutAccountStatus {
  /** A Stripe account exists, whether or not onboarding is finished. */
  connected: boolean;
  /** Paid releases, merch, and designs can be sold. */
  chargesEnabled: boolean;
  /** Stripe pays the seller out to their bank. */
  payoutsEnabled: boolean;
  /** The seller finished Stripe's onboarding form. */
  detailsSubmitted: boolean;
  /**
   * The seller's selling currency. Null until Stripe knows it, or when the
   * account settles in a currency IME does not support yet.
   */
  currency: Currency | null;
}

const NOT_CONNECTED: PayoutAccountStatus = {
  connected: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  currency: null,
};

/**
 * Sellers' payment accounts on Stripe Connect: onboarding artists and
 * designers onto Standard accounts, and keeping IME in step with what Stripe
 * decides they may do. Buyers pay these accounts directly; IME never holds the
 * money.
 */
export class PaymentAccountService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly access: AccessService = new AccessService(db),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * Start or resume an artist's onboarding. The artist's Stripe account is
   * created the first time; later calls hand out a fresh link to the same one.
   *
   * @returns The Stripe page to send the manager to.
   * @throws ApiError 403 when the user is suspended or does not manage the
   * artist.
   */
  public async startArtistOnboarding(
    userId: string,
    artistId: string,
  ): Promise<string> {
    await this.access.requireActiveUser(userId);
    await this.access.requireManager(userId, artistId);

    let account = await this.db.payments.getAccountByArtistId(artistId);
    if (!account) {
      const created = await this.createStandardAccount({ artistId });
      account = await this.db.payments.upsertArtistAccount(
        artistId,
        created.id,
      );
    }

    return this.onboardingLink(
      account.stripeAccountId,
      `/manage/artists/${artistId}/payments`,
    );
  }

  /**
   * Start or resume a designer's onboarding, to sell paid designs.
   *
   * @returns The Stripe page to send the designer to.
   * @throws ApiError 403 when the user is suspended.
   */
  public async startDesignerOnboarding(userId: string): Promise<string> {
    await this.access.requireActiveUser(userId);

    let account = await this.db.payments.getAccountByDesignerUserId(userId);
    if (!account) {
      const created = await this.createStandardAccount({
        designerUserId: userId,
      });
      account = await this.db.payments.upsertDesignerAccount(
        userId,
        created.id,
      );
    }

    return this.onboardingLink(
      account.stripeAccountId,
      '/manage/designs/payments',
    );
  }

  /**
   * What an artist's payment account can do, for its managers.
   *
   * @throws ApiError 403 when the user does not manage the artist.
   */
  public async getArtistStatus(
    userId: string,
    artistId: string,
  ): Promise<PayoutAccountStatus> {
    await this.access.requireManager(userId, artistId);
    return this.toStatus(await this.db.payments.getAccountByArtistId(artistId));
  }

  /**
   * What a designer's own payment account can do.
   */
  public async getDesignerStatus(userId: string): Promise<PayoutAccountStatus> {
    return this.toStatus(
      await this.db.payments.getAccountByDesignerUserId(userId),
    );
  }

  /**
   * Ask Stripe for an artist's account state now, as when a manager returns
   * from onboarding before Stripe's webhook has arrived.
   *
   * @throws ApiError 403 when the user does not manage the artist.
   */
  public async refreshArtistStatus(
    userId: string,
    artistId: string,
  ): Promise<PayoutAccountStatus> {
    await this.access.requireManager(userId, artistId);
    return this.refresh(await this.db.payments.getAccountByArtistId(artistId));
  }

  /**
   * Ask Stripe for a designer's account state now.
   */
  public async refreshDesignerStatus(
    userId: string,
  ): Promise<PayoutAccountStatus> {
    return this.refresh(
      await this.db.payments.getAccountByDesignerUserId(userId),
    );
  }

  /**
   * Bring IME's copy of a connected account up to date with Stripe, as when
   * Stripe says it changed. Reads the account fresh, so events arriving out of
   * order cannot leave stale status behind.
   */
  public async syncFromStripe(stripeAccountId: string): Promise<void> {
    let account: Stripe.Account;
    try {
      account = await this.stripe.accounts.retrieve(stripeAccountId);
    } catch (error) {
      // IME can no longer read an account the seller disconnected
      if (error instanceof Stripe.errors.StripePermissionError) {
        return this.markDisconnected(stripeAccountId);
      }
      throw error;
    }
    await this.sync(account);
  }

  /**
   * Record that a seller disconnected IME from their Stripe account. Nothing
   * of theirs can be sold until they connect again.
   */
  public async markDisconnected(stripeAccountId: string): Promise<void> {
    await this.db.payments.syncAccountFromStripe(stripeAccountId, {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      defaultCurrency: null,
    });
  }

  /**
   * Create a Standard connected account: the seller gets Stripe's full
   * dashboard, pays their own Stripe fees, and carries their own losses.
   */
  private createStandardAccount(
    owner: { artistId: string } | { designerUserId: string },
  ): Promise<Stripe.Account> {
    return this.stripe.accounts.create({
      controller: {
        stripe_dashboard: { type: 'full' },
        fees: { payer: 'account' },
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
      },
      metadata: owner,
    });
  }

  private async onboardingLink(
    stripeAccountId: string,
    returnPath: string,
  ): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      return_url: `${this.webAppUrl}${returnPath}`,
      // an expired link brings the seller back to ask for a new one
      refresh_url: `${this.webAppUrl}${returnPath}?onboarding=expired`,
    });
    return link.url;
  }

  private async refresh(
    account: PayoutAccount | null,
  ): Promise<PayoutAccountStatus> {
    if (!account) return NOT_CONNECTED;

    await this.syncFromStripe(account.stripeAccountId);
    return this.toStatus(
      await this.db.payments.getAccountByStripeAccountId(
        account.stripeAccountId,
      ),
    );
  }

  private sync(account: Stripe.Account) {
    const currency = account.default_currency;
    return this.db.payments.syncAccountFromStripe(account.id, {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      defaultCurrency:
        currency && SUPPORTED_CURRENCIES.has(currency)
          ? (currency as Currency)
          : null,
    });
  }

  private toStatus(account: PayoutAccount | null): PayoutAccountStatus {
    if (!account) return NOT_CONNECTED;
    return {
      connected: true,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      currency: account.defaultCurrency,
    };
  }
}
