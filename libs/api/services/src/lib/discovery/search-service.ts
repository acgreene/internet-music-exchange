import {
  DatabaseRepository,
  type ReleaseEdition,
  type ReleaseSearch,
} from '@ime/db';
import {
  type CatalogSearchQuery,
  type PlaceCount,
  isGenreId,
  PRICE_CEILINGS,
  type SearchRelease,
  type SearchResults,
  type SearchSuggestions,
} from '@ime/models';
import { CloudStorageService } from '../storage';
import { CatalogCards } from './catalog-cards';

const PAGE_SIZE = 24;
const MAX_WORDS = 8;
const ARTISTS_SHOWN = 6;
const MERCH_SHOWN = 8;
const SUGGESTIONS = { artists: 4, releases: 5, tags: 4 };

/**
 * Searching the catalog: releases by words and filters, with how many
 * releases each filter value would leave, plus matching artists and merch,
 * and quick suggestions while someone types.
 */
export class SearchService {
  private readonly cards: CatalogCards;

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    storage: CloudStorageService = new CloudStorageService(),
  ) {
    this.cards = new CatalogCards(db, storage);
  }

  /**
   * One page of releases matching a search, and the counts for its filters.
   * Artists and merch are found by words alone, so they only show when the
   * search has words and no release filters.
   */
  public async search(query: CatalogSearchQuery): Promise<SearchResults> {
    const search = this.toReleaseSearch(query);
    const sort = query.sort ?? (search.words.length ? 'relevance' : 'newest');
    const wordsOnly =
      search.words.length > 0 &&
      !search.genres.length &&
      !search.format &&
      search.under === undefined &&
      !search.releasedFrom &&
      !search.kind &&
      !search.designed &&
      !search.country;

    const [
      rows,
      total,
      genres,
      formats,
      prices,
      years,
      kinds,
      designed,
      places,
    ] = await Promise.all([
      this.db.search.searchReleases(
        search,
        sort,
        Math.min(query.limit ?? PAGE_SIZE, PAGE_SIZE * 2),
        query.offset ?? 0,
      ),
      this.db.search.countReleases(search),
      this.db.search.countGenres(search),
      this.db.search.countFormats(search),
      this.db.search.countPrices(search, PRICE_CEILINGS),
      this.db.search.countYears(search),
      this.db.search.countKinds(search),
      this.db.search.countDesigned(search),
      this.db.search.countPlaces(search),
    ]);
    const [cards, editions, artists, merch] = await Promise.all([
      this.cards.releases(rows),
      this.db.search.listEditions(rows.map((row) => row.id)),
      wordsOnly && !query.offset
        ? this.db.artists.searchByName(search.words.join(' '), ARTISTS_SHOWN)
        : [],
      wordsOnly && !query.offset
        ? this.db.search.searchMerch(search.words, MERCH_SHOWN)
        : [],
    ]);

    return {
      releases: cards.map((card): SearchRelease => ({
        release: card.release,
        pricing: card.pricing,
        editions: cheapestByFormat(editions, card.release.id),
      })),
      total,
      artists: artists.filter((artist) => !artist.offSaleAt),
      merch: await this.cards.products(merch),
      facets: { genres, formats, prices, years, kinds, designed, places },
    };
  }

  /**
   * Every place an artist with music on sale is based, for reading places
   * out of what people type.
   */
  public async listPlaces(): Promise<PlaceCount[]> {
    return this.db.search.listPlaces();
  }

  /**
   * Artists, releases, and tags that start with or contain what someone has
   * typed so far.
   */
  public async suggest(text: string): Promise<SearchSuggestions> {
    const typed = text.trim().slice(0, 100);
    if (!typed) return { artists: [], releases: [], tags: [] };
    const [artists, releases, tags] = await Promise.all([
      this.db.artists.searchByName(typed, SUGGESTIONS.artists),
      this.db.search.suggestReleases(typed, SUGGESTIONS.releases),
      this.db.search.suggestTags(typed, SUGGESTIONS.tags),
    ]);
    const cards = await this.cards.releases(releases);
    return {
      artists: artists.map(({ name, handle }) => ({ name, handle })),
      releases: cards.map(({ release }) => ({
        title: release.title,
        slug: release.slug,
        artistName: release.artistName,
        artistHandle: release.artistHandle,
        coverUrl: release.coverUrl,
      })),
      tags,
    };
  }

  private toReleaseSearch(query: CatalogSearchQuery): ReleaseSearch {
    const words = (query.q ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, MAX_WORDS);
    const genres = (query.genres ?? '')
      .split(',')
      .filter((genre) => isGenreId(genre));
    return {
      words,
      genres,
      format: query.format,
      under: query.under,
      ...releasedBetween(query.year),
      kind: query.kind,
      designed: query.designed === '1',
      country: query.country,
      city: query.country ? query.city?.trim() || undefined : undefined,
    };
  }
}

/** A year like "2024" or a decade like "1990s", as a range of dates. */
function releasedBetween(
  year: string | undefined,
): Pick<ReleaseSearch, 'releasedFrom' | 'releasedTo'> {
  if (!year) return {};
  const first = Number(year.slice(0, 4));
  const last = year.endsWith('s') ? first + 9 : first;
  return { releasedFrom: `${first}-01-01`, releasedTo: `${last}-12-31` };
}

/** One edition per format for a release, the cheapest of each. */
function cheapestByFormat(
  editions: ReleaseEdition[],
  releaseId: string,
): SearchRelease['editions'] {
  const byFormat = new Map<string, ReleaseEdition>();
  for (const edition of editions) {
    if (edition.releaseId !== releaseId || byFormat.has(edition.type)) continue;
    byFormat.set(edition.type, edition);
  }
  return [...byFormat.values()].map((edition) => ({
    productId: edition.productId,
    format: edition.type,
    currency: edition.currency,
    price: edition.price,
  }));
}
