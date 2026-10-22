# api

IME's HTTP API, on Hono. It turns requests into calls on `@ime/services` and
holds no business rules of its own: a route checks who is asking and what
they sent, calls one service method, and returns what the service returned.

## How a route is declared

Every route's shape lives in `@ime/models`, in `API_CONTRACTS`: for each route
and method, the schemas of its query string, request body, and response body.
The server and the clients both read from it, so they cannot disagree.

- **Routes** are paths in the `ApiRoute` enum, with `:name` placeholders.
  Placeholders ending in `Id` are UUIDs; anything else, like `:handle` or
  `:slug`, is free text.
- **Requests.** The server validates path ids, the query string, and the body
  against the contract before the handler runs. Anything invalid is a 400 that
  names the first problem, so a handler only ever sees well-formed input.
- **Responses.** The server parses what the handler returns through the
  contract's response schema before sending it. That strips any field the
  contract does not list, so database rows never leak internal columns, and a
  response that has drifted from its contract fails loudly as a 500 instead of
  quietly breaking a client. Clients parse the same schema on arrival.
- **Types.** A handler's return type is checked against the response schema at
  compile time. Timestamps are `z.coerce.date()`: the server returns `Date`s,
  they cross the wire as ISO strings, and clients get `Date`s back.
- **Actions with nothing to return** respond `{ "success": true }`.
- **Errors** are `{ "error": "<message for the user>" }` with the status the
  service chose.

Routers extend `AbstractRouter` and declare routes with `this.handle(method,
route, access, handler)`, where access is `public`, `optional` (signed in or
not), `user`, or `admin`. The handler gets typed `params`, `query`, `body`,
and `userId`.

## Route conventions

- `/api/catalog/...` is what listeners read, and is public unless noted.
- `/api/me/...` is the signed-in user's own things.
- Everything a manager, designer, or admin changes is addressed by id:
  `/api/artists/:artistId/...`, `/api/releases/:releaseId/...`, and so on.
- `POST` creates or acts, `PATCH` changes part of something, `PUT` sets a
  whole value (a price, a link list, an order), `DELETE` removes.
- Lists take `?limit=` (1 to 100) and `?offset=`.
- Uploads go straight to storage: `POST .../uploads` returns
  `{ uploadUrl, objectKey }`, the client `PUT`s the file there, then confirms
  the `objectKey` with the route that records it.

## Routes

Access: **P** public, **O** optional sign-in, **U** signed in, **A** admin.
Managers, designers, and owners are checked by the service, which answers 403.

### Health, auth, and accounts

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| GET | `/api/health` | P | `health.isDatabaseReachable` |
| POST | `/api/auth/sign-up` | P | `auth.signUp` |
| POST | `/api/auth/sign-in` | P | `auth.signIn` |
| POST | `/api/auth/sign-out` | U | `auth.signOut` |
| DELETE | `/api/users` | U | `auth.deleteUser` |
| GET | `/api/me` | U | `users.getOwnProfile` |
| PATCH | `/api/me` | U | `users.updateProfile` |
| GET | `/api/users/:username` | P | `users.getPublicProfile` |
| GET | `/api/availability/usernames/:username` | U | `users.isUsernameAvailable` |
| GET | `/api/availability/handles/:handle` | U | `artists.isHandleAvailable` |

### Artists

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| POST | `/api/artists` | U | `artists.create` |
| GET | `/api/me/artists` | U | `artists.listManaged` |
| PATCH | `/api/artists/:artistId` | U | `artists.update` |
| PUT | `/api/artists/:artistId/links` | U | `artists.setLinks` |
| POST | `/api/artists/:artistId/images/:kind/uploads` | U | `artists.createImageUpload` |
| PUT | `/api/artists/:artistId/images/:kind` | U | `artists.confirmImageUpload` |
| DELETE | `/api/artists/:artistId/images/:kind` | U | `artists.removeImage` |
| GET | `/api/artists/:artistId/managers` | U | `artists.listManagers` |
| POST | `/api/artists/:artistId/managers` | U | `artists.addManager` |
| DELETE | `/api/artists/:artistId/managers/:userId` | U | `artists.removeManager` |

### Releases (managers)

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| POST | `/api/artists/:artistId/releases` | U | `releases.create` |
| GET | `/api/artists/:artistId/releases` | U | `releases.listForManager` |
| GET | `/api/releases/:releaseId` | U | `releases.getForManager` |
| PATCH | `/api/releases/:releaseId` | U | `releases.update` |
| DELETE | `/api/releases/:releaseId` | U | `releases.delete` |
| PUT | `/api/releases/:releaseId/pricing` | U | `releases.setPricing` |
| POST | `/api/releases/:releaseId/publish` | U | `releases.publish` |
| POST | `/api/releases/:releaseId/archive` | U | `releases.archive` |
| POST | `/api/releases/:releaseId/tracks` | U | `releases.addTrack` |
| PUT | `/api/releases/:releaseId/tracks` | U | `releases.reorderTracks` |
| PATCH | `/api/tracks/:trackId` | U | `releases.updateTrack` |
| DELETE | `/api/releases/:releaseId/tracks/:trackId` | U | `releases.removeTrack` |
| PUT | `/api/releases/:releaseId/tracks/:trackId/preview` | U | `releases.setTrackPreview` |
| POST | `/api/releases/:releaseId/tracks/:trackId/audio/uploads` | U | `releases.createAudioUpload` |
| PUT | `/api/releases/:releaseId/tracks/:trackId/audio` | U | `releases.confirmAudioUpload` |
| POST | `/api/releases/:releaseId/assets/uploads` | U | `releases.createAssetUpload` |
| POST | `/api/releases/:releaseId/assets` | U | `releases.confirmAssetUpload` |
| PATCH | `/api/assets/:assetId` | U | `releases.updateAsset` |
| DELETE | `/api/assets/:assetId` | U | `releases.deleteAsset` |
| POST | `/api/releases/:releaseId/gifts` | U | `releases.gift` |

### Catalog and library (listeners)

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| GET | `/api/catalog/releases` | P | `catalog.listRecent` |
| GET | `/api/catalog/home` | O | `shelves.getHome` |
| GET | `/api/catalog/search?q=&genres=&format=&under=&year=&kind=&designed=&country=&city=&sort=` | P | `search.search` |
| GET | `/api/catalog/suggest?q=` | P | `search.suggest` |
| GET | `/api/catalog/places` | P | `search.listPlaces` |
| GET | `/api/catalog/artists/:handle` | P | `artists.getProfile` |
| GET | `/api/catalog/artists/:handle/releases` | P | `catalog.listDiscography` |
| GET | `/api/catalog/artists/:handle/releases/:slug` | O | `catalog.getReleasePage` |
| GET | `/api/catalog/releases/:releaseId/tracks/:trackId/stream` | O | `catalog.getStreamUrl` |
| GET | `/api/catalog/releases/:releaseId/tracks/:trackId/download` | U | `catalog.getDownloadUrl` |
| GET | `/api/catalog/assets/:assetId` | O | `catalog.getAssetUrl` |
| GET | `/api/artist-pages/releases/:releaseId` | P | `artistPages.renderRelease` |
| GET | `/api/me/library` | U | `catalog.getLibrary` |
| GET | `/api/me/feed` | U | `catalog.getFeed` |

### Merch

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| POST | `/api/artists/:artistId/products` | U | `products.create` |
| GET | `/api/artists/:artistId/products` | U | `products.listForManager` |
| GET | `/api/products/:productId` | U | `products.getForManager` |
| PATCH | `/api/products/:productId` | U | `products.update` |
| DELETE | `/api/products/:productId` | U | `products.delete` |
| POST | `/api/products/:productId/publish` | U | `products.publish` |
| POST | `/api/products/:productId/archive` | U | `products.archive` |
| POST | `/api/products/:productId/variants` | U | `products.addVariant` |
| PATCH | `/api/variants/:variantId` | U | `products.updateVariant` |
| PUT | `/api/variants/:variantId/stock` | U | `products.setStock` |
| DELETE | `/api/variants/:variantId` | U | `products.removeVariant` |
| POST | `/api/products/:productId/images/uploads` | U | `products.createImageUpload` |
| POST | `/api/products/:productId/images` | U | `products.confirmImageUpload` |
| PATCH | `/api/product-images/:imageId` | U | `products.updateImage` |
| DELETE | `/api/product-images/:imageId` | U | `products.deleteImage` |
| PUT | `/api/products/:productId/shipping-rates/:destination` | U | `products.setShippingRate` |
| DELETE | `/api/products/:productId/shipping-rates/:destination` | U | `products.removeShippingRate` |
| GET | `/api/catalog/artists/:handle/store` | P | `store.listStore` |
| GET | `/api/catalog/releases/:releaseId/editions` | P | `store.listEditions` |
| GET | `/api/catalog/products/:productId` | P | `store.getProductPage` |

### Buying and selling

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| POST | `/api/checkout` | U | `checkout.start` |
| GET | `/api/me/purchases` | U | `purchases.listPurchases` |
| GET | `/api/purchases/:artistOrderId` | U | `purchases.getPurchase` |
| POST | `/api/purchases/:artistOrderId/refund-request` | U | `purchases.requestRefund` |
| GET | `/api/artists/:artistId/sales` | U | `sales.listSales` |
| GET | `/api/artists/:artistId/sales/to-ship` | U | `sales.listToShip` |
| GET | `/api/artists/:artistId/sales/totals` | U | `sales.getTotals` |
| GET | `/api/sales/:artistOrderId` | U | `sales.getSale` |
| POST | `/api/sales/:artistOrderId/shipment` | U | `sales.markShipped` |
| POST | `/api/sales/:artistOrderId/delivered` | U | `sales.markDelivered` |
| POST | `/api/sales/:artistOrderId/refund` | U | `sales.refund` |

### Community

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| PUT | `/api/artists/:artistId/follow` | U | `follows.follow` |
| DELETE | `/api/artists/:artistId/follow` | U | `follows.unfollow` |
| GET | `/api/me/following` | U | `follows.listFollowing` |
| POST | `/api/me/following/filter` | U | `follows.filterFollowed` |
| GET | `/api/artists/:artistId/followers` | U | `follows.listFollowers` |
| DELETE | `/api/artists/:artistId/followers/:userId` | U | `follows.removeFollower` |
| GET | `/api/catalog/releases/:releaseId/comments` | P | `comments.listComments` |
| POST | `/api/releases/:releaseId/comments` | U | `comments.addComment` |
| PATCH | `/api/comments/:commentId` | U | `comments.editComment` |
| DELETE | `/api/comments/:commentId` | U | `comments.deleteComment` |

### Creative pages

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| POST | `/api/designs` | U | `designs.create` |
| GET | `/api/me/designs` | U | `designs.listMine` |
| GET | `/api/me/design-sales` | U | `designs.listSales` |
| GET | `/api/designs/:designId` | U | `designs.getMine` |
| PATCH | `/api/designs/:designId` | U | `designs.update` |
| DELETE | `/api/designs/:designId` | U | `designs.delete` |
| PUT | `/api/designs/:designId/pricing` | U | `designs.setPricing` |
| POST | `/api/designs/:designId/versions/uploads` | U | `designs.createVersionUpload` |
| POST | `/api/designs/:designId/versions` | U | `designs.confirmVersionUpload` |
| POST | `/api/designs/:designId/publish` | U | `designs.publish` |
| POST | `/api/designs/:designId/archive` | U | `designs.archive` |
| POST | `/api/designs/:designId/grants` | U | `designs.grant` |
| GET | `/api/marketplace/designs` | P | `designMarketplace.browse` |
| GET | `/api/marketplace/search?q=` | P | `designMarketplace.search` |
| GET | `/api/marketplace/designs/:designId` | P | `designMarketplace.getDesign` |
| GET | `/api/crates` | P | `crates.listPublic` |
| POST | `/api/crates` | U | `crates.create` |
| GET | `/api/crates/sound?genre=&tag=` | P | `crates.bySound` |
| POST | `/api/crates/from-records` | P | `crates.fromRecords` |
| GET | `/api/crates/:crateId` | O | `crates.get` |
| PATCH, DELETE | `/api/crates/:crateId` | U | `crates.update`, `crates.delete` |
| POST, PUT | `/api/crates/:crateId/releases` | U | `crates.addRelease`, `crates.reorder` |
| PATCH, DELETE | `/api/crates/:crateId/releases/:releaseId` | U | `crates.setReleaseNote`, `crates.removeRelease` |
| GET | `/api/me/crates?releaseId=` | U | `crates.listMine` |
| GET | `/api/me/crate-of-the-day` | U | `crates.ofTheDay` |
| GET | `/api/me/followed-crates` | U | `crates.listFromFollowed` |
| GET | `/api/users/:username/crates` | P | `crates.listByUsername` |
| PUT, DELETE | `/api/users/:userId/follow` | U | `crates.followMaker`, `crates.unfollowMaker` |
| GET | `/api/dig/crates/:crateId?depth=` | O | `dig.digCrate` |
| GET | `/api/dig/sound?genre=&tag=&depth=` | O | `dig.digSound` |
| GET | `/api/gallery/designs` | P | `gallery.list` |
| GET | `/api/gallery/designs/:designId` | P | `gallery.get` |
| POST | `/api/gallery/designs/:designId/commission` | U | `gallery.requestCommission` |
| GET | `/api/artists/:artistId/designs` | U | `designMarketplace.listLicensed` |
| POST | `/api/artists/:artistId/designs/:designId/acquire` | U | `designMarketplace.acquire` |
| GET | `/api/releases/:releaseId/design` | U | `releaseDesigns.getForRelease` |
| PUT | `/api/releases/:releaseId/design` | U | `releaseDesigns.apply` |
| DELETE | `/api/releases/:releaseId/design` | U | `releaseDesigns.remove` |
| POST | `/api/releases/:releaseId/design/update` | U | `releaseDesigns.updateToLatest` |
| PUT | `/api/releases/:releaseId/design/customization` | U | `releaseDesigns.customize` |
| POST | `/api/releases/:releaseId/design/images/uploads` | U | `releaseDesigns.createImageUpload` |
| POST | `/api/releases/:releaseId/design/images` | U | `releaseDesigns.confirmImageUpload` |
| DELETE | `/api/design-images/:imageId` | U | `releaseDesigns.deleteImage` |

### Getting paid and funding

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| GET | `/api/artists/:artistId/payment-account` | U | `paymentAccounts.getArtistStatus` |
| POST | `/api/artists/:artistId/payment-account/onboarding` | U | `paymentAccounts.startArtistOnboarding` |
| POST | `/api/artists/:artistId/payment-account/refresh` | U | `paymentAccounts.refreshArtistStatus` |
| GET | `/api/me/payment-account` | U | `paymentAccounts.getDesignerStatus` |
| POST | `/api/me/payment-account/onboarding` | U | `paymentAccounts.startDesignerOnboarding` |
| POST | `/api/me/payment-account/refresh` | U | `paymentAccounts.refreshDesignerStatus` |
| GET | `/api/me/billing` | U | `billing.getOverview` |
| POST | `/api/me/billing/card-setup` | U | `billing.createCardSetup` |
| PUT | `/api/me/billing/card` | U | `billing.confirmCard` |
| DELETE | `/api/me/billing/card` | U | `billing.removeCard` |
| PATCH | `/api/me/billing/settings` | U | `billing.updateSettings` |
| POST | `/api/me/billing/top-ups` | U | `billing.topUp` |
| POST | `/api/me/billing/refund` | U | `billing.refundUnusedBalance` |
| GET | `/api/artists/:artistId/cost-split` | U | `costShares.getSplit` |
| PUT | `/api/artists/:artistId/cost-split` | U | `costShares.proposeSplit` |
| POST | `/api/artists/:artistId/cost-split/accept` | U | `costShares.acceptShare` |
| DELETE | `/api/artists/:artistId/cost-split/proposal` | U | `costShares.withdrawProposal` |
| POST | `/api/donations` | P | `donations.createDonationCheckout` |
| GET | `/api/public-costs` | P | `publicCosts.getPublicCosts` |
| POST | `/api/webhooks/stripe` | P | `stripeWebhooks.handlePlatformEvent` |
| POST | `/api/webhooks/stripe/connect` | P | `stripeWebhooks.handleConnectEvent` |

The webhooks read the raw body and the `Stripe-Signature` header, which the
service verifies.

### Moderation

| Method | Route | Access | Service call |
| --- | --- | --- | --- |
| POST | `/api/reports` | U | `reports.report` |
| POST | `/api/releases/:releaseId/contest` | U | `reports.contest` |
| GET | `/api/admin/reports` | A | `moderation.listQueue` |
| GET | `/api/admin/cases/:targetType/:targetId` | A | `moderation.getCase` |
| POST | `/api/admin/cases/:targetType/:targetId/dismiss` | A | `moderation.dismiss` |
| POST | `/api/admin/cases/:targetType/:targetId/take-down` | A | `moderation.takeDown` |
| POST | `/api/admin/cases/:targetType/:targetId/restore` | A | `moderation.restore` |
| POST | `/api/admin/users/:userId/clear-profile` | A | `moderation.clearProfile` |
| POST | `/api/admin/copyright-claims` | A | `moderation.recordCopyrightClaim` |
| POST | `/api/admin/releases/:releaseId/contest-decision` | A | `moderation.resolveContest` |
| POST | `/api/admin/billing-periods` | A | `monthlyClose.openMonth` |
| POST | `/api/admin/billing-periods/:month/costs` | A | `monthlyClose.addCost` |
| POST | `/api/admin/billing-periods/:month/close` | A | `monthlyClose.closeMonth` |

Admin routes check the admin role in the router as well as in the service, so
a non-admin is turned away before any input is read.
