/**
 * Route paths served by the API. Values are wire format, shared by the server
 * for route registration and by the client SDK for request paths.
 */
export enum ApiRoute {
  /**
   * API health check.
   */
  Health = '/api/health',

  /**
   * The signed-in user resource: DELETE permanently removes the account.
   */
  Users = '/api/users',

  /**
   * Create an account.
   */
  SignUp = '/api/auth/sign-up',

  /**
   * Exchange email and password for a session.
   */
  SignIn = '/api/auth/sign-in',

  /**
   * Revoke the caller's session.
   */
  SignOut = '/api/auth/sign-out',

  /**
   * Everything needed to render a release within a designer page.
   */
  ArtistReleasePage = '/api/artist-pages/releases/:releaseId',

  // Accounts

  /** The signed-in user's own profile: GET reads it, PATCH changes it. */
  Me = '/api/me',

  /** Anyone's public profile. */
  UserProfile = '/api/users/:username',

  /** Whether a username is free. */
  UsernameAvailability = '/api/availability/usernames/:username',

  /** Whether an artist handle is free. */
  HandleAvailability = '/api/availability/handles/:handle',

  // Artists

  /** Create an artist. */
  Artists = '/api/artists',

  /** The artists the signed-in user manages. */
  MyArtists = '/api/me/artists',

  /** Change an artist's name, handle, or bio. */
  Artist = '/api/artists/:artistId',

  /** An artist's public profile, by handle. */
  CatalogArtist = '/api/catalog/artists/:handle',

  /** Replace an artist's links. */
  ArtistLinks = '/api/artists/:artistId/links',

  /** Somewhere to upload an artist's avatar or header. */
  ArtistImageUploads = '/api/artists/:artistId/images/:kind/uploads',

  /** PUT records an uploaded avatar or header; DELETE removes it. */
  ArtistImage = '/api/artists/:artistId/images/:kind',

  /** GET lists an artist's managers; POST adds one by username. */
  ArtistManagers = '/api/artists/:artistId/managers',

  /** Remove one of an artist's managers. */
  ArtistManager = '/api/artists/:artistId/managers/:userId',

  // Releases, for managers

  /** POST starts a draft release; GET lists every release of the artist. */
  ArtistReleases = '/api/artists/:artistId/releases',

  /** A release with everything its managers edit. */
  Release = '/api/releases/:releaseId',

  /** Set how a release is priced. */
  ReleasePricing = '/api/releases/:releaseId/pricing',

  /** Put a release on sale. */
  ReleasePublish = '/api/releases/:releaseId/publish',

  /** Withdraw a release from the catalog. Owners keep it. */
  ReleaseArchive = '/api/releases/:releaseId/archive',

  /** POST adds a track; PUT sets the track order. */
  ReleaseTracks = '/api/releases/:releaseId/tracks',

  /** Rename a track or set its length. */
  Track = '/api/tracks/:trackId',

  /** Take a track off a release. */
  ReleaseTrack = '/api/releases/:releaseId/tracks/:trackId',

  /** Whether anyone may stream a track as a preview. */
  ReleaseTrackPreview = '/api/releases/:releaseId/tracks/:trackId/preview',

  /** Somewhere to upload a track's audio. */
  TrackAudioUploads = '/api/releases/:releaseId/tracks/:trackId/audio/uploads',

  /** Record a track's uploaded audio. */
  TrackAudio = '/api/releases/:releaseId/tracks/:trackId/audio',

  /** Somewhere to upload artwork or another release asset. */
  ReleaseAssetUploads = '/api/releases/:releaseId/assets/uploads',

  /** Record an uploaded release asset. */
  ReleaseAssets = '/api/releases/:releaseId/assets',

  /** PATCH changes an asset's details; DELETE removes it. */
  ReleaseAsset = '/api/assets/:assetId',

  /** Give a listener a release, by username. */
  ReleaseGifts = '/api/releases/:releaseId/gifts',

  // Catalog and library, for listeners

  /** The newest releases. */
  CatalogReleases = '/api/catalog/releases',

  /** The home page's shelves and how much of each format is on offer. */
  CatalogHome = '/api/catalog/home',

  /** Search artists and releases, `?q=`. */
  CatalogSearch = '/api/catalog/search',
  CatalogSuggest = '/api/catalog/suggest',
  CatalogPlaces = '/api/catalog/places',

  /** An artist's published releases. */
  CatalogDiscography = '/api/catalog/artists/:handle/releases',

  /** A release page. */
  CatalogReleasePage = '/api/catalog/artists/:handle/releases/:slug',

  /** A link that streams one track. */
  CatalogTrackStream = '/api/catalog/releases/:releaseId/tracks/:trackId/stream',

  /** A link that downloads one track's original, for owners. */
  CatalogTrackDownload = '/api/catalog/releases/:releaseId/tracks/:trackId/download',

  /** A link that opens a release asset. */
  CatalogAsset = '/api/catalog/assets/:assetId',

  /** The releases the signed-in user owns. */
  MyLibrary = '/api/me/library',

  /** New releases from the artists the signed-in user follows. */
  MyFeed = '/api/me/feed',

  // Merch

  /** POST starts a draft product; GET lists every product of the artist. */
  ArtistProducts = '/api/artists/:artistId/products',

  /** A product with everything its managers edit. */
  Product = '/api/products/:productId',

  /** Put a product in the store. */
  ProductPublish = '/api/products/:productId/publish',

  /** Pull a product from sale. */
  ProductArchive = '/api/products/:productId/archive',

  /** Add a buyable variant. */
  ProductVariants = '/api/products/:productId/variants',

  /** PATCH changes a variant; DELETE removes one that never sold. */
  Variant = '/api/variants/:variantId',

  /** Set how many units of a variant are on hand. */
  VariantStock = '/api/variants/:variantId/stock',

  /** Somewhere to upload a product photo. */
  ProductImageUploads = '/api/products/:productId/images/uploads',

  /** Record an uploaded product photo. */
  ProductImages = '/api/products/:productId/images',

  /** PATCH changes a photo; DELETE removes it. */
  ProductImage = '/api/product-images/:imageId',

  /** PUT sets what a product costs to ship to a zone; DELETE stops shipping there. */
  ProductShippingRate = '/api/products/:productId/shipping-rates/:destination',

  /** An artist's store. */
  CatalogStore = '/api/catalog/artists/:handle/store',

  /** A release's physical editions. */
  CatalogEditions = '/api/catalog/releases/:releaseId/editions',

  /** A product page. */
  CatalogProduct = '/api/catalog/products/:productId',

  // Buying and selling

  /** Check a cart out: one payment per artist, free releases granted. */
  Checkout = '/api/checkout',

  /** The signed-in user's purchases. */
  MyPurchases = '/api/me/purchases',

  /** One of the signed-in user's purchases. */
  Purchase = '/api/purchases/:artistOrderId',

  /** Ask the artist to refund a purchase. */
  PurchaseRefundRequest = '/api/purchases/:artistOrderId/refund-request',

  /** An artist's sales. */
  ArtistSales = '/api/artists/:artistId/sales',

  /** An artist's paid sales still waiting to ship, oldest first. */
  ArtistSalesToShip = '/api/artists/:artistId/sales/to-ship',

  /** An artist's settled sales totals, per currency. */
  ArtistSalesTotals = '/api/artists/:artistId/sales/totals',

  /** One sale, with what is needed to ship it. */
  Sale = '/api/sales/:artistOrderId',

  /** Mark a sale shipped, with its tracking. */
  SaleShipment = '/api/sales/:artistOrderId/shipment',

  /** Mark a shipped sale delivered. */
  SaleDelivered = '/api/sales/:artistOrderId/delivered',

  /** Refund a sale in full. */
  SaleRefund = '/api/sales/:artistOrderId/refund',

  // Community

  /** PUT follows an artist; DELETE unfollows. */
  ArtistFollow = '/api/artists/:artistId/follow',

  /** Public crates, `?limit=&offset=`; making a crate. */
  Crates = '/api/crates',

  /** A crate IME builds from a genre or a tag, `?genre=` or `?tag=`. */
  CrateBySound = '/api/crates/sound',

  /** A crate IME builds from a few records someone loves. */
  CrateFromRecords = '/api/crates/from-records',

  /** A crate's page; changing or deleting it. */
  Crate = '/api/crates/:crateId',

  /** Adding a release to a crate; putting its releases in a new order. */
  CrateReleases = '/api/crates/:crateId/releases',

  /** A release in a crate: its line, or taking it out. */
  CrateRelease = '/api/crates/:crateId/releases/:releaseId',

  /** The signed-in user's crates, `?releaseId=` to say which hold it. */
  MyCrates = '/api/me/crates',

  /** A crate built from the signed-in listener's library, new each day. */
  CrateOfTheDay = '/api/me/crate-of-the-day',

  /** New public crates by the people the signed-in user follows. */
  FollowedCrates = '/api/me/followed-crates',

  /** Someone's public crates, by username. */
  UserCrates = '/api/users/:username/crates',

  /** A chart, `?period=week|month|year|all&genre=&format=`. */
  Charts = '/api/charts',

  /** Digging a crate someone made, `?depth=`. */
  DigCrate = '/api/dig/crates/:crateId',

  /** Digging a crate by sound, `?genre=` or `?tag=`, and `?depth=`. */
  DigSound = '/api/dig/sound',

  /** Following someone whose crates you like. */
  UserFollow = '/api/users/:userId/follow',

  /** The artists the signed-in user follows. */
  MyFollowing = '/api/me/following',

  /** Which of some artists the signed-in user follows. */
  MyFollowingFilter = '/api/me/following/filter',

  /** Who follows an artist, for its managers. */
  ArtistFollowers = '/api/artists/:artistId/followers',

  /** Remove one of an artist's followers. */
  ArtistFollower = '/api/artists/:artistId/followers/:userId',

  /** A release's comments. */
  CatalogComments = '/api/catalog/releases/:releaseId/comments',

  /** The people who bought or claimed a release and let it show. */
  CatalogSupporters = '/api/catalog/releases/:releaseId/supporters',

  /** Comment on a release. */
  ReleaseComments = '/api/releases/:releaseId/comments',

  /** PATCH edits your own comment; DELETE removes it, or any on your artist. */
  Comment = '/api/comments/:commentId',

  // Creative pages

  /** Start a draft design. */
  Designs = '/api/designs',

  /** The designs the signed-in user made. */
  MyDesigns = '/api/me/designs',

  /** The signed-in designer's paid sales. */
  MyDesignSales = '/api/me/design-sales',

  /** One of the signed-in user's designs, with its versions and usage. */
  Design = '/api/designs/:designId',

  /** Price a design like a release. */
  DesignPricing = '/api/designs/:designId/pricing',

  /** Somewhere to upload a new version's HTML file. */
  DesignVersionUploads = '/api/designs/:designId/versions/uploads',

  /** Record an uploaded version with its slots. */
  DesignVersions = '/api/designs/:designId/versions',

  /** Make a design available. */
  DesignPublish = '/api/designs/:designId/publish',

  /** Withdraw a design from the marketplace. */
  DesignArchive = '/api/designs/:designId/archive',

  /** Grant an artist a license, by handle. */
  DesignGrants = '/api/designs/:designId/grants',

  /** Public designs, newest first. */
  MarketplaceDesigns = '/api/marketplace/designs',

  /** Search public designs by name, `?q=`. */
  MarketplaceSearch = '/api/marketplace/search',

  /** A public design's marketplace page. */
  MarketplaceDesign = '/api/marketplace/designs/:designId',

  /** Public designs on show to everyone, ready to preview. */
  GalleryDesigns = '/api/gallery/designs',

  /** One design in the gallery, with releases that use it. */
  GalleryDesign = '/api/gallery/designs/:designId',

  /** Ask a design's designer for a custom design. */
  GalleryCommission = '/api/gallery/designs/:designId/commission',

  /** The designs an artist holds licenses for. */
  ArtistDesigns = '/api/artists/:artistId/designs',

  /** Get a design for an artist: claimed at once, or a payment to make. */
  ArtistDesignAcquire = '/api/artists/:artistId/designs/:designId/acquire',

  /** GET reads a release's design; PUT applies one; DELETE goes back to the default layout. */
  ReleaseDesign = '/api/releases/:releaseId/design',

  /** Move a release to its design's newest version. */
  ReleaseDesignUpdate = '/api/releases/:releaseId/design/update',

  /** Set every slot value of a release's design. */
  ReleaseDesignCustomization = '/api/releases/:releaseId/design/customization',

  /** Somewhere to upload an image for a design slot. */
  ReleaseDesignImageUploads = '/api/releases/:releaseId/design/images/uploads',

  /** Record an uploaded slot image. */
  ReleaseDesignImages = '/api/releases/:releaseId/design/images',

  /** Delete a slot image. */
  DesignImage = '/api/design-images/:imageId',

  // Getting paid and funding

  /** An artist's payment account status. */
  ArtistPaymentAccount = '/api/artists/:artistId/payment-account',

  /** Start or resume an artist's Stripe onboarding. */
  ArtistPaymentOnboarding = '/api/artists/:artistId/payment-account/onboarding',

  /** Ask Stripe for an artist's account status now. */
  ArtistPaymentRefresh = '/api/artists/:artistId/payment-account/refresh',

  /** The signed-in designer's payment account status. */
  MyPaymentAccount = '/api/me/payment-account',

  /** Start or resume the signed-in designer's Stripe onboarding. */
  MyPaymentOnboarding = '/api/me/payment-account/onboarding',

  /** Ask Stripe for the signed-in designer's account status now. */
  MyPaymentRefresh = '/api/me/payment-account/refresh',

  /** The signed-in seller's hosting balance, settings, and statements. */
  MyBilling = '/api/me/billing',

  /** Start saving a card. */
  MyBillingCardSetup = '/api/me/billing/card-setup',

  /** PUT saves the card a seller confirmed; DELETE removes it. */
  MyBillingCard = '/api/me/billing/card',

  /** Change alert and auto top-up settings. */
  MyBillingSettings = '/api/me/billing/settings',

  /** Top up the hosting balance. */
  MyBillingTopUps = '/api/me/billing/top-ups',

  /** Refund the unused balance once nothing is on sale. */
  MyBillingRefund = '/api/me/billing/refund',

  /** GET reads how an artist's costs are split; PUT proposes a new split. */
  ArtistCostSplit = '/api/artists/:artistId/cost-split',

  /** Accept your share of a proposed split. */
  ArtistCostSplitAccept = '/api/artists/:artistId/cost-split/accept',

  /** Withdraw a proposed split. */
  ArtistCostSplitProposal = '/api/artists/:artistId/cost-split/proposal',

  /** Start a donation checkout. */
  Donations = '/api/donations',

  /** The public costs page. */
  PublicCosts = '/api/public-costs',

  /** Stripe's events about the platform's own account. */
  StripeWebhook = '/api/webhooks/stripe',

  /** Stripe's events about sellers' connected accounts. */
  StripeConnectWebhook = '/api/webhooks/stripe/connect',

  // Moderation

  /** Report something for an admin to review. */
  Reports = '/api/reports',

  /** Contest a copyright takedown of one of the artist's releases. */
  ReleaseContest = '/api/releases/:releaseId/contest',

  /** The admin queue of items with open reports. */
  AdminReports = '/api/admin/reports',

  /** One item's reports, actions, and any open contest. */
  AdminCase = '/api/admin/cases/:targetType/:targetId',

  /** Close an item's reports without acting on it. */
  AdminCaseDismiss = '/api/admin/cases/:targetType/:targetId/dismiss',

  /** Take an item down, or suspend an artist or user. */
  AdminCaseTakeDown = '/api/admin/cases/:targetType/:targetId/take-down',

  /** Undo a takedown or suspension. */
  AdminCaseRestore = '/api/admin/cases/:targetType/:targetId/restore',

  /** Clear an offensive username and display name. */
  AdminClearProfile = '/api/admin/users/:userId/clear-profile',

  /** Record a copyright claim a rights holder sent to IME. */
  AdminCopyrightClaims = '/api/admin/copyright-claims',

  /** Decide an artist's contest of a copyright takedown. */
  AdminContestDecision = '/api/admin/releases/:releaseId/contest-decision',

  // Monthly close, for admins

  /** Open a month for billing at the provider's rates. */
  AdminBillingPeriods = '/api/admin/billing-periods',

  /** Record one of the month's bills. */
  AdminBillingPeriodCosts = '/api/admin/billing-periods/:month/costs',

  /** Close a month: issue and charge every seller's statement. */
  AdminBillingPeriodClose = '/api/admin/billing-periods/:month/close',
}
