# Creative Pages

## Purpose

Creative pages are IME's core differentiator. Instead of every artist's music sitting inside one house layout, a marketplace of **designs**, built by independent web developers, lets an artist pull a distinctive design onto a release and fill it with their own words and images. This domain covers the design marketplace, how an artist applies and customizes a design, and the surface designers use to build and publish designs.

## Roles

- **Designers (web developers)** build page designs and publish them to the marketplace.
- **Managers** browse the marketplace and apply a design to their artist's releases, then fill in its content.
- **Listeners** view releases rendered through whichever design the artist chose.

## Concepts

- A **design** is a self-contained page built by a designer, offered on the marketplace. Each design is built for a particular surface, currently a release page, and exposes named **slots** the artist fills in (text and image overrides).
- Applying a design to a release stores the artist's slot values (their **customization**) alongside the chosen design. A release with no design applied falls back to a default layout.
- Designs are third-party code and are rendered in a sandboxed, isolated context; they receive only the release data and the artist's customization, never the platform's internal data.

## Web app designer surface

- A designer can create a design, giving it a name, a description, and the surface it is built for, and upload its bundle.
- A design starts as a **draft**, visible only to its creator, and is **published** to appear on the marketplace.
- A designer can update a design's details and upload a revised bundle.
- A designer can archive a design to withdraw it from the marketplace. Crucially, releases already using it keep rendering with it, archiving removes a design from sale, not from the pages that depend on it.
- A designer can see how many releases use a design.
- A design cannot be deleted while any release still renders with it.

## Web app artist surface

- A manager can browse the marketplace of published designs for a given surface, and search it by name.
- A manager can apply a design to one of their releases.
- A manager can fill in the design's slots with their own text and image URLs, and update those values later.
- A manager can remove a design from a release, returning it to the default layout.

## Mobile app

- A listener viewing a release sees it rendered through the design the artist applied, with the artist's content, or the default layout when none is applied.
- Browsing the marketplace, building designs, and applying designs are management/designer concerns and are **not** available on mobile.

## Rules & constraints

- A design built for one surface can only be applied to that surface, a release-page design cannot be applied as, say, a home-page design.
- A release renders with at most one design at a time; applying a new one replaces the previous choice while keeping the release's content.
- A design in use cannot be pulled out from under the releases using it: it can be archived (hidden from the marketplace) but not deleted while referenced.
- Rendered designs are untrusted and sandboxed; they are served their content and the design bundle through short-lived, signed access, and cannot reach anything else.

## Open questions / pending decisions

These depend on product and schema decisions not yet made:

- **Home / artist pages.** The design surfaces include an artist **home page**, but only release pages can currently be dressed. Applying a design to an artist's home page needs a decision and supporting data before it can ship.
- **Marketplace monetization.** Designs are described as offered on a marketplace, but how a designer is compensated, free, one-time purchase, revenue share, is undecided, and there is no purchase/licensing model for designs yet.
- **Versioning.** Whether updating a published design's bundle should version the design (so artists opt in to updates) or replace it in place for everyone.
- **Discovery.** Ranking, categories, previews, and featured designs on the marketplace.

## Out of scope / future

- Designer payouts and licensing (pending the monetization decision above).
- Designs that span multiple releases or a full artist storefront.
- A live design preview/editor inside IME.
