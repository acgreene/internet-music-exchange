# api-services

The business logic of IME. Every rule in the product specs that is more than a
database constraint lives here: who may do what, what has to be true before
something is published or sold, the money flows, and the work that runs on a
schedule. Apps (`apps/api`, `apps/worker`) reach the database only through
these services; importing `@ime/db` from an app is a lint error.

Imported as `@ime/services`.

## Services apps call

### Accounts and artists

- **`AuthService`**: sign-up, sign-in, sign-out, token checks, and account
  deletion through Supabase auth. Reach for it in auth routes and the auth
  middleware, and when a user deletes their account (it refuses while they are
  an artist's only manager).
- **`UserService`**: a user's own and public profile, username availability,
  and editing username and display name. Use it for `/users/<username>` and the
  profile settings screens.
- **`ArtistService`**: creating artists, their public profile, handle, bio,
  images, links, and managers. Use it for `/artists/<handle>` and the artist
  settings screens, and whenever managers are added or removed.

### Releases and listening

- **`ReleaseService`**: a manager's side of releases: drafts, tracks, audio
  and artwork uploads, pricing, publishing, archiving, and gifting. Use it for
  every screen where an artist builds or edits a release.
- **`CatalogService`**: a listener's side of releases: release pages, browsing
  and search, the library, and the URLs that stream, download, and open
  assets. Use it for anything a listener sees or plays.
- **`ArtistPageService`**: renders a release through its creative-page design:
  release data, the artist's customization, and a signed link to the design
  bundle. Use it when the web or mobile app shows a designed release page.

### Getting paid and funding

- **`PaymentAccountService`**: sellers' Stripe Connect accounts: onboarding
  artists and designers, their status, and the webhook for events from
  connected accounts. Use it for the payments setup screens and the Connect
  webhook route.
- **`BillingService`**: a seller's prepaid hosting balance: saving a card,
  top-ups with an optional extra gift, alert and auto top-up settings, and
  refunds of unused balance. Use it for the billing screens.
- **`CostShareService`**: how an artist's hosting costs are split between its
  managers: viewing the split, proposing a new one, and accepting a share. Use
  it for the cost-split screen.
- **`DonationService`**: gifts on the donation page, once or monthly, to the
  platform or the developers. Use it to start a donation checkout.
- **`PlatformWebhookService`**: the webhook for the platform's own Stripe
  events, which records top-ups, their card fees, and gifts. Use it for the
  platform webhook route.
- **`FundingService`**: whether an artist's hosting is paid for, whether a user
  is an active seller, and the public costs page. Use it for the public costs
  page; other services use the rest.
- **`MonthlyCloseService`**: an admin's monthly close: opening a month with
  the provider's rates, entering bills, then closing it, which issues
  statements, charges balances, runs auto top-ups, and sends alerts. Use it for
  the admin billing tools.

### Background work (the worker)

- **`FundingJobsService`**: funding's daily work: counting storage, warning
  lapsed sellers, taking their things off sale, and deleting files nobody owns
  after 90 days off sale. The worker runs it; nothing else should.
- **`TranscodeService`**: makes the AAC streaming copy of each lossless upload.
  The worker runs it; nothing else should.

### Operations

- **`HealthService`**: whether the database answers. Use it for the health
  route.

## Building blocks other services use

Apps rarely need these directly.

- **`AccessService`**: the shared permission checks (active user, artist
  manager, platform admin).
- **`CloudStorageService`**: object storage on Cloudflare R2: signed upload and
  read links, uploads, and deletes.
- **`EmailService`**: transactional email through Resend, logged instead of
  sent when no `RESEND_API_KEY` is set.

## Conventions

- **Errors.** A service throws `new ApiError(ApiErrorKind.Http, HttpStatus.X,
  message)` with a message written for the end user; the route layer relays
  the status and message. Statuses come from `HttpStatus` in `@ime/models`,
  never as numbers.
- **Permissions first.** A method that acts for someone takes their `userId`
  first and checks it before doing anything.
- **Dependencies.** Every service takes its dependencies in its constructor,
  with defaults for normal use. Pass your own (a `DatabaseRepository` bound to
  a transaction, a stand-in for Stripe) in tests and scripts.
- **Money.** Amounts are integer minor units (cents). Funding is always USD.
- **Database errors.** Check them against `PostgresErrorCode` from `@ime/db`
  with plain `if` statements.

When a service is added or changes what it is for, update the list above.
