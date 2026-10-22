import {
  DatabaseRepository,
  type ShelfProduct,
  type ShelfRelease,
} from '@ime/db';
import type { CatalogHome, Shelf, ShelfItem } from '@ime/models';
import { CloudStorageService } from '../storage';
import { CatalogCards } from './catalog-cards';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many records a shelf holds. */
const SHELF_SIZE = 12;
/** A shelf with fewer than this is too thin to show. */
const MIN_SHELF_SIZE = 6;
/** How many shelves the home page shows at once. */
const SHELVES_SHOWN = 6;
/** How many designed releases the home page shows off. */
const SHOWCASE_SIZE = 3;

type Recipe = {
  id: string;
  title: string;
  reason: string;
  /** Only for a signed-in listener, drawn from their own library. */
  personal?: boolean;
} & (
  | { releases: (userId: string | undefined) => Promise<ShelfRelease[]> }
  | { products: () => Promise<ShelfProduct[]> }
);

/**
 * The home page's shelves: rows of records, each chosen by a recipe, a fixed
 * rule over the catalog or the listener's library. Which catalog shelves
 * appear changes daily, and a shelf that comes up thin is skipped, so the
 * page stays fresh without anyone curating it.
 */
export class ShelfService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    storage: CloudStorageService = new CloudStorageService(),
  ) {
    this.cards = new CatalogCards(db, storage);
  }

  private readonly cards: CatalogCards;

  private readonly recipes: Recipe[] = [
    {
      id: 'following',
      title: 'New from artists you follow',
      reason: 'because you follow them',
      personal: true,
      releases: (userId) =>
        this.db.shelves.listFromFollowed(userId as string, SHELF_SIZE),
    },
    {
      id: 'kindred',
      title: 'Pulled for you',
      reason: 'from people who own what you own',
      personal: true,
      releases: (userId) =>
        this.db.shelves.listOwnedByKindredListeners(
          userId as string,
          SHELF_SIZE,
        ),
    },
    {
      id: 'just-landed',
      title: 'Just landed',
      reason: 'the newest releases on IME',
      releases: () => this.db.shelves.listNewest(SHELF_SIZE),
    },
    {
      id: 'most-kept',
      title: 'Most kept this week',
      reason: 'by how many people took them home, not by sales',
      releases: () => this.db.shelves.listMostKept(this.daysAgo(7), SHELF_SIZE),
    },
    {
      id: 'free',
      title: 'Free to keep',
      reason: 'download them and they are yours',
      releases: () => this.db.shelves.listFree(SHELF_SIZE),
    },
    {
      id: 'first-releases',
      title: 'First releases',
      reason: 'from artists new to IME this season',
      releases: () =>
        this.db.shelves.listFirstReleases(this.daysAgo(90), SHELF_SIZE),
    },
    {
      id: 'designed',
      title: 'Designed releases',
      reason: 'each comes with a page built by a designer',
      releases: () => this.db.shelves.listDesigned(SHELF_SIZE),
    },
    {
      id: 'tapes',
      title: 'Tapes under $10',
      reason: 'still in stock',
      products: () =>
        this.db.shelves.listProducts(['cassette'], SHELF_SIZE, 1000),
    },
    {
      id: 'vinyl',
      title: 'New on vinyl',
      reason: 'pressings still in stock',
      products: () => this.db.shelves.listProducts(['vinyl'], SHELF_SIZE),
    },
    {
      id: 'apparel',
      title: 'Shirts and hoodies',
      reason: 'from the artists who made the music',
      products: () =>
        this.db.shelves.listProducts(
          ['shirt', 'hoodie', 'sweatshirt'],
          SHELF_SIZE,
        ),
    },
  ];

  /**
   * Today's home page: the listener's own shelves first, then catalog
   * shelves in an order that changes daily, and how much of each format is
   * on offer.
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
      group.sort((a, b) => rotation(day, a.id) - rotation(day, b.id));
    const records = daily(
      this.recipes.filter((r) => !r.personal && 'releases' in r),
    );
    const goods = daily(this.recipes.filter((r) => 'products' in r));
    // two shelves of records for each shelf of merch, records first
    const catalog: Recipe[] = [];
    while (records.length || goods.length) {
      catalog.push(...records.splice(0, 2), ...goods.splice(0, 1));
    }

    const shelves: Shelf[] = [];
    for (const recipe of [...personal, ...catalog]) {
      if (shelves.length >= SHELVES_SHOWN) break;
      const items = await this.cook(recipe, userId);
      if (items.length >= MIN_SHELF_SIZE) {
        shelves.push({
          id: recipe.id,
          title: recipe.title,
          reason: recipe.reason,
          items,
        });
      }
    }

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

  private async cook(recipe: Recipe, userId?: string): Promise<ShelfItem[]> {
    if ('releases' in recipe) {
      return this.cards.releases(await recipe.releases(userId));
    }
    return this.cards.products(await recipe.products());
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * DAY_MS);
  }
}

/** A stable shuffle key for a shelf on a given day. */
function rotation(day: string, id: string): number {
  let hash = 2166136261;
  for (const char of `${day}:${id}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}
