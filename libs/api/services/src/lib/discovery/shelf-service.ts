import {
  type ChartKind,
  DatabaseRepository,
  type ShelfProduct,
  type ShelfRelease,
} from '@ime/db';
import { type CatalogHome, GENRES, genreName, type Shelf } from '@ime/models';
import { CloudStorageService } from '../storage';
import { CatalogCards } from './catalog-cards';
import { dailyRank } from './daily-rank';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many records a shelf holds. */
const SHELF_SIZE = 12;
/** A shelf with fewer than this is too thin to show. */
const MIN_SHELF_SIZE = 6;
/** How many shelves the home page shows at once. */
const SHELVES_SHOWN = 10;
/** How many recent public crates the featured ones are picked from. */
const FEATURE_POOL = 40;
/** How many crates someone made are featured as shelves each day. */
const FEATURED_CRATES = 2;
/** How many genres are tried for the genre of the day before giving up. */
const GENRE_TRIES = 8;
/** How many designed releases the home page shows off. */
const SHOWCASE_SIZE = 3;

/** What a recipe cooks: a shelf's heading and its records or merch. */
type Cooked = Omit<Shelf, 'id' | 'items'> &
  ({ releases: ShelfRelease[] } | { products: ShelfProduct[] });

interface Recipe {
  id: string;
  /** Only for a signed-in listener, drawn from their own library. */
  personal?: boolean;
  /** A shelf of merch, spread between the shelves of records. */
  merch?: boolean;
  cook: (day: string, userId?: string) => Promise<Cooked | null>;
}

/**
 * The home page's shelves: rows of records, each chosen by a recipe, a fixed
 * rule over the catalog or the listener's library, never by AI. Which
 * catalog shelves appear changes daily, two crates people made are featured
 * among them, and a shelf that comes up thin is skipped, so the page stays
 * fresh without anyone curating it.
 */
export class ShelfService {
  private readonly cards: CatalogCards;

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    storage: CloudStorageService = new CloudStorageService(),
  ) {
    this.cards = new CatalogCards(db, storage);
  }

  private readonly recipes: Recipe[] = [
    {
      id: 'following',
      personal: true,
      cook: async (_, userId) => ({
        title: 'From artists you follow',
        reason: '',
        releases: await this.db.shelves.listFromFollowed(
          userId as string,
          SHELF_SIZE,
        ),
      }),
    },
    {
      id: 'kindred',
      personal: true,
      cook: async (_, userId) => ({
        title: 'Pulled for you',
        reason: 'from people who own what you own',
        releases: await this.db.shelves.listOwnedByKindredListeners(
          userId as string,
          SHELF_SIZE,
        ),
      }),
    },
    {
      id: 'best-selling',
      cook: async () => ({
        title: 'Best selling this week',
        reason: '',
        link: '/charts',
        releases: await this.thisWeek('selling'),
      }),
    },
    {
      id: 'most-downloaded',
      cook: async () => ({
        title: 'Most downloaded this week',
        reason: '',
        link: '/charts?chart=downloads',
        releases: await this.thisWeek('downloads'),
      }),
    },
    {
      id: 'free',
      cook: async () => ({
        title: 'Free releases',
        reason: '',
        releases: await this.db.shelves.listFree(SHELF_SIZE),
      }),
    },
    {
      id: 'name-your-price',
      cook: async () => ({
        title: 'Name your price',
        reason: 'pay what you want for these',
        releases: await this.db.shelves.listNameYourPrice(SHELF_SIZE),
      }),
    },
    {
      id: 'first-releases',
      cook: async () => ({
        title: 'First releases',
        reason: 'from artists new to IME this season',
        releases: await this.db.shelves.listFirstReleases(
          this.daysAgo(90),
          SHELF_SIZE,
        ),
      }),
    },
    { id: 'genre-of-the-day', cook: (day) => this.genreOfTheDay(day) },
    { id: 'place-of-the-day', cook: (day) => this.placeOfTheDay(day) },
    {
      id: 'vinyl',
      merch: true,
      cook: async () => ({
        title: 'New on vinyl',
        reason: 'pressings still in stock',
        products: await this.db.shelves.listProducts(['vinyl'], SHELF_SIZE),
      }),
    },
    {
      id: 'apparel',
      merch: true,
      cook: async () => ({
        title: 'Shirts and hoodies',
        reason: 'from the artists who made the music',
        products: await this.db.shelves.listProducts(
          ['shirt', 'hoodie', 'sweatshirt'],
          SHELF_SIZE,
        ),
      }),
    },
  ];

  /**
   * Today's home page: the listener's own shelves first, then catalog
   * shelves in an order that changes daily with crates people made among
   * them, a few designed releases, and how much of each format is on offer.
   *
   * @param userId - The signed-in listener, if any.
   */
  public async getHome(
    userId?: string,
    now = new Date(),
  ): Promise<CatalogHome> {
    const day = now.toISOString().slice(0, 10);
    const personal = userId ? this.recipes.filter((r) => r.personal) : [];
    const daily = (group: Recipe[]) =>
      group.sort((a, b) => dailyRank(day, a.id) - dailyRank(day, b.id));
    const records = daily(this.recipes.filter((r) => !r.personal && !r.merch));
    const goods = daily(this.recipes.filter((r) => r.merch));
    // two shelves of records for each shelf of merch, records first
    const catalog: Recipe[] = [];
    while (records.length || goods.length) {
      catalog.push(...records.splice(0, 2), ...goods.splice(0, 1));
    }

    const shelves: Shelf[] = [];
    for (const recipe of [...personal, ...catalog]) {
      if (shelves.length >= SHELVES_SHOWN) break;
      const shelf = await this.serve(recipe.id, await recipe.cook(day, userId));
      if (shelf) shelves.push(shelf);
    }

    // crates people made sit among the shelves: after the first, and halfway
    const [first, second] = await this.featuredCrates(day, userId);
    if (second) shelves.splice(5, 0, second);
    if (first) shelves.splice(1, 0, first);
    shelves.splice(SHELVES_SHOWN);

    const [formats, designed] = await Promise.all([
      this.db.shelves.countFormats(),
      this.db.shelves.listDesigned(SHOWCASE_SIZE),
    ]);
    return {
      shelves,
      designed: await this.cards.releases(designed),
      formats,
    };
  }

  /** Turn a cooked recipe into a shelf, or nothing when it came up thin. */
  private async serve(
    id: string,
    cooked: Cooked | null,
  ): Promise<Shelf | null> {
    if (!cooked) return null;
    const { title, reason, link } = cooked;
    const items =
      'releases' in cooked
        ? await this.cards.releases(cooked.releases)
        : await this.cards.products(cooked.products);
    if (items.length < MIN_SHELF_SIZE) return null;
    return { id, title, reason, ...(link ? { link } : {}), items };
  }

  /** The releases on sale most people bought, or downloaded, in a week. */
  private async thisWeek(chart: ChartKind): Promise<ShelfRelease[]> {
    const counts = await this.db.charts.countPeople(
      chart,
      this.daysAgo(7),
      new Date(),
      { limit: SHELF_SIZE },
    );
    const rows = await this.db.shelves.listOnSaleByIds(
      counts.map((count) => count.releaseId),
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    return counts.flatMap((count) => byId.get(count.releaseId) ?? []);
  }

  /**
   * A genre picked by the date, among those with enough releases, its most
   * kept first.
   */
  private async genreOfTheDay(day: string): Promise<Cooked | null> {
    const genres = [...GENRES]
      .sort((a, b) => dailyRank(day, a.id) - dailyRank(day, b.id))
      .slice(0, GENRE_TRIES);
    for (const genre of genres) {
      const releases = await this.db.search.searchReleases(
        { words: [], genres: [genre.id] },
        'most-kept',
        SHELF_SIZE,
        0,
      );
      if (releases.length < MIN_SHELF_SIZE) continue;
      return {
        title: genreName(genre.id),
        reason: 'genre of the day',
        link: `/search?genres=${genre.id}`,
        releases,
      };
    }
    return null;
  }

  /**
   * A city picked by the date, among those with enough releases from the
   * artists based there, its newest first.
   */
  private async placeOfTheDay(day: string): Promise<Cooked | null> {
    const places = (
      await this.db.search.countPlaces({ words: [], genres: [] })
    ).filter((place) => place.city && place.count >= MIN_SHELF_SIZE);
    const [place] = places.sort(
      (a, b) =>
        dailyRank(day, `${a.country}:${a.city}`) -
        dailyRank(day, `${b.country}:${b.city}`),
    );
    if (!place?.city) return null;
    const releases = await this.db.search.searchReleases(
      { words: [], genres: [], country: place.country, city: place.city },
      'newest',
      SHELF_SIZE,
      0,
    );
    return {
      title: `Made in ${place.city}`,
      reason: 'place of the day',
      link: `/search?country=${place.country}&city=${encodeURIComponent(place.city)}`,
      releases,
    };
  }

  /**
   * Public crates for today's home page, picked by the date among the most
   * recently changed ones with enough records still on sale, never the
   * viewer's own.
   */
  private async featuredCrates(day: string, userId?: string): Promise<Shelf[]> {
    const crates = (await this.db.crates.listPublic(FEATURE_POOL)).sort(
      (a, b) => dailyRank(day, a.id) - dailyRank(day, b.id),
    );
    const featured: Shelf[] = [];
    for (const crate of crates) {
      if (featured.length >= FEATURED_CRATES) break;
      if (crate.ownerUserId === userId) continue;
      // two crates of the same name side by side would read as a mistake
      if (featured.some((shelf) => shelf.title === crate.name)) continue;
      const items = (await this.db.crates.listItems(crate.id))
        .filter((item) => item.available)
        .slice(0, SHELF_SIZE);
      if (items.length < MIN_SHELF_SIZE) continue;
      featured.push({
        id: `crate-${featured.length + 1}`,
        title: crate.name,
        reason: crate.ownerUsername
          ? `a crate by @${crate.ownerUsername}`
          : 'a crate from someone on IME',
        link: `/crates/${crate.id}`,
        items: await this.cards.releases(items),
      });
    }
    return featured;
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * DAY_MS);
  }
}
