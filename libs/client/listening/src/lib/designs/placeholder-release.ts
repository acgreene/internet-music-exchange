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
  'Track one',
  'Track two',
  'Track three',
  'Track four',
  'Track five',
  'Track six',
  'Track seven',
  'Track eight',
  'Track nine',
  'Track ten',
];

const SHAPES: Record<
  PlaceholderKind,
  { kind: string; tracks: number; minimum: number; suggested: number }
> = {
  album: { kind: 'album', tracks: 10, minimum: 700, suggested: 1000 },
  ep: { kind: 'ep', tracks: 5, minimum: 400, suggested: 600 },
  single: { kind: 'single', tracks: 2, minimum: 100, suggested: 200 },
};

const TITLE = 'Release title';
const ARTIST = 'Artist name';

const LYRICS = `Lyrics go here, line by line,
just the way the artist writes them.
A blank line starts a new verse.

Songs without lyrics leave them out.`;

const DESCRIPTION = `The artist's notes about the record go here: how it was made, who made it, and what it means to them. A paragraph or two reads well in most designs.`;

const CREDITS = `Written and performed by ${ARTIST}
Player name: instrument
Player name: instrument
Recorded and mixed by Name at Studio
Artwork by Name`;

const svg = (width: number, height: number, body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`,
  )}`;

/**
 * A frame that says what belongs in it: a quiet hatched field with a
 * dashed border and a label, so no one mistakes it for real artwork.
 */
function frame(
  width: number,
  height: number,
  label: string,
  note: string,
): string {
  const font = 'Helvetica, Arial, sans-serif';
  const size = Math.round(Math.min(width, height) * 0.06);
  return svg(
    width,
    height,
    `<defs><pattern id="h" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="28" height="28" fill="#d9d9d6"/><rect width="2" height="28" fill="#c9c9c5"/></pattern></defs><rect width="${width}" height="${height}" fill="url(#h)"/><rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#8d8d88" stroke-width="3" stroke-dasharray="14 10"/><text x="50%" y="50%" text-anchor="middle" font-family="${font}" font-weight="700" font-size="${size}" fill="#5c5c58">${label}</text><text x="50%" y="${height / 2 + size * 1.3}" text-anchor="middle" font-family="${font}" font-size="${Math.round(size * 0.5)}" fill="#7a7a75">${note}</text>`,
  );
}

/** The stand-in cover, marked as the place a cover goes. */
export function placeholderCover(): string {
  return frame(1000, 1000, 'Cover art goes here', 'Square, at least 1400 px');
}

const ASSETS: ArtistPageAsset[] = [
  {
    kind: 'back_cover',
    title: 'Back cover',
    description: null,
    url: frame(1000, 1000, 'Back cover goes here', 'Optional'),
    mimeType: 'image/svg+xml',
  },
  ...[1, 2, 3].map((n) => ({
    kind: 'photo' as const,
    title: `Photo ${n}`,
    description: n === 1 ? 'A caption for the photo goes here.' : null,
    url: frame(1200, 800, 'Photo goes here', 'Optional'),
    mimeType: 'image/svg+xml',
  })),
];

/** A stand-in for an image slot, labelled with what the slot is for. */
export function placeholderImage(label: string): string {
  return frame(1200, 800, `${label} goes here`, 'Image');
}

/**
 * What a design renders in the gallery: a stand-in record of the chosen
 * kind whose every part says what goes there, so a design reads as a
 * template rather than someone else's release. Text slots show their label,
 * image slots a labelled frame, and color slots the design's own colors. The
 * visitor's own cover replaces the stand-in when they tried one.
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
      title: TITLE,
      artistName: ARTIST,
      artist: {
        name: ARTIST,
        handle: 'artist-name',
        city: null,
        country: null,
        avatarUrl: frame(600, 600, 'Artist photo', 'Optional'),
        headerUrl: frame(1600, 500, 'Header image goes here', 'Optional'),
      },
      kind: shape.kind,
      releasedAt: '2026-03-14',
      description: DESCRIPTION,
      credits: CREDITS,
      genres: ['Genre'],
      tags: [],
      coverUrl: coverUrl ?? placeholderCover(),
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
                name: 'Vinyl edition',
                price: 2800,
                currency: 'usd',
                inStock: true,
              },
              {
                format: 'cassette',
                name: 'Cassette edition',
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
      slots
        .filter((slot) => slot.kind !== 'color')
        .map((slot) => [
          slot.name,
          slot.kind === 'image' ? placeholderImage(slot.label) : slot.label,
        ]),
    ),
  };
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
