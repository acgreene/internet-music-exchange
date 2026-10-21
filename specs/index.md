# Internet Music Exchange Product Specifications

## What it is

The Internet Music Exchange (IME) is a direct-to-fan marketplace where independent artists sell their music and merchandise straight to listeners, keep all of the revenue, and dress their releases in distinctive, designer-built pages instead of a single templated store layout.

It is a Bandcamp alternative built on three commitments:

1. **Zero platform fee.** When a listener buys a release or a piece of merch, the money goes to the artist. Payments settle directly to each artist's own payment account; the platform does not take a cut of sales and does not hold the artist's cash.
2. **Ownership, not access.** A purchase is a permanent entitlement. Buyers own the music they pay for, can stream it, and can download it in full quality. Free and name-your-price releases work the same way.
3. **Creative, designer-built pages.** Artists are not limited to one house layout. A marketplace of page designs, built by independent web developers, lets an artist pick a design and pull it onto a release, replacing its text and images with their own. This is the platform's core differentiator.

## Who it is for

- **Listeners / buyers**: discover music and merch, buy or claim it, stream and download what they own, follow artists, and comment on releases. Listeners are served on both **web and mobile**.
- **Artists**: publish releases, sell physical merch, price their work, choose and customize page designs, and fulfill their own orders. Artist tooling is **web-only**.
- **Artist managers**: trusted collaborators who act on an artist's behalf. An artist profile can have several managers. Web-only.
- **Designers (web developers)**: independent developers who build page designs and offer them on the marketplace for artists to use. Web-only.

## Platforms

| Surface        | Audience  | Scope                                                                                          |
|----------------|-----------|------------------------------------------------------------------------------------------------|
| **Web app**    | Everyone  | Full platform: listening, buying, artist management, merch, fulfillment, page design, payouts. |
| **Mobile app** | Listeners | Discovery, purchase, streaming, library, following, and commenting. No artist management.      |

Both apps are built in Angular and share a common component and service layer; the mobile app is delivered to iOS and Android through Capacitor.

## Goals for end users

- **A listener** can find music they'll love, buy or claim it in a few taps, and immediately stream or download it, knowing it's theirs to keep.
- **An artist** can stand up a storefront that looks like theirs and nobody else's, sell both digital and physical goods, and receive the full sale price directly.
- **A designer** can publish page designs to a shared marketplace and see them adopted across real releases.

## How the specifications are organized

Each specification below covers one product domain across the surfaces it touches. They are strictly product-level: they describe what the platform does for its users and the rules that govern it. They intentionally do not describe APIs, data models, or implementation — the code defines that layer, and these specs are organized for readers, not to mirror how the system is built.

| Domain                                | Covers                                                             |
|---------------------------------------|--------------------------------------------------------------------|
| [Accounts & Profiles](./accounts.md)  | Sign-up, sign-in, profiles, usernames.                             |
| [Discovery](./discovery.md)           | Search, browsing the catalog, the listener's entry points.         |
| [Artists & Management](./artists.md)  | Artist profiles, managers, follower moderation.                    |
| [Releases & Music](./releases.md)     | Releases, tracks, pricing, previews, streaming, downloads.         |
| [Merchandise](./merchandise.md)       | Physical products, variants, stock, shipping rates.                |
| [Buying & Checkout](./buying.md)      | Cart, checkout, purchase history — the listener's purchase.        |
| [Selling & Fulfillment](./selling.md) | Sales, shipping, and totals — the artist's side of a sale.         |
| [Library & Ownership](./library.md)   | What ownership grants, the library, streaming and download access. |
| [Getting Paid](./getting-paid.md)     | Artist payment onboarding, charge eligibility, payouts.            |
| [Community](./community.md)           | Following, the feed, release comments.                             |
| [Creative Pages](./creative-pages.md) | The design marketplace, applying designs, the designer surface.    |

## Cross-cutting principles

- **Money is always in minor units** (cents) and denominated in a supported currency (currently USD and EUR). An artist sells in a single currency, established when they onboard for payments.
- **Draft before public.** Releases, merch, and page designs are created as drafts visible only to their owners, and become public only when explicitly published.
- **Owners keep access.** Withdrawing a release or product from sale (archiving)
  never revokes it from anyone who already owns it.
- **The platform never holds funds.** Every sale is a direct charge to the artist's connected payment account.
