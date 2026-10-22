// What apps build at startup. It is the only way to create services, so every
// service shares one database, Stripe client, storage client, and email sender.
export { ImeServices, type ImeServiceDependencies } from './lib/ime-services';

// Everything below is a type, for the routes and jobs that take a service

// Accounts and artists
export type { AuthService } from './lib/auth/auth-service';
export type {
  UpdateProfileParams,
  UserService,
} from './lib/users/user-service';
export type {
  ArtistProfile,
  ArtistService,
  CreateArtistInput,
  LinkInput,
  UpdateArtistInput,
} from './lib/artists/artist-service';
export { HANDLE_MAX_LENGTH, SLUG_MAX_LENGTH } from './lib/naming/naming-utils';

// Releases and listening
export type {
  AssetChanges,
  AssetInput,
  CreateReleaseInput,
  PricingInput,
  ReleaseService,
  TrackInput,
  UpdateReleaseInput,
} from './lib/releases/release-service';
export type {
  CatalogService,
  ReleasePage,
  ReleasePageAsset,
} from './lib/releases/catalog-service';
export type { ArtistPageService } from './lib/artist-pages/artist-page-service';
export type { ChartService } from './lib/discovery/chart-service';
export type { CrateService } from './lib/discovery/crate-service';
export type { DigService } from './lib/discovery/dig-service';
export type { SearchService } from './lib/discovery/search-service';
export type { ShelfService } from './lib/discovery/shelf-service';

// Merch
export type {
  CreateProductInput,
  ManagedProduct,
  ProductImageChanges,
  ProductImageInput,
  ProductService,
  ShippingRateInput,
  UpdateProductInput,
  VariantChanges,
  VariantInput,
} from './lib/merch/product-service';
export type {
  ProductPage,
  StoreItem,
  StoreService,
  StoreVariant,
} from './lib/merch/store-service';

// Buying and selling
export type {
  ArtistPayment,
  CartItem,
  CheckoutInput,
  CheckoutService,
  ShippingAddress,
  StartedCheckout,
} from './lib/orders/checkout-service';
export type {
  PurchaseDetail,
  PurchaseService,
} from './lib/orders/purchase-service';
export type {
  SaleDetail,
  SalesService,
  ShipmentInput,
} from './lib/orders/sales-service';

// Community
export { COMMENT_MAX_LENGTH } from './lib/community/comment-service';
export type { CommentService } from './lib/community/comment-service';
export type { FollowService } from './lib/community/follow-service';

// Creative pages
export type {
  CreateDesignInput,
  DesignChanges,
  DesignService,
  DesignVersionInput,
  ManagedDesign,
} from './lib/designs/design-service';
export type { DesignGalleryService } from './lib/designs/design-gallery-service';
export type {
  DesignAcquisition,
  DesignMarketplaceService,
  MarketplaceDesign,
} from './lib/designs/design-marketplace-service';
export type {
  ManagedReleaseDesign,
  ReleaseDesignService,
  SlotImage,
} from './lib/designs/release-design-service';

// Moderation
export { CONTEST_DAYS } from './lib/moderation/report-service';
export type {
  ModerationTargetRef,
  ReleaseTakedown,
  ReportService,
} from './lib/moderation/report-service';
export { REPEAT_INFRINGER_TAKEDOWNS } from './lib/moderation/moderation-service';
export type {
  CopyrightClaimInput,
  ModerationCase,
  ModerationDecision,
  ModerationOutcome,
  ModerationService,
  ModerationSubject,
  QueueEntry,
} from './lib/moderation/moderation-service';

// Getting paid and funding
export { STRIPE_DASHBOARD_URL } from './lib/payments/payment-account-service';
export type {
  PaymentAccountService,
  PayoutAccountStatus,
} from './lib/payments/payment-account-service';
export { MAX_TOP_UP, MIN_TOP_UP } from './lib/funding/billing-service';
export type {
  BillingOverview,
  BillingService,
  BillingSettingsInput,
  TopUpInput,
  TopUpResult,
} from './lib/funding/billing-service';
export type {
  ArtistCostSplit,
  CostShareService,
  ShareInput,
} from './lib/funding/cost-share-service';
export type {
  DonationInput,
  DonationService,
} from './lib/funding/donation-service';
export type {
  PublicCostMonth,
  PublicCosts,
  PublicCostsService,
} from './lib/funding/public-costs-service';
export {
  GRACE_DAYS,
  SHARED_COST_CAP,
} from './lib/funding/monthly-close-service';
export type {
  CloseSummary,
  MonthlyCloseService,
  PeriodRates,
} from './lib/funding/monthly-close-service';
export type { StripeWebhookService } from './lib/webhooks/stripe-webhook-service';

// Background work
export type { FundingJobsService } from './lib/funding/funding-jobs-service';
export type { ModerationJobsService } from './lib/moderation/moderation-jobs-service';
export type { TranscodeService } from './lib/transcoding/transcode-service';

// Operations
export type { HealthService } from './lib/health/health-service';

// Building blocks, for writing stand-ins to pass to ImeServices
export type {
  CloudStorageService,
  StoredObject,
} from './lib/storage/cloud-storage-service';
export type { UploadTarget } from './lib/storage/upload-service';
export type { Email, EmailService } from './lib/email/email-service';
