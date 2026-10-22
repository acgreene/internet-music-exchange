// What apps build at startup
export { ImeServices, type ImeServiceDependencies } from './lib/ime-services';

// Accounts and artists
export { AuthService } from './lib/auth/auth-service';
export {
  UserService,
  type UpdateProfileParams,
} from './lib/users/user-service';
export {
  ArtistService,
  type ArtistProfile,
  type CreateArtistInput,
  type ImageUpload,
  type LinkInput,
  type UpdateArtistInput,
} from './lib/artists/artist-service';
export { HANDLE_MAX_LENGTH, SLUG_MAX_LENGTH } from './lib/naming/naming-utils';

// Releases and listening
export {
  ReleaseService,
  type AssetChanges,
  type AssetInput,
  type CreateReleaseInput,
  type PricingInput,
  type TrackInput,
  type UpdateReleaseInput,
  type UploadTarget,
} from './lib/releases/release-service';
export {
  CatalogService,
  type ReleasePage,
  type ReleasePageAsset,
} from './lib/releases/catalog-service';
export { ArtistPageService } from './lib/artist-pages/artist-page-service';

// Getting paid and funding
export {
  PaymentAccountService,
  STRIPE_DASHBOARD_URL,
  type PayoutAccountStatus,
} from './lib/payments/payment-account-service';
export {
  BillingService,
  MAX_TOP_UP,
  MIN_TOP_UP,
  type BillingOverview,
  type BillingSettingsInput,
  type TopUpInput,
  type TopUpResult,
} from './lib/funding/billing-service';
export {
  CostShareService,
  type ArtistCostSplit,
  type ShareInput,
} from './lib/funding/cost-share-service';
export {
  DonationService,
  type DonationInput,
} from './lib/funding/donation-service';
export {
  PublicCostsService,
  type PublicCostMonth,
  type PublicCosts,
} from './lib/funding/public-costs-service';
export {
  GRACE_DAYS,
  MonthlyCloseService,
  SHARED_COST_CAP,
  type CloseSummary,
  type PeriodRates,
} from './lib/funding/monthly-close-service';
export { StripeWebhookService } from './lib/webhooks/stripe-webhook-service';

// Background work
export { FundingJobsService } from './lib/funding/funding-jobs-service';
export { TranscodeService } from './lib/transcoding/transcode-service';

// Operations
export { HealthService } from './lib/health/health-service';

// Building blocks, for wiring services up by hand in scripts and tests
export { AccessService } from './lib/access/access-service';
export { FundingService } from './lib/funding/funding-service';
export {
  CloudStorageService,
  type StoredObject,
} from './lib/storage/cloud-storage-service';
export { EmailService, type Email } from './lib/email/email-service';
