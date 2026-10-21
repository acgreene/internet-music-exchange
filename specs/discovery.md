# Discovery

## Purpose

Discovery is how a listener finds something to listen to or buy. It is the listener's primary entry point, especially on mobile, where it is effectively the home of the app. This domain covers search, browsing the catalog, and the surfaces that put music in front of a listener. It spans artists, releases, and merch rather than belonging to any one of them.

## Roles

- **Any visitor** can browse and search public content.
- **Signed-in listeners** additionally get a personalized entry point through the artists they follow.

## What a listener can do

### Search

- A listener can search for artists by name and releases by title.
- Search returns published, publicly available results, with enough context to recognize each one (artist name, release title, cover art).
- Finding an artist by their exact handle is also supported (see
  [Artists & Management](./artists.md)).

### Browse

- A listener can browse the catalog of published releases, newest first.
- A listener can open an artist to see their discography and their store.
- A listener can browse an artist's merch and open a product to see its variants and photos (see [Merchandise](./merchandise.md)).

### Personalized entry points

- A signed-in listener has a feed of new releases from the artists they follow (see [Community](./community.md)). This is the primary "what's new for you"
  surface.

## Web & mobile

- Discovery is available on **both web and mobile**. On mobile it is the central experience; browsing, search, and the feed are the app's home.

## Rules & constraints

- Discovery only ever surfaces public content: published releases and products, and public artist profiles. Drafts, archived items, items off sale because their hosting contributions lapsed, taken-down content, and suspended artists never appear.
- Cover art and the artist name are always available for a public release, so discovery surfaces can always render a recognizable result.
- Preview tracks let a listener sample a release from a discovery surface without owning it (see [Releases & Music](./releases.md)).

## Out of scope / future

- Algorithmic recommendations ("you might like").
- Genre, tag, mood, and faceted browsing.
- Charts, trending, editorial, and featured placement.
- Unified search across merch and page designs.
- Search of the [Creative Pages](./creative-pages.md) marketplace is specified with that domain, since its audience is artists rather than listeners.
