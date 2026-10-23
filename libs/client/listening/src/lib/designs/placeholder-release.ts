import type {
  ArtistPageAsset,
  ArtistPageRenderPayload,
  DesignSlot,
} from '@ime/models';

export type PlaceholderKind = 'album' | 'ep' | 'single';

export const PLACEHOLDER_KINDS: { id: PlaceholderKind; name: string }[] = [
  { id: 'album', name: 'Album' },
  { id: 'ep', name: 'EP' },
  { id: 'single', name: 'Single' },
];

const TRACK_TITLES = [
  'Weathervane',
  'Low Tide Radio',
  'Glass Orchard',
  'Northbound',
  'Paper Lanterns',
  'Second Story',
  'Afterglow Motel',
  'Salt and Static',
  'Long Way Home',
  'Last Ferry',
];

const SHAPES: Record<
  PlaceholderKind,
  {
    title: string;
    kind: string;
    tracks: number;
    minimum: number;
    suggested: number;
  }
> = {
  album: {
    title: 'Weathervane',
    kind: 'album',
    tracks: 10,
    minimum: 700,
    suggested: 1000,
  },
  ep: {
    title: 'Night Swim',
    kind: 'ep',
    tracks: 5,
    minimum: 400,
    suggested: 600,
  },
  single: {
    title: 'Static Bloom',
    kind: 'single',
    tracks: 2,
    minimum: 100,
    suggested: 200,
  },
};

const LYRICS = `Turned the radio low so the static could sing
every station a coastline, every coastline a ring
we were weathervanes spinning in somebody's yard
pointing home for a minute, then pointing too far`;

const DESCRIPTION = `We made this record over one long winter in a house by the lake, with the heat broken and the tape machine running every night. Most of it is first takes. Some of it is the sound of the room.`;

const CREDITS = `Written and performed by The Lantern Choir
Mara Ellis: voice, guitar
Theo Grant: bass, organ
June Okafor: drums, tape loops
Recorded and mixed by Sam Reyes at Low Ceiling, Chicago
Mastered by Ines Vale
Artwork by Ivy Park`;

const svg = (width: number, height: number, body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><defs><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .18 0"/></filter></defs>${body}<rect width="100%" height="100%" filter="url(#g)"/></svg>`,
  )}`;

/** The stand-in cover: a sun sinking into banded water, with the title. */
export function placeholderCover(title: string): string {
  const bands = Array.from(
    { length: 9 },
    (_, i) =>
      `<rect y="${560 + i * 48}" width="1000" height="${10 + i * 3}" fill="#f3ebdd" opacity="${0.9 - i * 0.07}"/>`,
  ).join('');
  return svg(
    1000,
    1000,
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b35"/><stop offset=".55" stop-color="#c2185b"/><stop offset="1" stop-color="#2b1055"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#sky)"/><circle cx="500" cy="560" r="230" fill="#ffd166"/>${bands}<text x="64" y="128" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="96" letter-spacing="-4" fill="#1a0b2e">${title}</text><text x="68" y="184" font-family="Helvetica, Arial, sans-serif" font-weight="500" font-size="34" fill="#1a0b2e" opacity=".8">The Lantern Choir</text>`,
  );
}

function backCover(): string {
  const rows = TRACK_TITLES.map(
    (title, i) =>
      `<text x="80" y="${260 + i * 54}" font-family="Courier New, monospace" font-size="30" fill="#f3ebdd">${String(i + 1).padStart(2, '0')}  ${title}</text>`,
  ).join('');
  return svg(
    1000,
    1000,
    `<rect width="1000" height="1000" fill="#2b1055"/><rect x="60" y="60" width="880" height="880" fill="none" stroke="#ffd166" stroke-width="3"/><text x="80" y="170" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="64" fill="#ffd166">WEATHERVANE</text>${rows}<text x="80" y="900" font-family="Courier New, monospace" font-size="22" fill="#f3ebdd" opacity=".7">LANTERN 001 // RECORDED AT LOW CEILING, CHICAGO</text>`,
  );
}

/** A photo-like stand-in: soft lights through grain, as on a night shoot. */
function photo(hue: number, seed: number): string {
  const lights = Array.from({ length: 7 }, (_, i) => {
    const x = (seed * 97 + i * 211) % 1200;
    const y = (seed * 53 + i * 137) % 800;
    const r = 80 + ((seed + i * 41) % 180);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${hue + i * 14} 85% 60%)" opacity=".55"/>`;
  }).join('');
  return svg(
    1200,
    800,
    `<defs><filter id="b"><feGaussianBlur stdDeviation="60"/></filter></defs><rect width="1200" height="800" fill="hsl(${hue} 40% 10%)"/><g filter="url(#b)">${lights}</g>`,
  );
}

const ASSETS: ArtistPageAsset[] = [
  {
    kind: 'back_cover',
    title: 'Back cover',
    description: null,
    url: backCover(),
    mimeType: 'image/svg+xml',
  },
  {
    kind: 'photo',
    title: 'The lake house',
    description: 'Where most of it was recorded.',
    url: photo(18, 3),
    mimeType: 'image/svg+xml',
  },
  {
    kind: 'photo',
    title: 'Low Ceiling, 2am',
    description: null,
    url: photo(280, 7),
    mimeType: 'image/svg+xml',
  },
  {
    kind: 'photo',
    title: 'Last show of the winter',
    description: null,
    url: photo(200, 11),
    mimeType: 'image/svg+xml',
  },
];

/** A stand-in for an image slot: soft lights, like a photo. */
export function placeholderImage(seed: number): string {
  return photo((seed * 67) % 360, seed);
}

/**
 * What a design renders in the gallery: a finished-looking stand-in record
 * of the chosen kind, with words, artwork, extras, and editions, its slots
 * filled with sample words and images, and the visitor's own cover when they
 * tried one.
 */
export function placeholderRelease(
  kind: PlaceholderKind,
  slots: DesignSlot[],
  coverUrl: string | null,
): ArtistPageRenderPayload {
  const shape = SHAPES[kind];
  return {
    release: {
      id: '00000000-0000-4000-8000-000000000000',
      title: shape.title,
      artistName: 'The Lantern Choir',
      artist: {
        name: 'The Lantern Choir',
        handle: 'the-lantern-choir',
        city: 'Chicago',
        country: 'US',
        avatarUrl: photo(30, 5),
        headerUrl: photo(320, 9),
      },
      kind: shape.kind,
      releasedAt: '2026-03-14',
      description: DESCRIPTION,
      credits: CREDITS,
      genres: ['Indie rock', 'Dream pop'],
      tags: ['lo-fi', 'winter', 'tape'],
      coverUrl: coverUrl ?? placeholderCover(shape.title),
      tracks: TRACK_TITLES.slice(0, shape.tracks).map((title, i) => ({
        position: i + 1,
        title,
        durationMs: (150 + ((i * 47) % 140)) * 1000,
        lyrics: i % 3 === 0 ? LYRICS : null,
        preview: i < 2,
      })),
      sideStarts: kind === 'album' ? [6] : [],
      assets: kind === 'single' ? ASSETS.slice(0, 2) : ASSETS,
      editions:
        kind === 'single'
          ? []
          : [
              {
                format: 'vinyl',
                name: `${shape.title} on sunset vinyl`,
                price: 2800,
                currency: 'usd',
                inStock: true,
              },
              {
                format: 'cassette',
                name: `${shape.title} cassette`,
                price: 1200,
                currency: 'usd',
                inStock: true,
              },
            ],
      price: {
        mode: 'name_your_price',
        currency: 'usd',
        minimumPrice: shape.minimum,
        suggestedPrice: shape.suggested,
      },
    },
    customization: Object.fromEntries(
      slots.map((slot, i) => [
        slot.name,
        slot.kind === 'image'
          ? placeholderImage(i + 2)
          : sampleText(slot.label),
      ]),
    ),
  };
}

/** Sample words for a text slot, in the voice of the stand-in record. */
function sampleText(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('headline') || lower.includes('title')) {
    return 'Songs for a broken heater';
  }
  if (
    lower.includes('note') ||
    lower.includes('essay') ||
    lower.includes('story')
  ) {
    return DESCRIPTION;
  }
  if (lower.includes('credit')) return CREDITS;
  if (lower.includes('color') || lower.includes('colour')) return '#ff6b35';
  return 'Recorded over one long winter by the lake.';
}

/**
 * A cover the visitor picked, shrunk to a data URL so it can go to the
 * sandboxed preview. It never leaves their device.
 */
export function readCover(file: File, size = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const side = Math.min(image.width, image.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.min(size, side);
      canvas
        .getContext('2d')
        ?.drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not an image.'));
    };
    image.src = url;
  });
}
