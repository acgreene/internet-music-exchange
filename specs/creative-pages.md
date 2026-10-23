# Creative Pages

## Purpose

Creative pages are IME's core differentiator. Instead of every artist's music sitting inside one house layout, a marketplace of **designs**, built by independent web developers, lets an artist pull a distinctive design onto a release and fill it with their own words and images, the way vinyl brought musicians together with graphic artists and photographers. This domain covers the design marketplace, how an artist gets and customizes a design, and the surface designers use to build, price, and publish designs.

## Roles

- **Designers (web developers)** build designs and publish them, publicly on the marketplace or privately for a specific artist. Any signed-in user can be a designer.
- **Managers** browse the marketplace, get designs for their artist, apply them to releases, and fill in their content.
- **Listeners** view releases rendered through whichever design the artist chose.
- **Any visitor** can browse public designs and try them out (see Design gallery).
- **Platform admins** can take down designs that break the rules (see [Moderation](./moderation.md)).

## Concepts

- A **design** is a self-contained page built by a designer for a particular surface. At launch the only surface is the **release page**. A design exposes named **slots** the artist fills in with text, images, and colors. A color slot starts from the designer's own color, so a design looks finished before the artist changes anything; artists use color slots to bring their own palette.
- A design has **versions**. Each published version is fixed; a designer improves a design by publishing a new version, and releases keep using the version they chose until their managers switch.
- A design is either **public**, listed on the marketplace, or **private**, visible only to the artists the designer grants it to. Private designs are how commissioned work is delivered.
- A design is priced like a release: **free**, **fixed**, or **name your price**, in the designer's selling currency.
- Getting a design gives the artist a **license**: permanent use of that design, including every future version, on any of that artist's releases.
- Applying a design to a release stores the chosen version and the artist's slot values (their **customization**). A release with no design falls back to the default layout.
- Designs are third-party code. They are rendered in a sandboxed, isolated context and receive only the release's data and the artist's customization, never the platform's internal data.
- A designed release is a page of its own, like opening a record: front and back cover, the inside of the gatefold, liner notes, photos, lyrics. The design gets the whole window. IME keeps only a slim bar with the release, its artist, a switch between the designed page and IME's standard page, adding to a crate, buying, and reporting. The standard page invites listeners back into the designed one.
- A design is sent the release's public content: title, kind, release date, description, credits, genres and tags, the artist's name, handle, place, picture, and header, the tracklist with durations, lyrics, which tracks preview and where each side starts, the public extras (back cover, photos, documents), the physical editions with price and stock, and the price.
- A design can ask IME to play, pause, or buy, and IME tells the design what is playing, so a design can move with the music.
- A design has up to three **styles** from IME's fixed list: typographic, editorial, photographic, illustrated, collage, minimal, brutalist, retro, 3D, motion, interactive, and generative.

## Web app designer surface

- A user can create a design, giving it a name, a description, up to three styles, and the surface it is built for, and upload its first version.
- A design starts as a **draft**, visible only to its creator, and is **published** to make it available.
- A designer can publish a new version by uploading a revised bundle. Earlier versions keep working for the releases that use them.
- A designer can update a design's name, description, styles, and price.
- A designer can make a design private and grant it to specific artists, for example after a commission arranged and paid outside IME.
- To sell paid designs, a designer connects a payment account the same way an artist does (see [Getting Paid](./getting-paid.md)). Designers are paid directly and IME takes no cut.
- A designer pays their share of hosting costs at cost, like any seller (see [Funding](./funding.md)).
- A designer can archive a design to withdraw it from the marketplace. Releases already using it, and artists already licensed for it, are unaffected.
- A designer can see how many releases use each design and each version, and their design sales.

## Web app artist surface

- A manager can browse public designs for a surface and search them by name.
- A manager can get a design for their artist: claim it if free, or buy it. Designs are bought directly from their marketplace page, not through the listener cart, and paid directly to the designer.
- Private designs granted to the artist appear alongside the ones they have licensed.
- A manager can apply a licensed design to one of the artist's releases, using its latest version.
- A manager can fill in the design's slots with text and with images uploaded to IME, and update them later.
- When a newer version of an applied design exists, managers are shown it and can switch to it. Nothing changes until they do.
- A manager can remove a design from a release, returning it to the default layout.

## Design gallery

- The gallery is the marketplace for how a record looks. Public designs are on show to everyone, signed in or not, under a short explanation of what designed releases are.
- Visitors search designs and designers by name, narrow designs by style, by price (free or under $10), and by whether the designer takes custom requests, and sort them by most used, newest, or rarely used.
- Designers are sellers in their own right. The gallery shows designers who take requests, or the designers matching a search, and each designer's profile shows their designs.
- The plain release page keeps everything a design may leave out, like supporters, notes, and the full credits, and a designed release links to it.
- Each design is shown as a template, with placeholders that say what goes where ("Cover art goes here", "Release title", "Artist name") and the design's own colors, so artists see the design rather than someone else's record.
- Each design can be tried with placeholder content: a stand-in cover, title, tracklist, and music, on a desktop or phone frame and for an album, EP, or single, so anyone can see what a release would look like in it. A visitor can try their own cover image in the preview; it stays on their device.
- From a design, a visitor can hear it on real releases that use it, start selling on IME to use it, or ask its designer for a custom design.
- Designers can say whether they are open to commissions. Asking for a custom design emails the designer the request; the commission itself is arranged between them and delivered as a private design.

## Mobile app

- A listener viewing a release sees it rendered through the design and version the artist applied, with the artist's content, or the default layout when none is applied.
- Browsing the marketplace, building designs, and applying designs are **not** available on mobile.

## Rules & constraints

- Every design must show the artist name, release title, cover art, tracklist, and a way to buy or claim the release. Designs that hide any of these can be taken down.
- Buying and claiming always happen in IME's own checkout, never inside a design.
- A design built for one surface can only be applied to that surface.
- A release renders with at most one design at a time; applying a new one replaces the previous choice while keeping the release's content.
- Images in a design's slots are files uploaded to IME, never outside web addresses. A rendered design cannot reach anything beyond the release data, the artist's customization, and its own bundle, all served through short-lived, signed access.
- A designer can never pull a design or version out from under the releases using it, and can never revoke a license. Archiving hides a design from the marketplace; a design or version in use cannot be deleted.
- Only platform admins can remove a design that is in use, and only for breaking the rules. Affected releases fall back to the default layout and their managers are emailed (see [Moderation](./moderation.md)).
- A license is permanent, like ownership of a release.

## Out of scope / future

- Designs for artist home pages, music pages, and merch pages.
- Featured designs and editorial picks in the gallery.
- Commissions paid through IME, and messaging designers inside IME instead of by email.
- A designer studio with guides and documentation for building designs.
- Serving release images to designs with cross-origin headers, so designs can use them as WebGL textures.
- Designs that span multiple releases or a full artist storefront.
- A live design preview or editor inside IME.
