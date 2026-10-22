import Stripe from 'stripe';
import { DatabaseRepository } from '@ime/db';
import { env } from '@ime/env';
import { AccessService } from './access/access-service';
import { ArtistPageService } from './artist-pages';
import { ArtistService } from './artists';
import { AuthService } from './auth';
import { CommentService, FollowService } from './community';
import {
  DesignMarketplaceService,
  DesignService,
  ReleaseDesignService,
} from './designs';
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
import { SearchService, ShelfService } from './discovery';
import { ProductService, StoreService } from './merch';
import {
  ModerationJobsService,
  ModerationService,
  ReportService,
} from './moderation';
import { CheckoutService, PurchaseService, SalesService } from './orders';
import { PaymentAccountService } from './payments';
import {
  CatalogService,
  ReleaseFilesService,
  ReleaseService,
} from './releases';
import { SellingGateService } from './selling';
import { CloudStorageService, UploadService } from './storage';
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
  public readonly shelves: ShelfService;
  public readonly search: SearchService;
  public readonly artistPages: ArtistPageService;
  public readonly products: ProductService;
  public readonly store: StoreService;
  public readonly checkout: CheckoutService;
  public readonly purchases: PurchaseService;
  public readonly sales: SalesService;
  public readonly follows: FollowService;
  public readonly comments: CommentService;
  public readonly designs: DesignService;
  public readonly designMarketplace: DesignMarketplaceService;
  public readonly releaseDesigns: ReleaseDesignService;
  public readonly reports: ReportService;
  public readonly moderation: ModerationService;
  public readonly paymentAccounts: PaymentAccountService;
  public readonly billing: BillingService;
  public readonly costShares: CostShareService;
  public readonly donations: DonationService;
  public readonly publicCosts: PublicCostsService;
  public readonly monthlyClose: MonthlyCloseService;
  public readonly stripeWebhooks: StripeWebhookService;
  public readonly fundingJobs: FundingJobsService;
  public readonly moderationJobs: ModerationJobsService;
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
    const uploads = new UploadService(storage);
    const gate = new SellingGateService(db, funding);
    const releaseFiles = new ReleaseFilesService(db, storage);
    const webAppUrl = env.WEB_APP_URL;

    this.users = new UserService(db);
    this.artists = new ArtistService(db, storage, access, uploads);
    this.releases = new ReleaseService(db, storage, access, gate, uploads);
    this.catalog = new CatalogService(db, storage);
    this.shelves = new ShelfService(db, storage);
    this.search = new SearchService(db, storage);
    this.artistPages = new ArtistPageService(db, storage);
    this.products = new ProductService(db, storage, access, gate, uploads);
    this.store = new StoreService(db, storage);

    this.paymentAccounts = new PaymentAccountService(
      db,
      stripe,
      access,
      webAppUrl,
    );
    this.checkout = new CheckoutService(db, stripe, gate, email, webAppUrl);
    this.purchases = new PurchaseService(db, email, webAppUrl);
    this.sales = new SalesService(db, stripe, access, email, webAppUrl);
    this.follows = new FollowService(db, access);
    this.comments = new CommentService(db, access);
    this.designs = new DesignService(db, storage, access, gate, uploads);
    this.designMarketplace = new DesignMarketplaceService(
      db,
      stripe,
      access,
      gate,
      webAppUrl,
    );
    this.releaseDesigns = new ReleaseDesignService(
      db,
      storage,
      access,
      uploads,
    );
    this.billing = new BillingService(db, stripe, funding);
    this.auth = new AuthService(db, this.billing, webAppUrl);
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
      this.checkout,
      this.sales,
      this.designMarketplace,
    );

    this.reports = new ReportService(db, access);
    this.moderation = new ModerationService(
      db,
      stripe,
      access,
      this.designMarketplace,
      releaseFiles,
      email,
      webAppUrl,
    );
    this.moderationJobs = new ModerationJobsService(db, this.moderation);
    this.fundingJobs = new FundingJobsService(
      db,
      releaseFiles,
      email,
      webAppUrl,
    );
    this.transcode = new TranscodeService(db, storage);
    this.health = new HealthService();
  }
}
