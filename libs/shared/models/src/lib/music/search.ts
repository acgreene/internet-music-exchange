import { GENRES, type GenreId } from './genres';

/** The formats a release can be found in. Every release is digital. */
export const FORMATS = [
  { id: 'digital', name: 'Digital' },
  { id: 'vinyl', name: 'Vinyl' },
  { id: 'cassette', name: 'Cassette' },
  { id: 'cd', name: 'CD' },
] as const;

export type FormatId = (typeof FORMATS)[number]['id'];

export const FORMAT_IDS = FORMATS.map((format) => format.id) as [
  FormatId,
  ...FormatId[],
];

/** The kinds of release a search can be narrowed to. */
export const SEARCH_KINDS = [
  { id: 'album', name: 'Album' },
  { id: 'ep', name: 'EP' },
  { id: 'single', name: 'Single' },
  { id: 'lp', name: 'LP' },
  { id: 'compilation', name: 'Compilation' },
  { id: 'soundtrack', name: 'Soundtrack' },
] as const;

export type SearchKindId = (typeof SEARCH_KINDS)[number]['id'];

/** Price ceilings the filters offer, in cents, exclusive: 1 means free. */
export const PRICE_CEILINGS = [1, 500, 1000, 2000] as const;

export const SEARCH_SORTS = [
  { id: 'relevance', name: 'Best match' },
  { id: 'newest', name: 'Newest' },
  { id: 'most-kept', name: 'Most kept' },
  { id: 'price', name: 'Lowest price' },
] as const;

export type SearchSort = (typeof SEARCH_SORTS)[number]['id'];

/**
 * What a search asks for. `under` is a price ceiling in cents, exclusive,
 * applied to the chosen format; `year` is a year like "2024" or a decade
 * like "1990s".
 */
export interface SearchFilters {
  q: string;
  genres: GenreId[];
  format?: FormatId;
  under?: number;
  year?: string;
  kind?: SearchKindId;
  designed?: boolean;
}

/** A filter IME recognized in what someone typed. */
export interface ReadFilter {
  key: 'genre' | 'format' | 'under' | 'year' | 'kind' | 'designed';
  value: string;
  label: string;
}

export function priceLabel(under: number): string {
  if (under <= 1) return 'Free';
  // a ceiling one cent over whole dollars came from "up to"
  if (under % 100 === 1) return `Up to $${(under - 1) / 100}`;
  return `Under $${Math.round(under / 100)}`;
}

export function yearLabel(year: string): string {
  return year.endsWith('s') ? `The ${year}` : year;
}

/** Words that name a genre without being its name on the list. */
const GENRE_ALIASES: Record<string, GenreId> = {
  'hip hop': 'hip-hop',
  hiphop: 'hip-hop',
  rap: 'hip-hop',
  rnb: 'r-and-b',
  'r and b': 'r-and-b',
  dnb: 'drum-and-bass',
  'd and b': 'drum-and-bass',
  'drum n bass': 'drum-and-bass',
  lofi: 'lo-fi',
  'lo fi': 'lo-fi',
  synthpop: 'synth-pop',
  'synth pop': 'synth-pop',
  postpunk: 'post-punk',
  'post punk': 'post-punk',
  'post rock': 'post-rock',
  dreampop: 'dream-pop',
  'trip hop': 'trip-hop',
  electronica: 'electronic',
  'math rock': 'math-rock',
  'garage rock': 'garage-rock',
  'drum and bass': 'drum-and-bass',
};

const FORMAT_WORDS: Record<string, FormatId> = {
  vinyl: 'vinyl',
  vinyls: 'vinyl',
  lps: 'vinyl',
  cassette: 'cassette',
  cassettes: 'cassette',
  tape: 'cassette',
  tapes: 'cassette',
  cd: 'cd',
  cds: 'cd',
  digital: 'digital',
  download: 'digital',
  downloads: 'digital',
  mp3: 'digital',
  flac: 'digital',
};

const KIND_WORDS: Record<string, SearchKindId> = {
  album: 'album',
  albums: 'album',
  ep: 'ep',
  eps: 'ep',
  single: 'single',
  singles: 'single',
  compilation: 'compilation',
  compilations: 'compilation',
  soundtrack: 'soundtrack',
  soundtracks: 'soundtrack',
};

/** Words that only join filters together, dropped once filters are read. */
const GLUE = new Set([
  'a',
  'an',
  'and',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'with',
  'music',
  'records',
  'releases',
]);

const GENRE_PHRASES = new Map<string, GenreId>([
  ...GENRES.map((genre) => [phrase(genre.name), genre.id] as const),
  ...GENRES.map((genre) => [phrase(genre.id), genre.id] as const),
  ...Object.entries(GENRE_ALIASES),
]);
const LONGEST_GENRE = Math.max(
  ...[...GENRE_PHRASES.keys()].map((key) => key.split(' ').length),
);

function phrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PRICE_PATTERN =
  /\b(?:under|below|less than|cheaper than|up to)\s*[$€]?\s*(\d{1,4})(?:\s*(?:dollars|bucks|euros|usd|eur))?\b/;

/**
 * Read the filters in a one-line search, like "shoegaze on vinyl under $20"
 * or "90s hip hop tapes", by fixed rules over IME's own lists. The words
 * that are not filters are left as the text to search for.
 */
export function parseSearch(text: string): {
  filters: SearchFilters;
  read: ReadFilter[];
} {
  const filters: SearchFilters = { q: '', genres: [] };
  const read: ReadFilter[] = [];
  let rest = ` ${phrase(text)} `;

  const price = PRICE_PATTERN.exec(rest);
  if (price) {
    // "up to $10" includes $10 itself
    const cents = Number(price[1]) * 100;
    filters.under = price[0].startsWith('up to') ? cents + 1 : cents;
    read.push({
      key: 'under',
      value: String(filters.under),
      label: priceLabel(filters.under),
    });
    rest = rest.replace(price[0], ' ');
  }

  const words = rest.split(' ').filter(Boolean);
  const left: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const genre = matchGenre(words, i);
    if (genre) {
      if (!filters.genres.includes(genre.id)) {
        filters.genres.push(genre.id);
        read.push({ key: 'genre', value: genre.id, label: genre.label });
      }
      i += genre.length - 1;
      continue;
    }

    const word = words[i];
    const decade = /^(?:(19|20)?(\d)0)'?s$/.exec(word);
    if (FORMAT_WORDS[word] && !filters.format) {
      filters.format = FORMAT_WORDS[word];
      read.push({
        key: 'format',
        value: filters.format,
        label: FORMATS.find((f) => f.id === filters.format)?.name ?? word,
      });
    } else if (KIND_WORDS[word] && !filters.kind) {
      filters.kind = KIND_WORDS[word];
      read.push({
        key: 'kind',
        value: filters.kind,
        label: SEARCH_KINDS.find((k) => k.id === filters.kind)?.name ?? word,
      });
    } else if (word === 'free' && filters.under === undefined) {
      filters.under = 1;
      read.push({ key: 'under', value: '1', label: priceLabel(1) });
    } else if (word === 'designed' && !filters.designed) {
      filters.designed = true;
      read.push({ key: 'designed', value: '1', label: 'Designed pages' });
    } else if (/^(19|20)\d\d$/.test(word) && !filters.year) {
      filters.year = word;
      read.push({ key: 'year', value: word, label: yearLabel(word) });
    } else if (decade && !filters.year) {
      // "90s" means the 1990s, "10s" the 2010s
      const century = decade[1] ?? (Number(decade[2]) <= 2 ? '20' : '19');
      filters.year = `${century}${decade[2]}0s`;
      read.push({
        key: 'year',
        value: filters.year,
        label: yearLabel(filters.year),
      });
    } else {
      left.push(word);
    }
  }

  // with nothing read, search exactly what was typed
  filters.q = read.length
    ? left.filter((word) => !GLUE.has(word)).join(' ')
    : text.trim();
  return { filters, read };
}

function matchGenre(
  words: string[],
  start: number,
): { id: GenreId; label: string; length: number } | null {
  for (let length = LONGEST_GENRE; length >= 1; length--) {
    const id = GENRE_PHRASES.get(words.slice(start, start + length).join(' '));
    if (id) {
      const label = GENRES.find((genre) => genre.id === id)?.name ?? id;
      return { id, label, length };
    }
  }
  return null;
}
