/*
 * The small kit every demo design is built on. It speaks the artist page
 * protocol: says it is ready, renders the release IME sends, wires
 * `data-play` and `data-buy`, and tells the page what is playing.
 *
 * A design defines `render(r, c)`, returning the page's markup, and may
 * define `mount(r, c, ime)` to start its motion once the markup is in.
 */
const ime = (() => {
  const send = (message) => parent.postMessage(message, '*');
  const listeners = [];
  let playback = { trackPosition: null, playing: false };
  return {
    play: (trackPosition) => send({ type: 'artist-page:play', trackPosition }),
    pause: () => send({ type: 'artist-page:pause' }),
    buy: () => send({ type: 'artist-page:purchase' }),
    /** Play a track, or pause it when it is the one playing. */
    toggle(trackPosition) {
      if (playback.playing && playback.trackPosition === trackPosition) {
        this.pause();
      } else {
        this.play(trackPosition);
      }
    },
    onPlayback(listener) {
      listeners.push(listener);
      listener(playback);
    },
    get playback() {
      return playback;
    },
    _set(next) {
      playback = next;
      document.documentElement.dataset.playing = next.playing
        ? String(next.trackPosition)
        : '';
      document.querySelectorAll('[data-play]').forEach((el) => {
        el.classList.toggle(
          'is-playing',
          next.playing && Number(el.dataset.play) === next.trackPosition,
        );
      });
      listeners.forEach((listener) => listener(next));
    },
    _send: send,
  };
})();

const esc = (text) =>
  String(text ?? '').replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch],
  );
/** Escaped text with its line breaks kept. */
const lines = (text) => esc(text).replace(/\n/g, '<br>');
const pad = (n) => String(n).padStart(2, '0');
const time = (ms) =>
  ms ? `${Math.floor(ms / 60000)}:${pad(Math.floor(ms / 1000) % 60)}` : '';
const money = (minor, currency) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency || 'usd',
  }).format((minor || 0) / 100);
const price = (p) => {
  if (p.mode === 'free') return 'Free';
  const amount = money(p.minimumPrice, p.currency);
  if (p.mode === 'fixed') return amount;
  return p.minimumPrice > 0 ? `${amount} or more` : 'Name your price';
};
const year = (r) => (r.releasedAt ? r.releasedAt.slice(0, 4) : '');
const KINDS = {
  single: 'Single',
  ep: 'EP',
  lp: 'LP',
  album: 'Album',
  compilation: 'Compilation',
  remaster: 'Remaster',
  soundtrack: 'Soundtrack',
  score: 'Score',
  demo: 'Demo',
};
const kind = (r) => KINDS[r.kind] || 'Record';
const place = (artist) => {
  if (!artist.country) return '';
  let country = artist.country;
  try {
    country =
      new Intl.DisplayNames(['en'], { type: 'region' }).of(artist.country) ||
      artist.country;
  } catch {}
  return artist.city ? `${artist.city}, ${country}` : country;
};
const runtime = (r) =>
  r.tracks.reduce((sum, track) => sum + (track.durationMs || 0), 0);
const minutes = (r) => `${Math.round(runtime(r) / 60000)} min`;
const asset = (r, kindName) => r.assets.find((a) => a.kind === kindName);
const pictures = (r, kinds = ['photo', 'back_cover']) =>
  r.assets.filter(
    (a) => kinds.includes(a.kind) && a.mimeType.startsWith('image/'),
  );
/** "A1", "B2" on a record with sides, "1", "2" without. */
const side = (r, position) => {
  const starts = r.sideStarts || [];
  if (!starts.length) return String(position);
  const before = starts.filter((s) => s <= position);
  const start = before.length ? before[before.length - 1] : 1;
  return String.fromCharCode(65 + before.length) + (position - start + 1);
};
const formatName = (f) =>
  ({ vinyl: 'Vinyl', cassette: 'Cassette', cd: 'CD' })[f] || f;
/** A CSS color from an artist's slot, or the fallback when it is not one. */
const color = (value, fallback) =>
  /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : fallback;
/** Runs `fn` once an element scrolls into view. */
const reveal = (selector, className = 'in') => {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(className);
          io.unobserve(entry.target);
        }
      }),
    { threshold: 0.15 },
  );
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
};

window.addEventListener('message', (event) => {
  const data = event.data;
  if (data?.type === 'artist-page:playback') {
    ime._set(data.playback);
    return;
  }
  if (data?.type !== 'artist-page:init') return;
  const { release, customization } = data.payload;
  document.body.innerHTML = render(release, customization || {});
  document.querySelectorAll('[data-play]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      ime.toggle(Number(el.dataset.play));
    }),
  );
  document.querySelectorAll('[data-buy]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      ime.buy();
    }),
  );
  if (typeof mount === 'function') mount(release, customization || {}, ime);
  // for hosts that size the frame to the page rather than fill a box
  const report = () =>
    ime._send({
      type: 'artist-page:resize',
      height: document.documentElement.scrollHeight,
    });
  new ResizeObserver(report).observe(document.body);
  report();
});
ime._send({ type: 'artist-page:ready' });
