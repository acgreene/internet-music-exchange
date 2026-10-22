import type { ArtistPageRenderPayload, DesignSlot } from '@ime/models';

export type PlaceholderKind = 'album' | 'ep' | 'single';

export const PLACEHOLDER_KINDS: { id: PlaceholderKind; name: string }[] = [
  { id: 'album', name: 'Album' },
  { id: 'ep', name: 'EP' },
  { id: 'single', name: 'Single' },
];

const TRACK_TITLES = [
  'Opening Theme',
  'Northern Line',
  'Slow Return',
  'Glasshouse',
  'Second Wind',
  'Paper Boats',
  'Afterimage',
  'Low Light',
  'Homeward',
  'Closing Time',
];

const SHAPES: Record<
  PlaceholderKind,
  { title: string; tracks: number; minimum: number; suggested: number }
> = {
  album: { title: 'Album Title', tracks: 10, minimum: 700, suggested: 1000 },
  ep: { title: 'EP Title', tracks: 5, minimum: 400, suggested: 600 },
  single: { title: 'Single Title', tracks: 2, minimum: 100, suggested: 200 },
};

/** A stand-in square image: rings on cobalt with a label, as an SVG. */
export function placeholderImage(label: string): string {
  const rings = [440, 360, 280, 200, 120]
    .map(
      (r, i) =>
        `<circle cx="500" cy="500" r="${r}" fill="none" stroke="${i % 2 ? '#fff27a' : '#f9f9f7'}" stroke-width="${i % 2 ? 6 : 2}" opacity="${0.35 + i * 0.12}"/>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="#1d4ed8"/>${rings}<text x="500" y="515" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="6" fill="#f9f9f7">${label.toUpperCase()}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * What a design renders in the gallery: a stand-in release of the chosen
 * kind, its slots filled with sample words and images, and the visitor's own
 * cover when they tried one.
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
      artistName: 'Artist Name',
      coverUrl: coverUrl ?? placeholderImage('Your cover'),
      tracks: TRACK_TITLES.slice(0, shape.tracks).map((title, i) => ({
        position: i + 1,
        title,
        durationMs: (150 + ((i * 47) % 140)) * 1000,
      })),
      price: {
        mode: 'name_your_price',
        currency: 'usd',
        minimumPrice: shape.minimum,
        suggestedPrice: shape.suggested,
      },
    },
    customization: Object.fromEntries(
      slots.map((slot) => [
        slot.name,
        slot.kind === 'image'
          ? placeholderImage(slot.label)
          : `Your ${slot.label.toLowerCase()} here`,
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
