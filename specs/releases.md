# Releases & Music

## Purpose

A release is the unit of music an artist publishes and sells: a single, EP, LP, album, compilation, or other form. This domain covers assembling a release, its tracks and artwork, how it is priced, and how listeners stream and download it.

## Roles

- **Managers** author releases: create them, add tracks and artwork, price them, and publish them.
- **Listeners** browse, preview, buy, stream, and download releases.

## Web app

### Authoring a release

- A manager can create a release with a title and a kind (single, EP, LP, album, compilation, remaster, soundtrack, score, demo, other), and an optional original release date.
- A new release starts as a **draft**, visible only to the artist's managers.
- A manager can edit a release's title, kind, and release date.
- A manager can delete a draft release. A release that has already sold cannot be deleted (its sales records reference it); it is archived instead.

### Tracks

- A manager can add tracks to a release and arrange them into a running order.
- A manager can reorder the tracklist, rename tracks, and remove a track from a release without deleting the track itself.
- Each track can be marked as a **preview**, letting anyone stream it without owning the release — a way to put a few songs forward as a taste of the whole.
- A track's duration is shown on the tracklist once known.

### Artwork & assets

- A release has cover art. It may also carry back cover art, liner notes, photos, videos, and documents.
- Cover art is always public: it is how the release is shown in the catalog.
- Other assets can be either public or **gated** (available only to owners), such as high-resolution liner notes or bonus material that ships with a purchase.

### Pricing

- Every release must be priced before it can be published. A release has exactly one pricing choice:
  - **Free**: no charge; it drops straight into a buyer's library.
  - **Fixed**: a set price the buyer must pay and may choose to exceed.
  - **Name your price**: the buyer names any amount at or above a floor, which may be zero.
- Paid pricing carries a currency, which matches the artist's selling currency.
- A price may include a suggested amount to guide the buyer.

### Publishing

- A manager publishes a release to make it public and available to buy.
- A release cannot be published until it has been priced.
- A manager can archive a release to withdraw it from the public catalog. Listeners who already own it keep their access.

## Mobile app

- A listener can browse the catalog, view an artist's discography, and open a release page.
- A listener can stream preview tracks freely, and stream any track on a release they own.
- A listener can buy or claim a release (see [Buying & Checkout](./buying.md)).
- A listener can download releases they own in full quality, and play them from their library (see [Library & Ownership](./library.md)).
- Authoring, pricing, and publishing are **not** available on mobile.

## Rules & constraints

- A draft release and its tracklist are visible only to the artist's managers; nothing reaches the public catalog before it is published.
- A published release must always have a price on record.
- Archiving is the withdrawal mechanism; deletion is reserved for drafts that have never sold.
- Preview tracks are the only music a non-owner can stream in full; everything else requires ownership.
- Streaming and downloading rights follow from entitlements, not from the release itself, see [Library & Ownership](./library.md).

## Out of scope / future

- Adaptive / multi-bitrate streaming beyond a single stream quality plus the full-quality master.
- Per-track sales (buying an individual song rather than the release).
- A per-owner download/play log (deferred).
