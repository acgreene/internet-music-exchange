import type { Params } from '@angular/router';
import {
  type CatalogSearchQuery,
  FORMAT_IDS,
  type FormatId,
  type GenreId,
  isCountryCode,
  isGenreId,
  type KnownPlace,
  parseSearch,
  SEARCH_KINDS,
  SEARCH_SORTS,
  type SearchFilters,
  type SearchKindId,
  type SearchSort,
} from '@ime/models';

/**
 * A search as the results page's address holds it. `said` is what the
 * listener typed when IME read filters out of it, so the page can offer
 * the plain words back.
 */
export interface SearchState extends SearchFilters {
  sort?: SearchSort;
  said?: string;
}

/** The address of a search for what someone typed, its filters read out. */
export function paramsForPhrase(text: string, places: KnownPlace[]): Params {
  const { filters, read } = parseSearch(text, places);
  return paramsFor({ ...filters, said: read.length ? text.trim() : undefined });
}

/** A search state as query parameters, leaving out what is not set. */
export function paramsFor(state: SearchState): Params {
  return {
    q: state.q || undefined,
    genres: state.genres.length ? state.genres.join(',') : undefined,
    format: state.format,
    under: state.under,
    year: state.year,
    kind: state.kind,
    designed: state.designed ? '1' : undefined,
    country: state.country,
    city: state.country ? state.city : undefined,
    sort: state.sort,
    said: state.said,
  };
}

/** Read a search from the results page's query parameters. */
export function readSearchParams(params: Params): SearchState {
  const text = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : undefined;
  const under = Number(text('under'));
  const year = text('year');
  const country = text('country');
  const knownCountry = country && isCountryCode(country) ? country : undefined;
  return {
    q: text('q')?.trim() ?? '',
    genres: (text('genres') ?? '')
      .split(',')
      .filter((genre): genre is GenreId => isGenreId(genre)),
    format: oneOf(text('format'), FORMAT_IDS) as FormatId | undefined,
    under: Number.isInteger(under) && under > 0 ? under : undefined,
    year: year && /^(19|20)\d(\d|0s)$/.test(year) ? year : undefined,
    kind: oneOf(
      text('kind'),
      SEARCH_KINDS.map((kind) => kind.id),
    ) as SearchKindId | undefined,
    designed: text('designed') === '1',
    country: knownCountry,
    city: knownCountry ? text('city')?.trim() || undefined : undefined,
    sort: oneOf(
      text('sort'),
      SEARCH_SORTS.map((sort) => sort.id),
    ) as SearchSort | undefined,
    said: text('said'),
  };
}

/** The API query for a search state. */
export function apiQuery(state: SearchState): CatalogSearchQuery {
  return {
    q: state.q || undefined,
    genres: state.genres.length ? state.genres.join(',') : undefined,
    format: state.format,
    under: state.under,
    year: state.year,
    kind: state.kind,
    designed: state.designed ? '1' : undefined,
    country: state.country,
    city: state.country ? state.city : undefined,
    sort: state.sort,
  };
}

function oneOf(
  value: string | undefined,
  allowed: readonly string[],
): string | undefined {
  return value && allowed.includes(value) ? value : undefined;
}
