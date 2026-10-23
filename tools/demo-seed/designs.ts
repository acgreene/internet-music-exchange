import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import type { DesignSlot } from '../../libs/api/db/src/lib/tables/design-versions';

const require = createRequire(import.meta.url);
const BUNDLES = join(import.meta.dirname, 'design-bundles');

/** A library a design can carry inside its own file. */
type Library = 'gsap' | 'three';

/**
 * A release page design for the marketplace. Its look and behavior live in
 * `design-bundles/<slug>/` as `design.css` and `design.js`, which defines
 * `render(r, c)` and may define `mount(r, c, ime)`. Each version is built
 * into one self-contained HTML file with the shared runtime and any
 * libraries it uses inlined, since a design reaches nothing but its bundle
 * and the release it is sent.
 */
export interface DemoDesignTemplate {
  slug: string;
  name: string;
  description: string;
  /** Ids from IME's list of design styles, most fitting first. */
  styles: string[];
  slots: DesignSlot[];
  /** Other primary and secondary pairs the demo's artists dress it in. */
  palettes: [string, string][];
  libs?: Library[];
  pricing:
    | { mode: 'free' }
    | { mode: 'fixed'; price: number }
    | { mode: 'name_your_price'; minimum: number; suggested: number };
}

const read = (path: string) => readFileSync(path, 'utf8');

/**
 * Every demo design takes the artist's two colors, starting from its own.
 * The labels say what each color does in that design.
 */
const colors = (
  primary: [string, string],
  secondary: [string, string],
): DesignSlot[] => [
  {
    name: 'primary',
    kind: 'color',
    label: `Primary color (${primary[1]})`,
    default: primary[0],
  },
  {
    name: 'secondary',
    kind: 'color',
    label: `Secondary color (${secondary[1]})`,
    default: secondary[0],
  },
];

const libraries = new Map<Library, string>();
function library(name: Library): string {
  const known = libraries.get(name);
  if (known) return known;
  const source =
    name === 'gsap'
      ? [
          read(require.resolve('gsap/dist/gsap.min.js')),
          read(require.resolve('gsap/dist/ScrollTrigger.min.js')),
        ].join('\n')
      : buildSync({
          stdin: {
            contents: "import * as THREE from 'three'; window.THREE = THREE;",
            resolveDir: import.meta.dirname,
          },
          bundle: true,
          minify: true,
          format: 'iife',
          write: false,
        }).outputFiles[0].text;
  libraries.set(name, source);
  return source;
}

/** Keeps inlined code from closing the script element it sits in. */
const inline = (code: string) => code.replace(/<\/script/gi, '<\\/script');

export function bundleHtml(
  template: DemoDesignTemplate,
  version: number,
): string {
  const dir = join(BUNDLES, template.slug);
  const css = read(join(dir, 'design.css'));
  const js = read(join(dir, 'design.js'));
  const defaults = Object.fromEntries(
    template.slots
      .filter((slot) => slot.default)
      .map((slot) => [slot.name, slot.default]),
  );
  const libs = (template.libs ?? [])
    .map((name) => `<script>${inline(library(name))}</script>`)
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${template.name} v${version}</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}img{display:block;max-width:100%}button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}${css}</style></head><body>${libs}<script>const SLOT_DEFAULTS = ${JSON.stringify(defaults)};\n${inline(js)}\n${inline(read(join(BUNDLES, 'runtime.js')))}</script></body></html>`;
}

export const DESIGN_TEMPLATES: DemoDesignTemplate[] = [
  {
    slug: 'gatefold',
    name: 'Gatefold',
    description:
      'The record as an object. Scroll and the sleeve turns toward you, opens like a gatefold, and slides the disc out of its pocket, spinning while a track plays. Liner notes on the inside left, the tracklist on the right, the back cover after.',
    styles: ['3d', 'motion', 'interactive'],
    slots: [
      ...colors(['#e3a72f', 'labels and buttons'], ['#14271f', 'background']),
      { name: 'quote', kind: 'text', label: 'A line for the inside sleeve' },
    ],
    palettes: [
      ['#ff5a1f', '#1a1411'],
      ['#9fd3c7', '#1c1f33'],
      ['#f2c6de', '#2b1a24'],
    ],
    libs: ['gsap'],
    pricing: { mode: 'fixed', price: 2400 },
  },
  {
    slug: 'monolith',
    name: 'Monolith',
    description:
      'A slow, glossy sculpture turning in the dark, breathing harder while the music plays. The cover floats beside it, and the record unfolds below as you scroll.',
    styles: ['3d', 'generative', 'minimal'],
    slots: [
      ...colors(['#2ec4b6', 'the sculpture'], ['#06090c', 'background']),
      { name: 'statement', kind: 'text', label: 'One line about the record' },
    ],
    palettes: [
      ['#7c5cff', '#060609'],
      ['#ff7a59', '#0d0806'],
      ['#e8e8e8', '#0a0a0a'],
    ],
    libs: ['three'],
    pricing: { mode: 'name_your_price', minimum: 1000, suggested: 1800 },
  },
  {
    slug: 'riot',
    name: 'Riot',
    description:
      'Gig poster energy. Black and white photos thrown across the page, giant outlined title banners sliding through them, and the tracklist as ticket stubs. Built for live bands.',
    styles: ['collage', 'typographic', 'retro'],
    slots: [
      ...colors(['#ffd400', 'stamp and stubs'], ['#efece4', 'paper']),
      { name: 'shout', kind: 'text', label: 'Banner word' },
      { name: 'flyer', kind: 'image', label: 'A live photo' },
    ],
    palettes: [
      ['#ff3b1f', '#efece4'],
      ['#3d5afe', '#f4f1ea'],
      ['#00c853', '#ece9df'],
    ],
    libs: ['gsap'],
    pricing: { mode: 'fixed', price: 1800 },
  },
  {
    slug: 'booklet',
    name: 'Booklet',
    description:
      'The liner notes booklet, as a magazine. A long essay with a drop cap, photos with captions, lyrics set like poems, a table of contents that plays, and credits as the colophon.',
    styles: ['editorial', 'typographic', 'minimal'],
    slots: [
      ...colors(['#1f5f4a', 'headings and drop cap'], ['#f3ede2', 'paper']),
      { name: 'pullquote', kind: 'text', label: 'Pull quote' },
      { name: 'issue', kind: 'text', label: 'Issue line' },
    ],
    palettes: [
      ['#9b2226', '#f6f1e7'],
      ['#1d3557', '#f1f4f5'],
      ['#7f4f24', '#f7efe1'],
    ],
    pricing: { mode: 'free' },
  },
  {
    slug: 'signal',
    name: 'Signal',
    description:
      'A living field of lines drawn by a shader, drifting like a slow oscilloscope and quickening while a track plays. The cover turns at its center like a record on a platter.',
    styles: ['generative', 'motion', 'minimal'],
    slots: colors(['#b4ff39', 'top lines'], ['#0091ff', 'bottom lines']),
    palettes: [
      ['#00e5ff', '#6a00ff'],
      ['#ffb000', '#ff3d00'],
      ['#ff4d8d', '#7c4dff'],
    ],
    pricing: { mode: 'name_your_price', minimum: 500, suggested: 1200 },
  },
  {
    slug: 'night-drive',
    name: 'Night Drive',
    description:
      'Neon over a full-bleed photo, layers sliding past at different speeds, film grain, and a strip of photos that scrolls sideways like streetlights. The tracklist is the car radio.',
    styles: ['photographic', 'motion', 'retro'],
    slots: [
      ...colors(['#ff2bd6', 'neon'], ['#2de2ff', 'second neon']),
      { name: 'backdrop', kind: 'image', label: 'Night photo' },
    ],
    palettes: [
      ['#ffe600', '#ff2bd6'],
      ['#7cff00', '#00f0ff'],
      ['#ff6a3d', '#b14dff'],
    ],
    libs: ['gsap'],
    pricing: { mode: 'fixed', price: 2000 },
  },
  {
    slug: 'concrete',
    name: 'Concrete',
    description:
      'Raw and loud. Thick rules, a brutal grid, monospace everything, a halftone cover cropped hard, and the cover chasing your cursor down the tracklist.',
    styles: ['brutalist', 'typographic', 'interactive'],
    slots: [
      ...colors(['#ff5a00', 'highlight'], ['#e4e3de', 'background']),
      { name: 'manifesto', kind: 'text', label: 'Manifesto' },
    ],
    palettes: [
      ['#d4ff00', '#e4e3de'],
      ['#00e0ff', '#f2f2f2'],
      ['#ff2e63', '#e9e4da'],
    ],
    pricing: { mode: 'free' },
  },
  {
    slug: 'scrapbook',
    name: 'Scrapbook',
    description:
      'Everything that came with the record, taped to kraft paper: polaroids, the back cover, a ticket, a notebook page of songs. Pick anything up and move it around.',
    styles: ['collage', 'interactive', 'illustrated'],
    slots: [
      ...colors(['#1b3a8c', 'pen'], ['#c39a6b', 'board']),
      { name: 'note', kind: 'text', label: 'A handwritten note' },
      { name: 'snapshot', kind: 'image', label: 'A snapshot' },
    ],
    palettes: [
      ['#2d6a4f', '#b9a07e'],
      ['#6a1b9a', '#d1b38a'],
      ['#111111', '#9c8466'],
    ],
    pricing: { mode: 'name_your_price', minimum: 0, suggested: 800 },
  },
  {
    slug: 'grid',
    name: 'Grid',
    description:
      'Swiss poster discipline. Huge numerals, a strict grid, one red, and every track its own full screen with its lyrics, snapping into place as you scroll.',
    styles: ['typographic', 'minimal', 'editorial'],
    slots: colors(['#e10600', 'numbers'], ['#f3f2ee', 'paper']),
    palettes: [
      ['#0047ab', '#f3f2ee'],
      ['#ff6f00', '#f4efe6'],
      ['#00897b', '#f6f5f0'],
    ],
    pricing: { mode: 'fixed', price: 1200 },
  },
  {
    slug: 'orbit',
    name: 'Orbit',
    description:
      'Indigo on black. Mixed-weight statement type, photos hung at angles in 3D that swing as you scroll, a numbered tracklist, a wireframe globe turning over where the artist is based.',
    styles: ['3d', 'motion', 'typographic'],
    slots: [
      ...colors(['#6366f1', 'signature'], ['#050507', 'background']),
      { name: 'statement', kind: 'text', label: 'Statement' },
    ],
    palettes: [
      ['#f43f5e', '#07050a'],
      ['#facc15', '#0a0a0a'],
      ['#34d399', '#04110c'],
    ],
    libs: ['three'],
    pricing: { mode: 'name_your_price', minimum: 800, suggested: 1500 },
  },
];

/** Sample words for each text slot, picked for the demo's releases. */
export const SLOT_TEXT: Record<string, string[]> = {
  quote: [
    'Play it loud, then play it again.',
    'For everyone who stayed until the lights came up.',
    'Made in one room, over one winter.',
  ],
  statement: [
    'A record about leaving home and finding out you brought it with you.',
    'Songs written on night shifts and recorded on days off.',
    'Everything we had, pressed into forty minutes.',
  ],
  shout: ['LOUD', 'LIVE', 'RIOT', 'ENCORE'],
  pullquote: [
    'We kept every mistake that sounded like the truth.',
    'It took three years. It was worth it.',
    'Half of it was recorded with the window open.',
  ],
  issue: ['No. 1', 'Spring issue', 'Vol. 2'],
  manifesto: [
    'NO FILLER. NO ALGORITHM. NO APOLOGIES.',
    'MADE BY HAND. PLAYED TOO LOUD.',
    'EVERY SONG IS A FIRST TAKE.',
  ],
  note: [
    'thank you for listening. really.',
    'track 3 is the one. trust me.',
    'recorded in the kitchen, mostly at 2am',
  ],
};
