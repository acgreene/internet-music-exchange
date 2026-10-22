# api-services

The business logic of IME. Every rule in the product specs that is more than a
database constraint lives here: who may do what, what has to be true before
something is published or sold, the money flows, and the work that runs on a
schedule. Apps (`apps/api`, `apps/worker`) reach the database only through
these services; importing `@ime/db` from an app is a lint error.

Imported as `@ime/services`. Only what `src/index.ts` lists is public:
`ImeServices`, a few constants, and types. Services are exported as types
only, so apps can name them but never build their own.

## Getting started

An app builds one `ImeServices` at startup and hands each route or job the
services it needs. Every service in it shares one database connection, Stripe
client, storage client, and email sender.

```ts
const services = new ImeServices();
new RootRouter(services);
await services.fundingJobs.runDaily();
```

A route or job takes the one service it uses, typed with `import type`:

```ts
import type { ReleaseService } from '@ime/services';

constructor(private readonly releases: ReleaseService) {}
```

Scripts and tests can swap what is shared, for example
`new ImeServices({ db, email })` with a database bound to a transaction and an
email stand-in.

## Services apps call

Each is a property of `ImeServices`, named in brackets.

### Accounts and artists

- **`AuthService`** (`auth`): sign-up, sign-in, sign-out, token checks, and
  account deletion through Supabase auth. Reach for it in auth routes and the
  auth middleware, and when a user deletes their account (it refuses while
  they are an artist's only manager).
- **`UserService`** (`users`): a user's own and public profile, username
  availability, and editing username, display name, and whether a designer
  is open to commissions. Use it for
  `/users/<username>` and the profile settings screens.
- **`ArtistService`** (`artists`): creating artists, their public profile,
  handle, bio, images, links, and managers. Use it for `/artists/<handle>` and
  the artist settings screens, and whenever managers are added or removed.

### Releases and listening

- **`ReleaseService`** (`releases`): a manager's side of releases: drafts,
  tracks and sides, genres and tags, audio and artwork uploads, pricing,
  publishing, archiving, and gifting. Use it for every screen where an
  artist builds or edits a release.
- **`ShelfService`** (`shelves`): the home page's shelves, rows picked by
  recipes over the catalog and the listener's library, rotated daily, with
  a public crate someone made featured among them, plus a few designed
  releases and how much of each format is on offer. Use it for
  the home page.
- **`SearchService`** (`search`): searching the catalog: releases by words
  and filters (genre, format, price, year, kind, designed pages, where the
  artist is based) with how many releases each filter value would leave,
  every format a release is sold in, matching artists and merch, the places
  artists are based for reading them out of a search, and suggestions while
  someone types.
  Use it for the search box and the results page.
- **`CrateService`** (`crates`): crates, lists of releases people put
  together with a line about each, public or private; following the people
  who make them; and the crates IME builds by fixed rules: by genre or tag,
  from a few records someone loves, and a crate of the day from a
  listener's library. Use it for `/crates` and adding a release to a crate.
- **`CatalogService`** (`catalog`): a listener's side of releases: release
  pages, browsing, the feed of followed artists, the library, and
  the URLs that stream, download, and open assets. Use it for anything a
  listener sees or plays.
- **`ArtistPageService`** (`artistPages`): what a client needs to render a
  release page: the release data with its cover, and when the artist applied
  a design, a signed link to its bundle and their slot values, with images as
  signed links. Without a design, the client shows the default layout.

### Merch

- **`ProductService`** (`products`): a manager's side of merch: products and
  their option axes, variants with price and stock, photos, per-zone shipping
  rates, publishing, and archiving. Use it for every screen where an artist
  builds or restocks merch.
- **`StoreService`** (`store`): a listener's side of merch: an artist's store,
  a release's physical editions, and product pages. Use it for anything a
  listener browses before adding merch to the cart.

### Buying and selling

- **`CheckoutService`** (`checkout`): turns a cart into one Stripe payment per
  artist, each a direct charge on that artist's own account, and grants free
  releases on the spot. The Connect webhook records each payment once it
  settles. Use it for the cart's checkout button.
- **`PurchaseService`** (`purchases`): a buyer's purchase history, shipping
  progress, and refund requests to the artist. Use it for the purchases
  screens.
- **`SalesService`** (`sales`): a manager's sales, the queue of orders to
  ship, marking them shipped and delivered, refunds, and settled totals. Use
  it for the sales and fulfillment screens.

### Community

- **`FollowService`** (`follows`): following and unfollowing artists, which
  ones a listener follows, follower counts, and a manager's list of followers
  with removal. Use it for follow buttons and the followers screen.
- **`CommentService`** (`comments`): comments on releases: reading, posting,
  editing your own, and deleting your own or, as a manager, any on your
  artist's releases. Use it for a release page's comments.

### Creative pages

- **`DesignService`** (`designs`): a designer's side: creating designs,
  uploading versions with their slots, pricing, publishing, archiving,
  granting private designs to artists, usage per version, and sales. Use it
  for the designer screens.
- **`DesignMarketplaceService`** (`designMarketplace`): an artist's side of
  the marketplace: browsing and searching public designs, the designs an
  artist holds licenses for, and getting one, free at once or paid on the
  designer's own Stripe checkout. Use it for the marketplace screens.
- **`DesignGalleryService`** (`gallery`): the public design gallery: every
  listed design with a short-lived link to preview it, the releases using
  one, and passing a request for a custom design on to its designer by
  email, limited so no one floods a designer. Use it for `/designs`.
- **`ReleaseDesignService`** (`releaseDesigns`): dressing a release in a
  licensed design: applying it, filling in its slots, uploading slot images,
  moving to a newer version, and going back to the default layout. Use it for
  a release's design editor.

### Getting paid and funding

- **`PaymentAccountService`** (`paymentAccounts`): sellers' Stripe Connect
  accounts: onboarding artists and designers, and their status. Use it for the
  payments setup screens.
- **`BillingService`** (`billing`): a seller's prepaid hosting balance: saving
  a card, top-ups with an optional extra gift, alert and auto top-up settings,
  and refunds of unused balance. Use it for the billing screens.
- **`CostShareService`** (`costShares`): how an artist's hosting costs are
  split between its managers: viewing the split, proposing a new one, and
  accepting a share. Use it for the cost-split screen.
- **`DonationService`** (`donations`): gifts on the donation page, once or
  monthly, to the platform or the developers. Use it to start a donation
  checkout.
- **`PublicCostsService`** (`publicCosts`): the public costs page: what each
  closed month cost, how it was shared, and the reserve. Use it for that page.
- **`StripeWebhookService`** (`stripeWebhooks`): both Stripe webhooks. The
  platform one records top-ups, their card fees, and gifts. The Connect one
  keeps sellers' account status current and records sales, design purchases,
  refunds, and lost disputes. Use it for the two webhook routes, passing the
  raw body and the `Stripe-Signature` header.
- **`MonthlyCloseService`** (`monthlyClose`): an admin's monthly close:
  opening a month with the provider's rates, entering bills, then closing it,
  which issues statements, charges balances, runs auto top-ups, and sends
  alerts. Use it for the admin billing tools.

### Moderation

- **`ReportService`** (`reports`): reporting a release, product, comment,
  design, artist, or user, and a manager contesting a copyright takedown. Use
  it for report buttons and the contest form. Why a release was taken down
  comes with the managed release from `ReleaseService`.
- **`ModerationService`** (`moderation`): an admin's queue of open reports,
  dismissing, taking content down and restoring it, suspensions, clearing
  profiles, recording copyright claims, and deciding contests. A case says
  what the reported item is and links to it. Takedowns refund only what was
  taken down. Use it for the admin tools.

### Background work (the worker)

- **`FundingJobsService`** (`fundingJobs`): funding's daily work: counting
  storage, warning lapsed sellers, taking their things off sale, and deleting
  files nobody owns after 90 days off sale.
- **`ModerationJobsService`** (`moderationJobs`): makes copyright takedowns
  final once the window to contest them passes with no contest.
- **`TranscodeService`** (`transcode`): makes the AAC streaming copy of each
  lossless upload.

The worker runs these; nothing else should.

### Operations

- **`HealthService`** (`health`): whether the database answers. Use it for the
  health route.

## Building blocks other services use

Apps never use these directly. `CloudStorageService` and `EmailService` are
exported as types, for writing stand-ins to pass to `ImeServices`; the others
are internal.

- **`AccessService`**: the shared permission checks: active user, artist
  manager, platform admin, designer of a design, and managing a given
  release, track, asset, product, variant, or product photo.
- **`FundingService`**: whether an artist's hosting is paid for, whether a
  seller is paid up, and whether an artist or user counts as selling.
- **`SellingGateService`**: what a seller, artist or designer, needs before
  something goes on sale: funded hosting, and for anything paid, a payment
  account that can take charges in its currency. Checked when publishing and
  again at checkout.
- **`UploadService`**: direct uploads. Hands out a key under a prefix the
  caller owns and confirms what was uploaded against that kind of file's rules
  in `storage/media-types.ts`.
- **`ReleaseFilesService`**: deletes everything a release stores, rows first
  and files after, for funding's cleanup and final takedowns.
- **`CloudStorageService`**: object storage on Cloudflare R2: signed upload and
  read links, uploads, and deletes.
- **`EmailService`**: transactional email through Resend, logged instead of
  sent when no `RESEND_API_KEY` is set. The emails themselves are in
  `email/*-emails.ts`.

## Conventions

- **Errors.** A service throws `new ApiError(ApiErrorKind.Http, HttpStatus.X,
message)` with a message written for the end user; the route layer relays
  the status and message. Statuses come from `HttpStatus` in `@ime/models`,
  never as numbers.
- **Permissions first.** A method that acts for someone takes their `userId`
  first and checks it before doing anything.
- **Dependencies.** Every service takes its dependencies in its constructor,
  database first, with defaults for normal use. `ImeServices` is the only
  place outside this library that builds them; the library's own tests may
  build one directly from its file.
- **Transactions.** Writes that must land together go through
  `db.transaction(async (repos) => ...)`. Stripe calls and file deletes stay
  outside it, and files are deleted only after the rows pointing at them.
- **Webhooks.** Handlers are safe to repeat. An event is handled first and
  claimed after, so a failure is retried by Stripe and a repeat is skipped.
- **Sales.** Every sale is a direct charge on the seller's own Stripe account
  (`{ stripeAccount }`), so IME never holds the money. A refund's effects
  apply once, however many times it is reported.
- **Email.** An email about something that already happened is sent after it,
  and a failure to send is logged rather than undoing it.
- **Money.** Amounts are integer minor units (cents), shown to people with
  `formatMoney` from `@ime/utils`. Funding is always USD.
- **Database errors.** Check them against `PostgresErrorCode` from `@ime/db`
  with plain `if` statements.

When a service is added or changes what it is for, update the list above, the
exports in `src/index.ts`, and `ImeServices`.
