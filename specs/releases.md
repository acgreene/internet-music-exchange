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
- A manager describes a release with up to three **genres**, chosen from IME's list, and a few free-form **tags** for its sound and mood. These drive browsing, charts, and crates by sound (see [Discovery](./discovery.md)).
- A manager can divide a release's tracklist into **sides** (side A, side B, and so on), as on a record. Sides are optional.
- A release is reachable at a readable address under its artist, `/artists/<handle>/<release>`, where the last part is made from the title and is unique within the artist.
- A manager can delete a draft release. A release that has already sold cannot be deleted (its sales records reference it); it is archived instead.

### Tracks

- A manager can add tracks to a release and arrange them into a running order.
- A manager can reorder the tracklist, rename tracks, and remove a track from a release without deleting the track itself.
- Each track can be marked as a **preview**, letting anyone stream it without owning the release: a way to put a few songs forward as a taste of the whole. Previews are always the whole track; IME never cuts a release down to an excerpt.
- A track's duration is shown on the tracklist once known.

### Audio

- A manager uploads one audio file per track. Lossless formats (WAV, FLAC, AIFF) are encouraged; MP3 is also accepted.
- The uploaded file is the track's **original**. It is what owners download, exactly as uploaded.
- IME makes a **streaming copy** of each lossless upload at 256 kbps AAC. MP3 uploads are streamed as they are, since re-encoding a lossy file only loses quality.
- The streaming copy is used for streaming and offline listening in the app. It is never offered as a download.

### Artwork & assets

- A release has cover art. It may also carry back cover art, liner notes, photos, videos, and documents.
- A release can have a description and credits, and each track can have lyrics, all optional and written by the artist.
- Cover art is always public: it is how the release is shown in the catalog.
- Other assets can be either public or **gated** (available only to owners), such as high-resolution liner notes or bonus material that ships with a purchase.

### The release page

- A release without a design gets IME's own page. Beside the cover are every way to get it: the download, bought right there, and each physical edition with its price and how many are left. The artist sits below them, with their photo, where they are based, a follow button, and their links.
- Beside those are the title, the tracklist, the artist's description and credits, any included extras, and who supported it with the notes they left. Tracks with lyrics can show them. A track a listener cannot hear yet offers to take them to buying it.
- Below are more releases from the artist and the public crates the release is in.
- Reporting a release or a note is offered quietly, in a menu, rather than beside everything.

### Pricing

- Every release must be priced before it can be published. A release has exactly one pricing choice:
  - **Free**: no charge; it drops straight into a buyer's library.
  - **Fixed**: a set price the buyer must pay and may choose to exceed.
  - **Name your price**: the buyer names any amount at or above a floor, which may be zero.
- Paid pricing carries a currency, which matches the artist's selling currency.
- A price may include a suggested amount to guide the buyer.

### Publishing

- A manager publishes a release to make it public and available to buy.
- A release cannot be published until it has cover art and a price.
- A paid release cannot be published until the artist's payment account can accept charges (see [Getting Paid](./getting-paid.md)).
- Nothing can be published until the artist's hosting costs are covered by a funded balance (see [Funding](./funding.md)).
- A manager can archive a release to withdraw it from the public catalog. Listeners who already own it keep their access.

## Mobile app

- A listener can browse the catalog, view an artist's discography, and open a release page.
- A listener can stream preview tracks freely, and stream any track on a release they own.
- A listener can buy or claim a release (see [Buying & Checkout](./buying.md)).
- A listener can save releases they own for offline listening in the app (see [Library & Ownership](./library.md)).
- Authoring, pricing, and publishing are **not** available on mobile.

## Rules & constraints

- A draft release and its tracklist are visible only to the artist's managers; nothing reaches the public catalog before it is published.
- A published release must always have cover art and a price on record.
- Archiving is the withdrawal mechanism; deletion is reserved for drafts that have never sold.
- Preview tracks are the only music a non-owner can stream in full; everything else requires ownership.
- Streaming and downloading rights follow from entitlements, not from the release itself (see [Library & Ownership](./library.md)).
- A release comes off sale if its artist's hosting contributions lapse (see [Funding](./funding.md)), and can be taken down by platform admins (see [Moderation](./moderation.md)).

## Out of scope / future

- Adaptive or multi-bitrate streaming beyond the single streaming copy.
- Downloads converted to other formats than the original upload.
- Per-track sales (buying an individual song rather than the release).
- A per-owner download/play log (deferred).
