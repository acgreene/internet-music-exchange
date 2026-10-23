/** A radio frequency for each track, so the dial has somewhere to point. */
const station = (i, count) =>
  (88.1 + (i * 19.8) / Math.max(count - 1, 1)).toFixed(1);

function render(r, c) {
  const photos = pictures(r, ['photo']);
  const backdrop =
    c.backdrop ||
    r.artist.headerUrl ||
    (photos[0] && photos[0].url) ||
    r.coverUrl;
  const strip = [{ url: r.coverUrl, title: r.title }, ...pictures(r)];
  const count = r.tracks.length;
  return `
    <div class="grain" aria-hidden="true"></div>
    <header class="hero">
      <div class="layer sky" style="background-image:url('${esc(backdrop)}')"></div>
      <div class="layer sun" aria-hidden="true"></div>
      <canvas class="layer road" aria-hidden="true"></canvas>
      <div class="layer words">
        <p class="kicker">${esc(r.artist.name)}</p>
        <h1 class="tube">${esc(r.title)}</h1>
        <p class="kicker dim">${esc(kind(r))}${year(r) ? ' // ' + year(r) : ''}${place(r.artist) ? ' // ' + esc(place(r.artist)) : ''}</p>
      </div>
    </header>

    <section class="radio" aria-label="Tracks">
      <div class="dash">
        <div class="lcd">
          <span class="band">FM</span>
          <span class="freq" data-freq>${station(0, count)}</span>
          <span class="now"><span data-now>${esc(r.tracks[0] ? r.tracks[0].title : r.title)}</span></span>
        </div>
        <div class="dial" aria-hidden="true">
          <div class="scale">${[88, 92, 96, 100, 104, 108].map((n) => `<span>${n}</span>`).join('')}</div>
          <div class="needle" data-needle></div>
        </div>
        <ol class="presets">
          ${r.tracks
            .map(
              (
                t,
                i,
              ) => `<li><button data-play="${t.position}" data-index="${i}">
                <span class="n">${t.position}</span>
                <span class="t">${esc(t.title)}</span>
                <span class="f">${station(i, count)}</span>
                <span class="d">${time(t.durationMs)}</span>
              </button></li>`,
            )
            .join('')}
        </ol>
      </div>
    </section>

    <section class="strip" aria-label="Pictures">
      <div class="track">
        ${strip
          .map(
            (p, i) =>
              `<figure><img src="${esc(p.url)}" alt="${esc(p.title || '')}"><figcaption><span>${pad(i + 1)}</span>${esc(p.title || '')}</figcaption></figure>`,
          )
          .join('')}
      </div>
    </section>

    ${r.description ? `<section class="notes"><p>${lines(r.description)}</p></section>` : ''}

    <footer class="end">
      <div>
        ${r.credits ? `<h2>Credits</h2><p class="credits">${lines(r.credits)}</p>` : ''}
      </div>
      <div class="buy">
        <h2>Take it with you</h2>
        <button data-buy class="lit"><span>Digital</span><span>${esc(price(r.price))}</span></button>
        ${r.editions
          .map(
            (e) =>
              `<button data-buy><span>${esc(formatName(e.format))}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'Sold out'}</span></button>`,
          )
          .join('')}
      </div>
    </footer>`;
}

function mount(r, c, ime) {
  const count = r.tracks.length;
  const freq = document.querySelector('[data-freq]');
  const now = document.querySelector('[data-now]');
  const needle = document.querySelector('[data-needle]');
  const tune = (position) => {
    const i = Math.max(
      0,
      r.tracks.findIndex((t) => t.position === position),
    );
    freq.textContent = station(i, count);
    now.textContent = r.tracks[i] ? r.tracks[i].title : r.title;
    needle.style.left = `${(i / Math.max(count - 1, 1)) * 100}%`;
  };
  tune(r.tracks[0] && r.tracks[0].position);
  ime.onPlayback((p) => {
    if (p.trackPosition) tune(p.trackPosition);
    document.documentElement.classList.toggle('on-air', p.playing);
  });
  document.querySelectorAll('.presets button').forEach((b) =>
    b.addEventListener('mouseenter', () => {
      if (!ime.playback.playing) tune(Number(b.dataset.play));
    }),
  );

  road(color(c.primary, '#ff2bd6'), () =>
    document.documentElement.classList.contains('on-air'),
  );

  if (!window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);
  const hero = {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
  };
  gsap.to('.sky', {
    yPercent: 30,
    scale: 1.1,
    ease: 'none',
    scrollTrigger: hero,
  });
  gsap.to('.sun', { yPercent: 60, ease: 'none', scrollTrigger: hero });
  gsap.to('.words', {
    yPercent: -40,
    opacity: 0,
    ease: 'none',
    scrollTrigger: hero,
  });

  // the strip drives past sideways while the page holds still
  const track = document.querySelector('.track');
  if (
    !matchMedia('(max-width: 720px)').matches &&
    track.scrollWidth > innerWidth
  ) {
    gsap.to(track, {
      x: () => -(track.scrollWidth - innerWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: '.strip',
        start: 'top top',
        end: () => '+=' + (track.scrollWidth - innerWidth),
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
  }
  gsap.from('.presets li', {
    x: -40,
    opacity: 0,
    stagger: 0.05,
    scrollTrigger: { trigger: '.radio', start: 'top 70%' },
  });
}

/** A synthwave road running toward the sun, quicker while a track plays. */
function road(neon, fast) {
  const canvas = document.querySelector('.road');
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0;
  let h = 0;
  const size = () => {
    const scale = Math.min(devicePixelRatio, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * scale;
    canvas.height = h * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  };
  addEventListener('resize', size);
  size();
  let travel = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!still) travel = (travel + dt * (fast() ? 2.4 : 0.8)) % 1;
    // solid ground, so the sun sets behind the horizon
    const ground = ctx.createLinearGradient(0, 0, 0, h);
    ground.addColorStop(0, '#1a0833');
    ground.addColorStop(1, '#07051a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = neon;
    ctx.shadowColor = neon;
    ctx.shadowBlur = 8;
    const cx = w / 2;
    // rails fan out from the vanishing point at the horizon
    for (let i = -14; i <= 14; i++) {
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + i * 18, 0);
      ctx.lineTo(cx + i * w * 0.16, h);
      ctx.stroke();
    }
    // crossings come closer, spreading as they near
    for (let k = 0; k < 14; k++) {
      const z = (k + 1 - travel) / 14;
      const y = h * Math.pow(1 - z, 2.4);
      ctx.globalAlpha = Math.min(1, 0.15 + (1 - z));
      ctx.lineWidth = 1 + (1 - z) * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(w, 0.5);
    ctx.stroke();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
