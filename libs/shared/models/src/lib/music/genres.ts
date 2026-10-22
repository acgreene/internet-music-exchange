/**
 * IME's list of genres. A release picks up to three; listeners browse,
 * search, and dig by them. Ids are stored on releases, so renaming a genre
 * means changing its name here, never its id.
 */
export const GENRES = [
  { id: 'acoustic', name: 'Acoustic' },
  { id: 'afrobeat', name: 'Afrobeat' },
  { id: 'alternative', name: 'Alternative' },
  { id: 'ambient', name: 'Ambient' },
  { id: 'americana', name: 'Americana' },
  { id: 'bluegrass', name: 'Bluegrass' },
  { id: 'blues', name: 'Blues' },
  { id: 'bossa-nova', name: 'Bossa nova' },
  { id: 'breakbeat', name: 'Breakbeat' },
  { id: 'chiptune', name: 'Chiptune' },
  { id: 'classical', name: 'Classical' },
  { id: 'country', name: 'Country' },
  { id: 'dance', name: 'Dance' },
  { id: 'disco', name: 'Disco' },
  { id: 'dream-pop', name: 'Dream pop' },
  { id: 'drone', name: 'Drone' },
  { id: 'drum-and-bass', name: 'Drum and bass' },
  { id: 'dub', name: 'Dub' },
  { id: 'dubstep', name: 'Dubstep' },
  { id: 'electronic', name: 'Electronic' },
  { id: 'emo', name: 'Emo' },
  { id: 'experimental', name: 'Experimental' },
  { id: 'folk', name: 'Folk' },
  { id: 'funk', name: 'Funk' },
  { id: 'garage-rock', name: 'Garage rock' },
  { id: 'gospel', name: 'Gospel' },
  { id: 'grime', name: 'Grime' },
  { id: 'hardcore', name: 'Hardcore' },
  { id: 'hip-hop', name: 'Hip-hop' },
  { id: 'house', name: 'House' },
  { id: 'indie-pop', name: 'Indie pop' },
  { id: 'indie-rock', name: 'Indie rock' },
  { id: 'industrial', name: 'Industrial' },
  { id: 'jazz', name: 'Jazz' },
  { id: 'jungle', name: 'Jungle' },
  { id: 'latin', name: 'Latin' },
  { id: 'lo-fi', name: 'Lo-fi' },
  { id: 'math-rock', name: 'Math rock' },
  { id: 'metal', name: 'Metal' },
  { id: 'new-age', name: 'New age' },
  { id: 'noise', name: 'Noise' },
  { id: 'pop', name: 'Pop' },
  { id: 'post-punk', name: 'Post-punk' },
  { id: 'post-rock', name: 'Post-rock' },
  { id: 'psychedelic', name: 'Psychedelic' },
  { id: 'punk', name: 'Punk' },
  { id: 'r-and-b', name: 'R&B' },
  { id: 'reggae', name: 'Reggae' },
  { id: 'rock', name: 'Rock' },
  { id: 'shoegaze', name: 'Shoegaze' },
  { id: 'singer-songwriter', name: 'Singer-songwriter' },
  { id: 'ska', name: 'Ska' },
  { id: 'soul', name: 'Soul' },
  { id: 'soundtrack', name: 'Soundtrack' },
  { id: 'spoken-word', name: 'Spoken word' },
  { id: 'synth-pop', name: 'Synth-pop' },
  { id: 'synthwave', name: 'Synthwave' },
  { id: 'techno', name: 'Techno' },
  { id: 'trance', name: 'Trance' },
  { id: 'trip-hop', name: 'Trip-hop' },
  { id: 'vaporwave', name: 'Vaporwave' },
  { id: 'world', name: 'World' },
] as const;

/** A release names at most this many genres. */
export const MAX_GENRES = 3;

export type GenreId = (typeof GENRES)[number]['id'];

export const GENRE_IDS = GENRES.map((genre) => genre.id) as [
  GenreId,
  ...GenreId[],
];

const NAMES = new Map<string, string>(
  GENRES.map((genre) => [genre.id, genre.name]),
);

/** A genre's display name, or the id itself for one no longer on the list. */
export function genreName(id: string): string {
  return NAMES.get(id) ?? id;
}

export function isGenreId(id: string): id is GenreId {
  return NAMES.has(id);
}
