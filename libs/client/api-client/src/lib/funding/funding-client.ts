import {
  type AckResponse,
  ApiRoute,
  type BillingOverview,
  type BillingSettingsRequest,
  type CostSplit,
  type DonationRequest,
  type PayoutAccountStatus,
  type PublicCosts,
  type RedirectResponse,
  type SellerBillingResponse,
  type TopUpRequest,
  type TopUpResult,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Getting paid and paying for hosting: payment accounts, the hosting
 * balance, cost splits, donations, and the public costs page.
 */
export class FundingClient {
  constructor(private readonly transport: ApiTransport) {}

  public getArtistPaymentAccount(
    artistId: string,
  ): Promise<ApiResult<PayoutAccountStatus>> {
    return this.transport.get(ApiRoute.ArtistPaymentAccount, {
      params: { artistId },
    });
  }

  /**
   * Start or resume an artist's Stripe onboarding. Send the manager to the
   * returned page.
   */
  public startArtistOnboarding(
    artistId: string,
  ): Promise<ApiResult<RedirectResponse>> {
    return this.transport.post(ApiRoute.ArtistPaymentOnboarding, {
      params: { artistId },
    });
  }

  /**
   * Ask Stripe for the account's status now, as when coming back from
   * onboarding.
   */
  public refreshArtistPaymentAccount(
    artistId: string,
  ): Promise<ApiResult<PayoutAccountStatus>> {
    return this.transport.post(ApiRoute.ArtistPaymentRefresh, {
      params: { artistId },
    });
  }

  /**
   * The signed-in designer's payment account.
   */
  public getMyPaymentAccount(): Promise<ApiResult<PayoutAccountStatus>> {
    return this.transport.get(ApiRoute.MyPaymentAccount);
  }

  public startMyOnboarding(): Promise<ApiResult<RedirectResponse>> {
    return this.transport.post(ApiRoute.MyPaymentOnboarding);
  }

  public refreshMyPaymentAccount(): Promise<ApiResult<PayoutAccountStatus>> {
    return this.transport.post(ApiRoute.MyPaymentRefresh);
  }

  /**
   * The signed-in seller's hosting balance, settings, and statements.
   */
  public getBilling(): Promise<ApiResult<BillingOverview>> {
    return this.transport.get(ApiRoute.MyBilling);
  }

  /**
   * Start saving a card. Confirm it in the browser with Stripe using the
   * client secret, then call `confirmCard`.
   */
  public async createCardSetup(): Promise<ApiResult<string>> {
    const result = await this.transport.post(ApiRoute.MyBillingCardSetup);
    return result.ok ? { ok: true, data: result.data.clientSecret } : result;
  }

  public confirmCard(setupIntentId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.put(ApiRoute.MyBillingCard, {
      body: { setupIntentId },
    });
  }

  public removeCard(): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.MyBillingCard);
  }

  public updateSettings(
    settings: BillingSettingsRequest,
  ): Promise<ApiResult<SellerBillingResponse>> {
    return this.transport.patch(ApiRoute.MyBillingSettings, {
      body: settings,
    });
  }

  /**
   * Top up the hosting balance from the saved card. A card that needs the
   * holder's approval returns a client secret to finish it with in the
   * browser.
   */
  public topUp(topUp: TopUpRequest): Promise<ApiResult<TopUpResult>> {
    return this.transport.post(ApiRoute.MyBillingTopUps, { body: topUp });
  }

  /**
   * Refund the unused balance to the card, once nothing is on sale.
   */
  public async refundBalance(): Promise<ApiResult<number>> {
    const result = await this.transport.post(ApiRoute.MyBillingRefund);
    return result.ok ? { ok: true, data: result.data.refunded } : result;
  }

  public getCostSplit(artistId: string): Promise<ApiResult<CostSplit>> {
    return this.transport.get(ApiRoute.ArtistCostSplit, {
      params: { artistId },
    });
  }

  /**
   * Propose a new split. It applies once every manager in it accepts.
   */
  public proposeCostSplit(
    artistId: string,
    shares: { userId: string; shareBasisPoints: number }[],
  ): Promise<ApiResult<CostSplit>> {
    return this.transport.put(ApiRoute.ArtistCostSplit, {
      params: { artistId },
      body: { shares },
    });
  }

  /**
   * Accept your share of a proposed split.
   *
   * @returns Whether the split now applies, or still waits on others.
   */
  public async acceptCostShare(
    artistId: string,
  ): Promise<ApiResult<'accepted' | 'applied'>> {
    const result = await this.transport.post(ApiRoute.ArtistCostSplitAccept, {
      params: { artistId },
    });
    return result.ok ? { ok: true, data: result.data.outcome } : result;
  }

  public withdrawCostSplit(artistId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.delete(ApiRoute.ArtistCostSplitProposal, {
      params: { artistId },
    });
  }

  /**
   * Start a donation. Send the donor to the returned Stripe page.
   */
  public donate(
    donation: DonationRequest,
  ): Promise<ApiResult<RedirectResponse>> {
    return this.transport.post(ApiRoute.Donations, { body: donation });
  }

  /**
   * The public costs page.
   *
   * @param months - How many recent closed months to show.
   */
  public getPublicCosts(months?: number): Promise<ApiResult<PublicCosts>> {
    return this.transport.get(ApiRoute.PublicCosts, { query: { months } });
  }
}
