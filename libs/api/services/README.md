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

- **`AuthService`** (`auth`): sign-up, sign-in, sign-out, token checks, and account
  deletion through Supabase auth. Reach for it in auth routes and the auth
  middleware, and when a user deletes their account (it refuses while they are
  an artist's only manager).
- **`UserService`** (`users`): a user's own and public profile, username availability,
  and editing username and display name. Use it for `/users/<username>` and the
  profile settings screens.
- **`ArtistService`** (`artists`): creating artists, their public profile, handle, bio,
  images, links, and managers. Use it for `/artists/<handle>` and the artist
  settings screens, and whenever managers are added or removed.

### Releases and listening

- **`ReleaseService`** (`releases`): a manager's side of releases: drafts, tracks, audio
  and artwork uploads, pricing, publishing, archiving, and gifting. Use it for
  every screen where an artist builds or edits a release.
- **`CatalogService`** (`catalog`): a listener's side of releases: release pages, browsing
  and search, the library, and the URLs that stream, download, and open
  assets. Use it for anything a listener sees or plays.
- **`ArtistPageService`** (`artistPages`): renders a release through its creative-page design:
  release data, the artist's customization, and a signed link to the design
  bundle. Use it when the web or mobile app shows a designed release page.

### Getting paid and funding

- **`PaymentAccountService`** (`paymentAccounts`): sellers' Stripe Connect
  accounts: onboarding artists and designers, and their status. Use it for the
  payments setup screens.
- **`BillingService`** (`billing`): a seller's prepaid hosting balance: saving a card,
  top-ups with an optional extra gift, alert and auto top-up settings, and
  refunds of unused balance. Use it for the billing screens.
- **`CostShareService`** (`costShares`): how an artist's hosting costs are split between its
  managers: viewing the split, proposing a new one, and accepting a share. Use
  it for the cost-split screen.
- **`DonationService`** (`donations`): gifts on the donation page, once or monthly, to the
  platform or the developers. Use it to start a donation checkout.
- **`PublicCostsService`** (`publicCosts`): the public costs page: what each
  closed month cost, how it was shared, and the reserve. Use it for that page.
- **`StripeWebhookService`** (`stripeWebhooks`): both Stripe webhooks. The
  platform one records top-ups, their card fees, and gifts; the Connect one
  keeps sellers' account status current. Use it for the two webhook routes,
  passing the raw body and the `Stripe-Signature` header.
- **`MonthlyCloseService`** (`monthlyClose`): an admin's monthly close: opening a month with
  the provider's rates, entering bills, then closing it, which issues
  statements, charges balances, runs auto top-ups, and sends alerts. Use it for
  the admin billing tools.

### Background work (the worker)

- **`FundingJobsService`** (`fundingJobs`): funding's daily work: counting storage, warning
  lapsed sellers, taking their things off sale, and deleting files nobody owns
  after 90 days off sale. The worker runs it; nothing else should.
- **`TranscodeService`** (`transcode`): makes the AAC streaming copy of each lossless upload.
  The worker runs it; nothing else should.

### Operations

- **`HealthService`** (`health`): whether the database answers. Use it for the health
  route.

## Building blocks other services use

Apps never use these directly. `CloudStorageService` and `EmailService` are
exported as types, for writing stand-ins to pass to `ImeServices`; the others
are internal.

- **`AccessService`**: the shared permission checks: active user, artist
  manager, platform admin, and managing a given release, track, or asset.
- **`FundingService`**: whether an artist's hosting is paid for, and whether
  an artist or user counts as selling.
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
  database first, with defaults for normal use. `ImeServices` is the only
  place outside this library that builds them; the library's own tests may
  build one directly from its file.
- **Transactions.** Writes that must land together go through
  `db.transaction(async (repos) => ...)`. Stripe calls and file deletes stay
  outside it, and files are deleted only after the rows pointing at them.
- **Webhooks.** Handlers are safe to repeat. An event is handled first and
  claimed after, so a failure is retried by Stripe and a repeat is skipped.
- **Money.** Amounts are integer minor units (cents). Funding is always USD.
- **Database errors.** Check them against `PostgresErrorCode` from `@ime/db`
  with plain `if` statements.

When a service is added or changes what it is for, update the list above, the
exports in `src/index.ts`, and `ImeServices`.
