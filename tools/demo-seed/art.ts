import type { Random } from './random';

/** Background, then accents, chosen to sit well together. */
const PALETTES = [
  ['#f4efe6', '#1d4ed8', '#fff27a', '#0e0e10'],
  ['#0e0e10', '#ff5d8f', '#ffd166', '#06d6a0'],
  ['#fdf6ec', '#e76f51', '#2a9d8f', '#264653'],
  ['#1b1f3b', '#f4a259', '#5b8e7d', '#f4e285'],
  ['#e8f1f2', '#13293d', '#006494', '#247ba0'],
  ['#2b2d42', '#ef233c', '#edf2f4', '#8d99ae'],
  ['#fefae0', '#bc6c25', '#606c38', '#283618'],
  ['#ffcad4', '#3d348b', '#f7b801', '#7678ed'],
  ['#14213d', '#fca311', '#e5e5e5', '#ffffff'],
  ['#d8e2dc', '#ffcad4', '#f4acb7', '#9d8189'],
  ['#000000', '#e0e0e0', '#ff3c00', '#5c5c5c'],
  ['#caf0f8', '#03045e', '#00b4d8', '#90e0ef'],
  ['#f1faee', '#e63946', '#457b9d', '#1d3557'],
  ['#ffe8d6', '#6b705c', '#cb997e', '#3f4238'],
] as const;

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const svg = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`;

/** A square album cover in one of several styles, with its title. */
export function coverArt(
  random: Random,
  title: string,
  artist: string,
): string {
  const [bg, a, b, c] = random.pick(PALETTES);
  const style = random.int(0, 5);
  let art = `<rect width="1000" height="1000" fill="${bg}"/>`;

  if (style === 0) {
    // stacked stripes
    const count = random.int(5, 14);
    for (let i = 0; i < count; i++) {
      const y = (1000 / count) * i;
      art += `<rect y="${y}" width="1000" height="${1000 / count / random.int(1, 3)}" fill="${random.pick([a, b, c])}"/>`;
    }
  } else if (style === 1) {
    // circle grid
    const n = random.int(3, 6);
    const step = 1000 / n;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const r = step * (0.15 + random.next() * 0.3);
        art += `<circle cx="${step * x + step / 2}" cy="${step * y + step / 2}" r="${r}" fill="${random.pick([a, b, c])}"/>`;
      }
    }
  } else if (style === 2) {
    // a sun setting over a sea
    art += `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
    art += `<rect width="1000" height="1000" fill="url(#g)"/>`;
    art += `<circle cx="${random.int(300, 700)}" cy="${random.int(420, 600)}" r="${random.int(150, 260)}" fill="${c}"/>`;
    for (let i = 0; i < 6; i++) {
      art += `<rect y="${640 + i * 60}" width="1000" height="${12 + i * 4}" fill="${bg}" opacity="0.85"/>`;
    }
  } else if (style === 3) {
    // concentric rings
    const cx = random.int(250, 750);
    const cy = random.int(250, 750);
    for (let r = 900; r > 20; r -= random.int(40, 110)) {
      art += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${random.pick([a, b, c, bg])}"/>`;
    }
  } else if (style === 4) {
    // scattered blocks
    for (let i = 0; i < random.int(8, 18); i++) {
      art += `<rect x="${random.int(-100, 900)}" y="${random.int(-100, 900)}" width="${random.int(80, 450)}" height="${random.int(80, 450)}" fill="${random.pick([a, b, c])}" opacity="${(0.6 + random.next() * 0.4).toFixed(2)}" transform="rotate(${random.int(-20, 20)} 500 500)"/>`;
    }
  } else {
    // halftone dots fading across
    const spacing = random.int(28, 55);
    for (let x = spacing / 2; x < 1000; x += spacing) {
      for (let y = spacing / 2; y < 1000; y += spacing) {
        const r = (spacing / 2) * (x / 1000) * (0.4 + 0.6 * (y / 1000));
        art += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${a}"/>`;
      }
    }
    art += `<rect x="80" y="80" width="${random.int(200, 400)}" height="${random.int(200, 400)}" fill="${b}"/>`;
  }

  if (random.chance(0.75)) {
    const dark = [
      '#000000',
      '#0e0e10',
      '#14213d',
      '#1b1f3b',
      '#2b2d42',
    ].includes(bg);
    const ink = dark ? '#ffffff' : '#0e0e10';
    const size = title.length > 18 ? 64 : 92;
    const top = random.chance(0.5);
    art += `<text x="60" y="${top ? 150 : 900}" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="${size}" letter-spacing="-3" fill="${ink}">${escape(title)}</text>`;
    art += `<text x="64" y="${top ? 210 : 950}" font-family="Helvetica, Arial, sans-serif" font-weight="500" font-size="34" fill="${ink}" opacity="0.8">${escape(artist)}</text>`;
  }
  return svg(1000, 1000, art);
}

/** A square portrait stand-in: initials on shapes. */
export function avatarArt(random: Random, name: string): string {
  const [bg, a, b] = random.pick(PALETTES);
  const initials = name
    .split(/\s+/)
    .filter((part) => /[a-z0-9]/i.test(part[0] ?? ''))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  const art =
    `<rect width="400" height="400" fill="${a}"/>` +
    `<circle cx="${random.int(80, 320)}" cy="${random.int(80, 320)}" r="${random.int(120, 220)}" fill="${b}" opacity="0.9"/>` +
    `<rect x="${random.int(0, 200)}" y="${random.int(200, 320)}" width="400" height="200" fill="${bg}" opacity="0.5"/>` +
    `<text x="200" y="250" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="150" letter-spacing="-6" fill="#ffffff" opacity="0.95">${escape(initials || '♪')}</text>`;
  return svg(400, 400, art);
}

/** A wide banner for the top of an artist's page. */
export function headerArt(random: Random): string {
  const [bg, a, b, c] = random.pick(PALETTES);
  let art = `<rect width="1600" height="500" fill="${bg}"/>`;
  let x = 0;
  while (x < 1600) {
    const width = random.int(40, 260);
    art += `<rect x="${x}" y="${random.int(0, 250)}" width="${width}" height="${random.int(150, 500)}" fill="${random.pick([a, b, c])}" opacity="${(0.5 + random.next() * 0.5).toFixed(2)}"/>`;
    x += width + random.int(0, 40);
  }
  return svg(1600, 500, art);
}

/** A product photo stand-in for a kind of merch, on a soft backdrop. */
export function merchArt(
  random: Random,
  type: string,
  label: string,
  color: string,
): string {
  const backdrop = random.pick([
    '#f1f1ee',
    '#ece7df',
    '#e4ebf0',
    '#efe9f3',
    '#f6efe4',
  ]);
  let art = `<rect width="800" height="800" fill="${backdrop}"/><ellipse cx="400" cy="700" rx="260" ry="28" fill="#000" opacity="0.08"/>`;
  const [, a, b] = random.pick(PALETTES);

  if (type === 'vinyl') {
    art += `<rect x="130" y="130" width="440" height="440" fill="${a}"/><rect x="150" y="150" width="400" height="400" fill="${b}"/>`;
    art += `<circle cx="520" cy="400" r="250" fill="#111"/>`;
    for (let r = 240; r > 120; r -= 14)
      art += `<circle cx="520" cy="400" r="${r}" fill="none" stroke="#222" stroke-width="2"/>`;
    art += `<circle cx="520" cy="400" r="90" fill="${color}"/><circle cx="520" cy="400" r="8" fill="${backdrop}"/>`;
  } else if (type === 'cassette') {
    art += `<rect x="150" y="250" width="500" height="320" rx="24" fill="${color}"/><rect x="190" y="290" width="420" height="140" rx="10" fill="#fff" opacity="0.9"/>`;
    art += `<circle cx="300" cy="460" r="46" fill="#222"/><circle cx="500" cy="460" r="46" fill="#222"/><rect x="250" y="510" width="300" height="40" fill="#000" opacity="0.2"/>`;
  } else if (type === 'cd') {
    art += `<defs><radialGradient id="cd"><stop offset="0.1" stop-color="#fff"/><stop offset="0.5" stop-color="${a}"/><stop offset="0.8" stop-color="${b}"/><stop offset="1" stop-color="#ddd"/></radialGradient></defs>`;
    art += `<circle cx="400" cy="380" r="260" fill="url(#cd)"/><circle cx="400" cy="380" r="40" fill="${backdrop}"/>`;
  } else if (type === 'hat' || type === 'beanie') {
    art +=
      type === 'hat'
        ? `<path d="M200 470 Q200 250 400 250 Q600 250 600 470 Z" fill="${color}"/><path d="M380 470 L700 500 Q690 540 380 520 Z" fill="${color}" opacity="0.85"/>`
        : `<path d="M220 520 Q220 230 400 230 Q580 230 580 520 Z" fill="${color}"/><rect x="200" y="470" width="400" height="90" rx="12" fill="${color}" opacity="0.8"/><circle cx="400" cy="220" r="40" fill="${color}"/>`;
  } else {
    // shirts, hoodies, and anything else worn
    const hood = type === 'hoodie' || type === 'sweatshirt';
    art += `<path d="M260 180 L340 150 Q400 200 460 150 L540 180 L660 300 L590 360 L560 330 L560 660 L240 660 L240 330 L210 360 L140 300 Z" fill="${color}"/>`;
    if (hood)
      art += `<path d="M330 160 Q400 260 470 160 Q440 120 400 120 Q360 120 330 160 Z" fill="#000" opacity="0.15"/>`;
    art += `<rect x="320" y="290" width="160" height="160" fill="${a}"/><rect x="345" y="315" width="110" height="110" fill="${b}"/>`;
  }
  art += `<text x="40" y="70" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="30" fill="#0e0e10" opacity="0.55">${escape(label)}</text>`;
  return svg(800, 800, art);
}

/** A photo-like image an artist puts in a design's slot. */
export function slotArt(random: Random): string {
  return headerArt(random);
}

/** Colors a garment or a record label might come in. */
export const MERCH_COLORS = [
  '#0e0e10',
  '#f5f5f0',
  '#1d4ed8',
  '#c42a1c',
  '#2a9d8f',
  '#e9c46a',
  '#6b705c',
  '#7678ed',
  '#f4a259',
];
