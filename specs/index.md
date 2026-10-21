# Internet Music Exchange Product Specifications

## What it is

The Internet Music Exchange (IME) is a direct-to-fan marketplace where independent artists sell their music and merchandise straight to listeners, keep all of the revenue, and dress their releases in distinctive, designer-built pages instead of a single templated store layout.

It is a Bandcamp alternative built on four commitments:

1. **Zero platform fee.** When a listener buys a release or a piece of merch, the money goes to the artist. Payments settle directly to each artist's own payment account; the platform does not take a cut of sales and does not hold the artist's cash.
2. **Ownership, not access.** A purchase is a permanent entitlement. Buyers own the music they pay for, can stream it, and can download it exactly as the artist uploaded it. Free and name-your-price releases work the same way.
3. **Creative, designer-built pages.** Artists are not limited to one house layout. A marketplace of page designs, built by independent web developers, lets an artist pick a design and pull it onto a release, replacing its text and images with their own. This is the platform's core differentiator.
4. **Community funded, at cost.** IME is built for, funded by, and hosted by its community. Artists and designers who sell share what it actually costs to keep the platform online, mostly in proportion to what they use. None of that money goes to IME's developers; anyone who wants to support them can, separately and optionally (see [Funding](./funding.md)).

## Who it is for

- **Listeners / buyers**: discover music and merch, buy or claim it, stream and download what they own, follow artists, and comment on releases. Listeners are served on both **web and mobile**.
- **Artists**: publish releases, sell physical merch, price their work, choose and customize page designs, and fulfill their own orders. Artist tooling is **web-only**.
- **Artist managers**: trusted collaborators who act on an artist's behalf. An artist profile can have several managers. Web-only.
- **Designers (web developers)**: any user who builds page designs and offers them on the marketplace, or privately to a specific artist. Web-only.
- **Platform admins**: IME's own small team, who review reports and take down content that breaks the rules. Web-only.

## Platforms

| Surface        | Audience  | Scope                                                                                                               |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| **Web app**    | Everyone  | Full platform: listening, buying, artist management, merch, fulfillment, page design, payouts, funding, moderation. |
| **Mobile app** | Listeners | Discovery, streaming, offline listening, library, following, commenting, and reporting. Checkout opens on the web.  |

Both apps are built in Angular and share a common component and service layer; the mobile app is delivered to iOS and Android through Capacitor. Both are part of the MVP.

## Goals for end users

- **A listener** can find music they'll love, buy or claim it in a few taps, and immediately stream or download it, knowing it's theirs to keep.
- **An artist** can stand up a storefront that looks like theirs and nobody else's, sell both digital and physical goods, and receive the full sale price directly, paying only what it costs to host them.
- **A designer** can publish page designs to a shared marketplace, sell them directly, and see them adopted across real releases.

## How the specifications are organized

Each specification below covers one product domain across the surfaces it touches. They are strictly product-level: they describe what the platform does for its users and the rules that govern it. They intentionally do not describe APIs, data models, or implementation. The code defines that layer, and these specs are organized for readers, not to mirror how the system is built.

Everything in these specs is in scope for the MVP unless it is listed under a domain's **Out of scope / future**.

| Domain                                | Covers                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| [Accounts & Profiles](./accounts.md)  | Sign-up, verification, sign-in, profiles, usernames.                          |
| [Discovery](./discovery.md)           | Search, browsing the catalog, the listener's entry points.                    |
| [Artists & Management](./artists.md)  | Artist profiles and handles, managers, follower moderation.                   |
| [Releases & Music](./releases.md)     | Releases, tracks, audio, pricing, previews, publishing.                       |
| [Merchandise](./merchandise.md)       | Physical products, variants, stock, shipping rates.                           |
| [Buying & Checkout](./buying.md)      | Cart, checkout, purchase history, refund requests.                            |
| [Selling & Fulfillment](./selling.md) | Sales, shipping, refunds, and totals: the artist's side of a sale.            |
| [Library & Ownership](./library.md)   | What ownership grants, the library, streaming and download access.            |
| [Getting Paid](./getting-paid.md)     | Seller payment onboarding, charge eligibility, payouts.                       |
| [Community](./community.md)           | Following, the feed, release comments.                                        |
| [Creative Pages](./creative-pages.md) | The design marketplace, versions, licenses, applying designs.                 |
| [Funding](./funding.md)               | How sellers share hosting costs at cost, giving extra, the public costs page. |
| [Moderation](./moderation.md)         | Reports, copyright claims, admin review, and what takedowns do.               |

## Cross-cutting principles

- **Money is always in minor units** (cents) and denominated in a supported currency (currently USD and EUR). A seller sells in a single currency, established when they onboard for payments.
- **Draft before public.** Releases, merch, and page designs are created as drafts visible only to their owners, and become public only when explicitly published.
- **Owners keep access.** Archiving, withdrawing from sale, or a seller leaving never revokes a release from anyone who already owns it. Only refunds, lost payment disputes, and admin takedowns do.
- **The platform never holds funds from sales.** Every sale is a direct charge to the seller's connected payment account, and the seller is the legal seller of record. Hosting contributions are billed separately and never come out of a sale (see [Funding](./funding.md)).
- **Uploaded, not linked.** Every image and file shown on IME, including those inside page designs, is uploaded to IME.
- **Readable addresses.** Users live at `/users/<username>`, artists at `/artists/<handle>`, and releases at `/artists/<handle>/<release>`.
