import Stripe from 'stripe';
import { DatabaseRepository } from '@ime/db';
import { env } from '@ime/env';
import { AccessService } from './access/access-service';
import { ArtistPageService } from './artist-pages';
import { ArtistService } from './artists';
import { AuthService } from './auth';
import { EmailService } from './email';
import {
  BillingService,
  CostShareService,
  DonationService,
  FundingJobsService,
  FundingService,
  MonthlyCloseService,
  PublicCostsService,
} from './funding';
import { HealthService } from './health';
import { PaymentAccountService } from './payments';
import { CatalogService, ReleaseService } from './releases';
import { CloudStorageService } from './storage';
import { TranscodeService } from './transcoding';
import { UserService } from './users';
import { StripeWebhookService } from './webhooks';

/**
 * What the services share. Pass your own to point them somewhere else, such
 * as a database bound to a transaction or a stand-in for email.
 */
export interface ImeServiceDependencies {
  db?: DatabaseRepository;
  stripe?: Stripe;
  storage?: CloudStorageService;
  email?: EmailService;
}

/**
 * Every service apps call, built once and sharing one database, Stripe
 * client, storage client, and email sender. An app creates one at startup and
 * hands each route or job the services it needs.
 */
export class ImeServices {
  public readonly auth: AuthService;
  public readonly users: UserService;
  public readonly artists: ArtistService;
  public readonly releases: ReleaseService;
  public readonly catalog: CatalogService;
  public readonly artistPages: ArtistPageService;
  public readonly paymentAccounts: PaymentAccountService;
  public readonly billing: BillingService;
  public readonly costShares: CostShareService;
  public readonly donations: DonationService;
  public readonly publicCosts: PublicCostsService;
  public readonly monthlyClose: MonthlyCloseService;
  public readonly stripeWebhooks: StripeWebhookService;
  public readonly fundingJobs: FundingJobsService;
  public readonly transcode: TranscodeService;
  public readonly health: HealthService;

  constructor({
    db = new DatabaseRepository(),
    stripe = new Stripe(env.STRIPE_SECRET_KEY),
    storage = new CloudStorageService(),
    email = new EmailService(),
  }: ImeServiceDependencies = {}) {
    const access = new AccessService(db);
    const funding = new FundingService(db);
    const webAppUrl = env.WEB_APP_URL;

    this.auth = new AuthService(db);
    this.users = new UserService(db);
    this.artists = new ArtistService(db, storage, access);
    this.releases = new ReleaseService(db, storage, access, funding);
    this.catalog = new CatalogService(db, storage);
    this.artistPages = new ArtistPageService(db, storage);

    this.paymentAccounts = new PaymentAccountService(
      db,
      stripe,
      access,
      webAppUrl,
    );
    this.billing = new BillingService(db, stripe, funding);
    this.costShares = new CostShareService(db, access);
    this.donations = new DonationService(db, stripe, webAppUrl);
    this.publicCosts = new PublicCostsService(db);
    this.monthlyClose = new MonthlyCloseService(
      db,
      access,
      funding,
      this.billing,
      email,
      webAppUrl,
    );
    this.stripeWebhooks = new StripeWebhookService(
      db,
      stripe,
      this.billing,
      this.donations,
      this.paymentAccounts,
    );

    this.fundingJobs = new FundingJobsService(db, storage, email, webAppUrl);
    this.transcode = new TranscodeService(db, storage);
    this.health = new HealthService();
  }
}
