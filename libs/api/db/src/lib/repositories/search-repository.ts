import {
  and,
  arrayOverlaps,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  min,
  notInArray,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  artists,
  entitlements,
  products,
  type ProductType,
  productVariants,
  releaseDesigns,
  type ReleaseKind,
  releasePricing,
  releases,
} from '../tables';
import type { ShelfProduct, ShelfRelease } from './shelf-repository';

/** The physical formats a release can be offered in, beside digital. */
export type PhysicalFormat = 'vinyl' | 'cassette' | 'cd';

const PHYSICAL_FORMATS: PhysicalFormat[] = ['vinyl', 'cassette', 'cd'];

/**
 * What a release search asks for. `under` is an exclusive price ceiling in
 * minor units, applied to the chosen format, or to the download when none
 * is chosen.
 */
export interface ReleaseSearch {
  words: string[];
  genres: string[];
  format?: 'digital' | PhysicalFormat;
  under?: number;
  /** Released on or after, `YYYY-MM-DD`. */
  releasedFrom?: string;
  /** Released on or before, `YYYY-MM-DD`. */
  releasedTo?: string;
  kind?: ReleaseKind;
  designed?: boolean;
  /** Where the artist is based: a country code, and optionally a city in it. */
  country?: string;
  city?: string;
}

export type SearchFacet =
  'genres' | 'format' | 'under' | 'released' | 'kind' | 'designed' | 'place';

export type ReleaseSearchSort = 'relevance' | 'newest' | 'most-kept' | 'price';

export interface FacetCount<T = string> {
  value: T;
  count: number;
}

/** A place artists are based, with how many releases or artists are there. */
export interface PlaceCount {
  country: string;
  city: string | null;
  count: number;
}

/** A physical edition of a release, priced from its cheapest variant in stock. */
export interface ReleaseEdition {
  releaseId: string;
  productId: string;
  type: PhysicalFormat;
  currency: 'usd' | 'eur';
  price: number;
}

/** Published, from an artist in good standing. */
const onSale = and(
  eq(releases.status, 'published'),
  isNull(artists.suspendedAt),
  isNull(artists.offSaleAt),
);

const resultColumns = {
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

/** What a word may match on a release: its title, artist, and tags. */
const searchable = sql`(${releases.title} || ' ' || ${artists.name} || ' ' || array_to_string(${releases.tags}, ' '))`;

/** The download's price, free releases at zero. */
const digitalPrice = sql`coalesce(${releasePricing.minimumPrice}, 0)`;

function contains(word: string): string {
  return `%${word.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * The queries behind search: releases matching words and filters, how many
 * match each filter value, the editions to show beside them, and quick
 * suggestions while someone types.
 */
export class SearchRepository {
  constructor(private readonly db: Db) {}

  /**
   * One page of releases matching a search.
   */
  public async searchReleases(
    search: ReleaseSearch,
    sort: ReleaseSearchSort,
    limit: number,
    offset: number,
  ): Promise<ShelfRelease[]> {
    return this.releaseQuery(this.where(search))
      .orderBy(...this.order(search, sort), desc(releases.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  public async countReleases(search: ReleaseSearch): Promise<number> {
    return this.countWhere(this.where(search));
  }

  /** How many releases each genre would leave, keeping the other filters. */
  public async countGenres(search: ReleaseSearch): Promise<FacetCount[]> {
    const genre = sql<string>`unnest(${releases.genres})`;
    return this.db
      .select({ value: genre, count: count() })
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(and(onSale, this.where(search, 'genres')))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`, sql`1`);
  }

  public async countKinds(
    search: ReleaseSearch,
  ): Promise<FacetCount<ReleaseKind>[]> {
    return this.db
      .select({ value: releases.kind, count: count() })
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(and(onSale, this.where(search, 'kind')))
      .groupBy(releases.kind)
      .orderBy(desc(count()));
  }

  /** How many releases came out in each year, newest first. */
  public async countYears(
    search: ReleaseSearch,
  ): Promise<FacetCount<number>[]> {
    const year = sql<number>`extract(year from ${releases.releasedAt})::int`;
    return this.db
      .select({ value: year, count: count() })
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(
        and(
          onSale,
          this.where(search, 'released'),
          isNotNull(releases.releasedAt),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1 desc`);
  }

  /** How many releases each format would leave, priced in that format. */
  public async countFormats(
    search: ReleaseSearch,
  ): Promise<FacetCount<'digital' | PhysicalFormat>[]> {
    const others = { ...search, format: undefined, under: undefined };
    const counts = await Promise.all([
      this.countWhere(
        and(
          this.where(others),
          search.under === undefined
            ? undefined
            : lt(digitalPrice, search.under),
        ),
      ),
      ...PHYSICAL_FORMATS.map((format) =>
        this.countWhere(
          and(this.where(others), this.offeredAs(format, search.under)),
        ),
      ),
    ]);
    return (['digital', ...PHYSICAL_FORMATS] as const).map((value, i) => ({
      value,
      count: counts[i],
    }));
  }

  /** How many releases each price ceiling would leave. */
  public async countPrices(
    search: ReleaseSearch,
    ceilings: readonly number[],
  ): Promise<FacetCount<number>[]> {
    const counts = await Promise.all(
      ceilings.map((under) =>
        this.countWhere(this.where({ ...search, under })),
      ),
    );
    return ceilings.map((value, i) => ({ value, count: counts[i] }));
  }

  /** How many releases come from each place, keeping the other filters. */
  public async countPlaces(search: ReleaseSearch): Promise<PlaceCount[]> {
    const rows = await this.db
      .select({ country: artists.country, city: artists.city, count: count() })
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(
        and(onSale, this.where(search, 'place'), isNotNull(artists.country)),
      )
      .groupBy(artists.country, artists.city)
      .orderBy(desc(count()));
    return rows as PlaceCount[];
  }

  /**
   * Every place an artist with music on sale is based, with how many such
   * artists are there. Search reads these places out of what people type.
   */
  public async listPlaces(): Promise<PlaceCount[]> {
    const rows = await this.db
      .select({
        country: artists.country,
        city: artists.city,
        count: countDistinct(artists.id),
      })
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(and(onSale, isNotNull(artists.country)))
      .groupBy(artists.country, artists.city)
      .orderBy(desc(countDistinct(artists.id)));
    return rows as PlaceCount[];
  }

  public async countDesigned(search: ReleaseSearch): Promise<number> {
    return this.countWhere(this.where({ ...search, designed: true }));
  }

  /**
   * The physical editions of some releases that can be bought right now.
   */
  public async listEditions(releaseIds: string[]): Promise<ReleaseEdition[]> {
    if (releaseIds.length === 0) return [];
    const price = min(productVariants.price);
    const rows = await this.db
      .select({
        releaseId: products.releaseId,
        productId: products.id,
        type: products.type,
        currency: products.currency,
        price: sql<number>`${price}`.mapWith(Number),
      })
      .from(products)
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .where(
        and(
          inArray(products.releaseId, releaseIds),
          eq(products.status, 'published'),
          inArray(products.type, PHYSICAL_FORMATS),
          gt(productVariants.stock, 0),
        ),
      )
      .groupBy(products.id)
      .orderBy(asc(price));
    return rows as ReleaseEdition[];
  }

  /**
   * Merch that is not a record, by name or artist, cheapest variant in stock.
   */
  public async searchMerch(
    words: string[],
    limit: number,
  ): Promise<ShelfProduct[]> {
    const price = min(productVariants.price);
    const text = sql`(${products.name} || ' ' || ${artists.name})`;
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
          notInArray(products.type, PHYSICAL_FORMATS),
          gt(productVariants.stock, 0),
          ...words.map((word) => ilike(text, contains(word))),
        ),
      )
      .groupBy(products.id, artists.id)
      .orderBy(desc(products.createdAt))
      .limit(limit);
  }

  /** Releases whose title has the text, for suggestions while typing. */
  public async suggestReleases(
    text: string,
    limit: number,
  ): Promise<ShelfRelease[]> {
    return this.releaseQuery(ilike(releases.title, contains(text)))
      .orderBy(
        sql`${releases.title} ilike ${`${text.replace(/[\\%_]/g, '\\$&')}%`} desc`,
        desc(releases.publishedAt),
      )
      .limit(limit);
  }

  /** Tags on public releases that start with the text, most used first. */
  public async suggestTags(text: string, limit: number): Promise<FacetCount[]> {
    const tag = sql<string>`tag`;
    return this.db
      .select({ value: tag, count: count() })
      .from(
        this.db
          .select({ tag: sql<string>`unnest(${releases.tags})`.as('tag') })
          .from(releases)
          .innerJoin(artists, eq(artists.id, releases.artistId))
          .where(onSale)
          .as('tags'),
      )
      .where(ilike(tag, `${text.replace(/[\\%_]/g, '\\$&')}%`))
      .groupBy(tag)
      .orderBy(desc(count()), tag)
      .limit(limit);
  }

  private releaseQuery(where: SQL | undefined) {
    return this.db
      .select(resultColumns)
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(and(onSale, where));
  }

  private async countWhere(where: SQL | undefined): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .leftJoin(releasePricing, eq(releasePricing.releaseId, releases.id))
      .where(and(onSale, where));
    return row?.count ?? 0;
  }

  /**
   * Every condition of a search besides being on sale, leaving out one facet so its own counts
   * show what choosing another value would give.
   */
  private where(search: ReleaseSearch, omit?: SearchFacet): SQL | undefined {
    const physical =
      search.format && search.format !== 'digital' ? search.format : undefined;
    return and(
      ...search.words.map((word) => ilike(searchable, contains(word))),
      omit !== 'genres' && search.genres.length
        ? arrayOverlaps(releases.genres, search.genres)
        : undefined,
      omit !== 'format' && physical
        ? this.offeredAs(physical, omit === 'under' ? undefined : search.under)
        : undefined,
      omit !== 'under' && search.under !== undefined && !physical
        ? lt(digitalPrice, search.under)
        : undefined,
      omit !== 'released' && search.releasedFrom
        ? gte(releases.releasedAt, search.releasedFrom)
        : undefined,
      omit !== 'released' && search.releasedTo
        ? lte(releases.releasedAt, search.releasedTo)
        : undefined,
      omit !== 'kind' && search.kind
        ? eq(releases.kind, search.kind)
        : undefined,
      omit !== 'place' && search.country
        ? eq(artists.country, search.country)
        : undefined,
      omit !== 'place' && search.country && search.city
        ? sql`lower(${artists.city}) = lower(${search.city})`
        : undefined,
      omit !== 'designed' && search.designed
        ? exists(
            this.db
              .select({ id: releaseDesigns.releaseId })
              .from(releaseDesigns)
              .where(eq(releaseDesigns.releaseId, releases.id)),
          )
        : undefined,
    );
  }

  /** The release has an edition of this format in stock, under the ceiling. */
  private offeredAs(format: PhysicalFormat, under?: number): SQL {
    return exists(
      this.db
        .select({ id: products.id })
        .from(products)
        .innerJoin(productVariants, eq(productVariants.productId, products.id))
        .where(
          and(
            eq(products.releaseId, releases.id),
            eq(products.status, 'published'),
            eq(products.type, format as ProductType),
            gt(productVariants.stock, 0),
            under === undefined ? undefined : lt(productVariants.price, under),
          ),
        ),
    );
  }

  private order(search: ReleaseSearch, sort: ReleaseSearchSort): SQL[] {
    if (sort === 'most-kept') {
      return [
        desc(
          sql`(select count(*) from ${entitlements} where ${entitlements.releaseId} = ${releases.id})`,
        ),
      ];
    }
    if (sort === 'price') {
      const physical =
        search.format && search.format !== 'digital' ? search.format : null;
      return [
        asc(
          physical
            ? sql`(select min(${productVariants.price}) from ${productVariants} inner join ${products} on ${products.id} = ${productVariants.productId} where ${products.releaseId} = ${releases.id} and ${products.status} = 'published' and ${products.type} = ${physical} and ${productVariants.stock} > 0)`
            : digitalPrice,
        ),
      ];
    }
    if (sort === 'relevance' && search.words.length) {
      const text = search.words.join(' ');
      return [
        asc(
          sql`case when ${releases.title} ilike ${text} then 0 when ${releases.title} ilike ${contains(text).slice(1)} then 1 when ${artists.name} ilike ${contains(text).slice(1)} then 2 else 3 end`,
        ),
      ];
    }
    return [];
  }
}
