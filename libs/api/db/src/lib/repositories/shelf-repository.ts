import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  min,
  ne,
  notExists,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../database-service';
import {
  artistFollowers,
  artists,
  type Currency,
  entitlements,
  type PricingMode,
  products,
  type ProductType,
  productVariants,
  releaseDesigns,
  type ReleaseKind,
  releasePricing,
  releases,
} from '../tables';

/**
 * A release as a shelf shows it: what it is, who made it, and its price.
 */
export interface ShelfRelease {
  id: string;
  title: string;
  slug: string;
  kind: ReleaseKind;
  releasedAt: string | null;
  publishedAt: Date | null;
  artistId: string;
  artistName: string;
  artistHandle: string;
  pricingMode: PricingMode | null;
  currency: Currency | null;
  minimumPrice: number | null;
  suggestedPrice: number | null;
}

/**
 * A product as a shelf shows it, priced from its cheapest variant in stock.
 */
export interface ShelfProduct {
  id: string;
  name: string;
  type: ProductType;
  artistId: string;
  artistName: string;
  artistHandle: string;
  currency: Currency;
  price: number;
}

/**
 * How much of each format IME has on offer.
 */
export interface FormatCounts {
  releases: number;
  products: { type: ProductType; count: number }[];
}

const shelfReleaseColumns = {
  id: releases.id,
  title: releases.title,
  slug: releases.slug,
  kind: releases.kind,
  releasedAt: releases.releasedAt,
  publishedAt: releases.publishedAt,
  artistId: releases.artistId,
  artistName: artists.name,
  artistHandle: artists.handle,
  pricingMode: releasePricing.mode,
  currency: releasePricing.currency,
  minimumPrice: releasePricing.minimumPrice,
  suggestedPrice: releasePricing.suggestedPrice,
};

/** Published, from an artist in good standing. */
const onSale = and(
  eq(releases.status, 'published'),
  isNull(artists.suspendedAt),
  isNull(artists.offSaleAt),
);

/**
 * The queries behind home page shelves: small lists of public releases and
 * products, each picked by a different rule.
 */
export class ShelfRepository {
  constructor(private readonly db: Db) {}

  private releaseShelf(where: SQL | undefined) {
    return this.db
      .select(shelfReleaseColumns)
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(and(onSale, where));
  }

  /**
   * The newest releases.
   */
  public async listNewest(limit: number): Promise<ShelfRelease[]> {
    return this.releaseShelf(undefined)
      .orderBy(desc(releases.publishedAt))
      .limit(limit);
  }

  /**
   * The newest free releases.
   */
  public async listFree(limit: number): Promise<ShelfRelease[]> {
    return this.releaseShelf(eq(releasePricing.mode, 'free'))
      .orderBy(desc(releases.publishedAt))
      .limit(limit);
  }

  /**
   * Artists' first releases, published since a moment.
   *
   * @param since - The earliest publish time to include.
   */
  public async listFirstReleases(
    since: Date,
    limit: number,
  ): Promise<ShelfRelease[]> {
    const earlier = alias(releases, 'earlier');
    return this.releaseShelf(
      and(
        gte(releases.publishedAt, since),
        notExists(
          this.db
            .select({ id: earlier.id })
            .from(earlier)
            .where(
              and(
                eq(earlier.artistId, releases.artistId),
                ne(earlier.status, 'draft'),
                lt(earlier.publishedAt, releases.publishedAt),
              ),
            ),
        ),
      ),
    )
      .orderBy(desc(releases.publishedAt))
      .limit(limit);
  }

  /**
   * The newest releases that render through a design.
   */
  public async listDesigned(limit: number): Promise<ShelfRelease[]> {
    return this.releaseShelf(
      exists(
        this.db
          .select({ id: releaseDesigns.releaseId })
          .from(releaseDesigns)
          .where(eq(releaseDesigns.releaseId, releases.id)),
      ),
    )
      .orderBy(desc(releases.publishedAt))
      .limit(limit);
  }

  /**
   * The newest releases from the artists a listener follows.
   *
   * @param userId - The listener.
   */
  public async listFromFollowed(
    userId: string,
    limit: number,
  ): Promise<ShelfRelease[]> {
    return this.releaseShelf(
      inArray(
        releases.artistId,
        this.db
          .select({ artistId: artistFollowers.artistId })
          .from(artistFollowers)
          .where(eq(artistFollowers.userId, userId)),
      ),
    )
      .orderBy(desc(releases.publishedAt))
      .limit(limit);
  }

  /**
   * The releases the most people came to own since a moment, bought or
   * claimed alike.
   *
   * @param since - The start of the period.
   */
  public async listMostKept(
    since: Date,
    limit: number,
  ): Promise<ShelfRelease[]> {
    const keepers = countDistinct(entitlements.userId);
    return this.db
      .select(shelfReleaseColumns)
      .from(entitlements)
      .innerJoin(releases, eq(releases.id, entitlements.releaseId))
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(and(onSale, gte(entitlements.createdAt, since)))
      .groupBy(releases.id, artists.id, releasePricing.releaseId)
      .orderBy(desc(keepers), desc(releases.publishedAt))
      .limit(limit);
  }

  /**
   * Releases owned by the people who own what a listener owns, that the
   * listener does not own yet, the most widely shared first.
   *
   * @param userId - The listener.
   */
  public async listOwnedByKindredListeners(
    userId: string,
    limit: number,
  ): Promise<ShelfRelease[]> {
    const mine = alias(entitlements, 'mine');
    const theirs = alias(entitlements, 'theirs');
    const kindred = this.db
      .selectDistinct({ userId: theirs.userId })
      .from(mine)
      .innerJoin(theirs, eq(theirs.releaseId, mine.releaseId))
      .where(and(eq(mine.userId, userId), ne(theirs.userId, userId)));
    const owned = this.db
      .select({ releaseId: entitlements.releaseId })
      .from(entitlements)
      .where(eq(entitlements.userId, userId));

    return this.db
      .select(shelfReleaseColumns)
      .from(entitlements)
      .innerJoin(releases, eq(releases.id, entitlements.releaseId))
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(
        and(
          onSale,
          inArray(entitlements.userId, kindred),
          sql`${entitlements.releaseId} not in ${owned}`,
        ),
      )
      .groupBy(releases.id, artists.id, releasePricing.releaseId)
      .orderBy(desc(countDistinct(entitlements.userId)))
      .limit(limit);
  }

  /**
   * Published products of some types with a variant in stock, at or under
   * a price, newest first.
   *
   * @param maxPrice - The most the cheapest variant may cost, in minor
   * units; none for any price.
   */
  public async listProducts(
    types: ProductType[],
    limit: number,
    maxPrice?: number,
  ): Promise<ShelfProduct[]> {
    const price = min(productVariants.price);
    return this.db
      .select({
        id: products.id,
        name: products.name,
        type: products.type,
        artistId: products.artistId,
        artistName: artists.name,
        artistHandle: artists.handle,
        currency: products.currency,
        price: sql<number>`${price}`.mapWith(Number),
      })
      .from(products)
      .innerJoin(artists, eq(artists.id, products.artistId))
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(products.status, 'published'),
          isNull(artists.suspendedAt),
          isNull(artists.offSaleAt),
          inArray(products.type, types),
          sql`${productVariants.stock} > 0`,
          maxPrice === undefined
            ? undefined
            : lte(productVariants.price, maxPrice),
        ),
      )
      .groupBy(products.id, artists.id)
      .orderBy(desc(products.createdAt))
      .limit(limit);
  }

  /**
   * How many releases and products of each type are on offer.
   */
  public async countFormats(): Promise<FormatCounts> {
    const [releaseCount] = await this.db
      .select({ value: count() })
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(onSale);
    const productCounts = await this.db
      .select({ type: products.type, count: count() })
      .from(products)
      .innerJoin(artists, eq(artists.id, products.artistId))
      .where(
        and(
          eq(products.status, 'published'),
          isNull(artists.suspendedAt),
          isNull(artists.offSaleAt),
        ),
      )
      .groupBy(products.type);
    return { releases: releaseCount?.value ?? 0, products: productCounts };
  }
}
