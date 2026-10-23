import type { DesignSlot } from '../../libs/api/db/src/lib/tables/design-versions';

/**
 * Release page designs for the marketplace. Each is one self-contained HTML
 * file that speaks the artist page protocol: it says it is ready, renders the
 * payload it is sent, reports its height, and asks the host to play or sell.
 */
export interface DemoDesignTemplate {
  name: string;
  description: string;
  slots: DesignSlot[];
  /** The page's styles. */
  css: string;
  /** Builds the page's markup from the payload, in the browser. */
  render: string;
}

const PROTOCOL = `
const send = (message) => parent.postMessage(message, '*');
const esc = (text) => String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const time = (ms) => ms ? Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') : '';
const price = (p) => p.mode === 'free' ? 'Free' : (p.mode === 'fixed' ? '' : 'Name your price, from ') + new Intl.NumberFormat('en', { style: 'currency', currency: p.currency || 'usd' }).format((p.minimumPrice || 0) / 100);
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'artist-page:init') return;
  const { release, customization } = event.data.payload;
  document.body.innerHTML = render(release, customization || {});
  document.querySelectorAll('[data-play]').forEach((el) => el.addEventListener('click', () => send({ type: 'artist-page:play', trackPosition: Number(el.dataset.play) })));
  document.querySelectorAll('[data-buy]').forEach((el) => el.addEventListener('click', () => send({ type: 'artist-page:purchase' })));
  const report = () => send({ type: 'artist-page:resize', height: document.documentElement.scrollHeight });
  new ResizeObserver(report).observe(document.body);
  document.querySelectorAll('img').forEach((img) => img.addEventListener('load', report));
  report();
});
send({ type: 'artist-page:ready' });
`;

export function bundleHtml(
  template: DemoDesignTemplate,
  version: number,
): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${template.name} v${version}</title><style>*{box-sizing:border-box}body{margin:0}${template.css}</style></head><body><script>const render = ${template.render};${PROTOCOL}</script></body></html>`;
}

export const DESIGN_TEMPLATES: DemoDesignTemplate[] = [
  {
    name: 'Liner Notes',
    description:
      'A quiet, bookish page: the cover beside a long-form essay, with a numbered tracklist set like the back of a sleeve.',
    slots: [
      { name: 'essay', kind: 'text', label: 'Liner notes' },
      { name: 'credits', kind: 'text', label: 'Credits' },
    ],
    css: `body{font:17px/1.6 Georgia,serif;background:#f6f1e7;color:#2b2420;padding:48px}main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:48px;max-width:1000px;margin:auto}img{width:100%;box-shadow:0 20px 40px #0003}h1{font-size:44px;line-height:1;margin:0 0 4px}ol{padding-left:20px}li{padding:6px 0;border-bottom:1px solid #d8cdb8;cursor:pointer}li:hover{color:#9b2c2c}button{font:inherit;background:#2b2420;color:#f6f1e7;border:0;padding:10px 18px;cursor:pointer}.essay{white-space:pre-line;font-style:italic}small{color:#7a6d5f}@media(max-width:700px){main{grid-template-columns:1fr}}`,
    render: `(r, c) => \`<main><div><img src="\${esc(r.coverUrl)}" alt=""><p class="essay">\${esc(c.essay || 'Recorded over a handful of weekends, mostly at night.')}</p><small>\${esc(c.credits || '')}</small></div><div><h1>\${esc(r.title)}</h1><p>by \${esc(r.artistName)}</p><ol>\${r.tracks.map((t) => \`<li data-play="\${t.position}">\${esc(t.title)} <small>\${time(t.durationMs)}</small></li>\`).join('')}</ol><p>\${price(r.price)}</p><button data-buy>Get the record</button></div></main>\``,
  },
  {
    name: 'Billboard',
    description:
      'Huge type, loud color, the cover tilted on a poster. Built for singles and anything meant to be played loud.',
    slots: [
      { name: 'headline', kind: 'text', label: 'Big headline' },
      { name: 'color', kind: 'text', label: 'Accent color (CSS)' },
    ],
    css: `body{font:600 16px/1.4 Helvetica,Arial,sans-serif;background:#111;color:#fff;overflow-x:hidden}.hero{padding:40px;min-height:520px;position:relative}h1{font-size:clamp(56px,12vw,150px);line-height:.85;letter-spacing:-.06em;margin:0;text-transform:uppercase}img{position:absolute;right:40px;top:60px;width:min(40%,360px);transform:rotate(6deg);border:8px solid #fff}.tracks{padding:0 40px 40px;display:flex;flex-wrap:wrap;gap:8px}.tracks span{border:2px solid #fff;padding:8px 14px;cursor:pointer}.tracks span:hover{background:#fff;color:#111}button{font:inherit;font-size:20px;border:0;padding:16px 28px;margin:0 40px 40px;cursor:pointer}`,
    render: `(r, c) => { const accent = /^[#a-z0-9(),. %]+$/i.test(c.color || '') ? c.color : '#ff3c00'; return \`<section class="hero" style="background:\${accent}"><h1>\${esc(c.headline || r.title)}</h1><p>\${esc(r.artistName)}</p><img src="\${esc(r.coverUrl)}" alt=""></section><div class="tracks">\${r.tracks.map((t) => \`<span data-play="\${t.position}">\${t.position}. \${esc(t.title)}</span>\`).join('')}</div><button data-buy style="background:\${accent};color:#fff">Buy, \${price(r.price)}</button>\`; }`,
  },
  {
    name: 'Blueprint',
    description:
      'Technical drawing aesthetic: grid paper, measurement lines, and the tracklist as a parts list. A backdrop image slot sits behind the cover.',
    slots: [
      { name: 'backdrop', kind: 'image', label: 'Backdrop image' },
      { name: 'catalog', kind: 'text', label: 'Catalog number' },
    ],
    css: `body{font:14px/1.5 ui-monospace,Menlo,monospace;color:#e8f1ff;background:#123a7a;background-image:linear-gradient(#ffffff14 1px,transparent 1px),linear-gradient(90deg,#ffffff14 1px,transparent 1px);background-size:24px 24px;padding:40px}.sheet{max-width:960px;margin:auto;border:2px solid #e8f1ff;padding:28px;position:relative}.art{position:relative;aspect-ratio:16/7;overflow:hidden;border:1px dashed #e8f1ffaa}.art .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}.art .cover{position:relative;height:90%;margin:2.5%;border:2px solid #e8f1ff}h1{font-size:30px;margin:20px 0 0;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-top:16px}td{border-top:1px solid #e8f1ff55;padding:8px 4px;cursor:pointer}tr:hover td{background:#ffffff14}button{font:inherit;color:#123a7a;background:#e8f1ff;border:0;padding:10px 16px;margin-top:20px;cursor:pointer}`,
    render: `(r, c) => \`<div class="sheet"><div class="art">\${c.backdrop ? \`<img class="bg" src="\${esc(c.backdrop)}" alt="">\` : ''}<img class="cover" src="\${esc(r.coverUrl)}" alt=""></div><h1>\${esc(r.title)}</h1><p>\${esc(r.artistName)} // \${esc(c.catalog || 'CAT-001')}</p><table>\${r.tracks.map((t) => \`<tr data-play="\${t.position}"><td>\${String(t.position).padStart(2, '0')}</td><td>\${esc(t.title)}</td><td style="text-align:right">\${time(t.durationMs)}</td></tr>\`).join('')}</table><button data-buy>[ \${price(r.price)} ]</button></div>\``,
  },
  {
    name: 'Soft Focus',
    description:
      'Blurred cover as an ambient backdrop with frosted glass panels. Gentle and minimal, made for ambient and dream pop.',
    slots: [{ name: 'tagline', kind: 'text', label: 'Tagline' }],
    css: `body{font:16px/1.5 -apple-system,Helvetica,sans-serif;color:#fff;min-height:100vh;position:relative;padding:48px}.blur{position:fixed;inset:-40px;background-size:cover;background-position:center;filter:blur(40px) brightness(.7);z-index:-1}.panel{max-width:720px;margin:auto;background:#ffffff22;backdrop-filter:blur(14px);border:1px solid #ffffff44;border-radius:24px;padding:32px;display:grid;grid-template-columns:200px 1fr;gap:28px}img{width:100%;border-radius:12px}h1{font-weight:300;font-size:38px;margin:0}ul{list-style:none;padding:0}li{padding:8px 12px;border-radius:10px;cursor:pointer}li:hover{background:#ffffff22}button{font:inherit;color:#111;background:#fff;border:0;border-radius:999px;padding:10px 20px;cursor:pointer}@media(max-width:640px){.panel{grid-template-columns:1fr}}`,
    render: `(r, c) => \`<div class="blur" style="background-image:url('\${esc(r.coverUrl)}')"></div><div class="panel"><img src="\${esc(r.coverUrl)}" alt=""><div><h1>\${esc(r.title)}</h1><p>\${esc(c.tagline || r.artistName)}</p><ul>\${r.tracks.map((t) => \`<li data-play="\${t.position}">\${esc(t.title)}</li>\`).join('')}</ul><button data-buy>\${price(r.price)}</button></div></div>\``,
  },
];

/** Slot text an artist might fill a design with. */
export const SLOT_TEXT: Record<string, string[]> = {
  essay: [
    'We made this record in the winter, in a cabin with no heat and one good microphone. Every song was a single take, mistakes and all.',
    'These songs were written on night shifts and recorded on days off. It took three years. It was worth it.',
    'A record about leaving home and finding out you brought it with you.',
  ],
  credits: [
    'Recorded and mixed at home. Mastered by a friend. Cover photo by our drummer.',
    'All songs written and performed by the band. Strings on track 4 by the neighbors.',
  ],
  headline: ['OUT NOW', 'LOUDER', 'NEW SINGLE', 'TURN IT UP'],
  color: ['#ff3c00', '#1d4ed8', '#e63946', '#06d6a0', '#7678ed'],
  catalog: ['IME-001', 'HM-07', 'CS-112', 'LP-2026-04'],
  tagline: [
    'music for slow mornings',
    'headphones recommended',
    'for the drive home',
  ],
};
