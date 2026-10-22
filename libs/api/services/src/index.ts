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
  ImageUpload,
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
