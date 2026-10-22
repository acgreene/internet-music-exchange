import { ApiRoute, HttpMethod } from '@ime/models';
import type {
  BillingService,
  CostShareService,
  DonationService,
  PaymentAccountService,
  PublicCostsService,
} from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Getting paid and paying for hosting: sellers' Stripe accounts, prepaid
 * hosting balances, how an artist's costs are split, donations, and the
 * public costs page.
 */
export class FundingRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly paymentAccounts: PaymentAccountService,
    private readonly billing: BillingService,
    private readonly costShares: CostShareService,
    private readonly donations: DonationService,
    private readonly publicCosts: PublicCostsService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.registerPaymentAccounts();
    this.registerBilling();
    this.registerCostSplits();

    this.handle(
      HttpMethod.Post,
      ApiRoute.Donations,
      'optional',
      async ({ userId, body }) => ({
        url: await this.donations.createDonationCheckout({ ...body, userId }),
      }),
    );

    this.handle(HttpMethod.Get, ApiRoute.PublicCosts, 'public', ({ query }) =>
      this.publicCosts.getPublicCosts(query.months),
    );
  }

  private registerPaymentAccounts(): void {
    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistPaymentAccount,
      'user',
      ({ userId, params }) =>
        this.paymentAccounts.getArtistStatus(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ArtistPaymentOnboarding,
      'user',
      async ({ userId, params }) => ({
        url: await this.paymentAccounts.startArtistOnboarding(
          userId,
          params.artistId,
        ),
      }),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ArtistPaymentRefresh,
      'user',
      ({ userId, params }) =>
        this.paymentAccounts.refreshArtistStatus(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.MyPaymentAccount,
      'user',
      ({ userId }) => this.paymentAccounts.getDesignerStatus(userId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.MyPaymentOnboarding,
      'user',
      async ({ userId }) => ({
        url: await this.paymentAccounts.startDesignerOnboarding(userId),
      }),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.MyPaymentRefresh,
      'user',
      ({ userId }) => this.paymentAccounts.refreshDesignerStatus(userId),
    );
  }

  private registerBilling(): void {
    this.handle(HttpMethod.Get, ApiRoute.MyBilling, 'user', ({ userId }) =>
      this.billing.getOverview(userId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.MyBillingCardSetup,
      'user',
      async ({ userId }) => ({
        clientSecret: await this.billing.createCardSetup(userId),
      }),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.MyBillingCard,
      'user',
      ({ userId, body }) =>
        this.billing.confirmCard(userId, body.setupIntentId),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.MyBillingCard,
      'user',
      ({ userId }) => this.billing.removeCard(userId),
    );

    this.handle(
      HttpMethod.Patch,
      ApiRoute.MyBillingSettings,
      'user',
      ({ userId, body }) => this.billing.updateSettings(userId, body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.MyBillingTopUps,
      'user',
      ({ userId, body }) => this.billing.topUp(userId, body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.MyBillingRefund,
      'user',
      async ({ userId }) => ({
        refunded: await this.billing.refundUnusedBalance(userId),
      }),
    );
  }

  private registerCostSplits(): void {
    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistCostSplit,
      'user',
      ({ userId, params }) => this.costShares.getSplit(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Put,
      ApiRoute.ArtistCostSplit,
      'user',
      ({ userId, params, body }) =>
        this.costShares.proposeSplit(userId, params.artistId, body.shares),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ArtistCostSplitAccept,
      'user',
      async ({ userId, params }) => ({
        outcome: await this.costShares.acceptShare(userId, params.artistId),
      }),
    );

    this.handle(
      HttpMethod.Delete,
      ApiRoute.ArtistCostSplitProposal,
      'user',
      ({ userId, params }) =>
        this.costShares.withdrawProposal(userId, params.artistId),
    );
  }
}
