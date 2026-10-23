function render(r, c) {
  const shout = (c.shout || 'LIVE').toUpperCase();
  const photos = pictures(r, ['photo']);
  const flyer =
    c.flyer || (photos[0] && photos[0].url) || r.artist.headerUrl || r.coverUrl;
  const wall = [{ url: r.coverUrl, title: r.title }, ...pictures(r)].slice(
    0,
    6,
  );
  const title = esc(r.title.toUpperCase());
  const row = (cls, dir) =>
    `<div class="row ${cls}" data-dir="${dir}">${`<span>${title}</span><span>${esc(shout)}</span>`.repeat(6)}</div>`;
  return `
    <header class="hero">
      <img class="flyer" src="${esc(flyer)}" alt="">
      <div class="bar">
        <span>${esc(r.artist.name)}</span>
        <span>${esc(place(r.artist) || kind(r))}</span>
        <span>${year(r) || 'Now'}</span>
      </div>
      <div class="rows" aria-hidden="true">
        ${row('outline', 1)}${row('solid', -1)}${row('outline', 1)}
      </div>
      <h1 class="sr">${esc(r.title)} by ${esc(r.artist.name)}</h1>
      <button class="stamp" data-buy>On sale<br><b>${esc(price(r.price))}</b></button>
    </header>

    <section class="wall">
      ${wall
        .map(
          (p, i) =>
            `<figure class="snap s${i}" data-speed="${[0.2, -0.15, 0.35, -0.25, 0.1, -0.3][i]}"><img src="${esc(p.url)}" alt="${esc(p.title || '')}">${
              p.title ? `<figcaption>${esc(p.title)}</figcaption>` : ''
            }</figure>`,
        )
        .join('')}
      ${r.description ? `<p class="blurb">${esc(r.description)}</p>` : ''}
    </section>

    <div class="tape" aria-hidden="true"><div>${`<span>${esc(shout)}</span><span>${title}</span>`.repeat(10)}</div></div>

    <section class="tickets">
      <h2>${r.tracks.length} songs // ${minutes(r)} // one night only</h2>
      <ol>
        ${r.tracks
          .map(
            (t) => `<li><button class="ticket" data-play="${t.position}">
              <span class="stub"><small>No.</small><b>${pad(t.position)}</b><i class="code"></i></span>
              <span class="main">
                <small>Admit one // ${esc(side(r, t.position))}</small>
                <b>${esc(t.title)}</b>
                <small>${esc(r.artist.name)} // ${time(t.durationMs)}</small>
              </span>
            </button></li>`,
          )
          .join('')}
      </ol>
    </section>

    <section class="merch">
      <h2>Merch table</h2>
      <div class="tags">
        <button data-buy class="tag"><span>Download</span><b>${esc(price(r.price))}</b></button>
        ${r.editions
          .map(
            (e, i) =>
              `<button data-buy class="tag" style="--r:${i % 2 ? 2 : -3}deg"><span>${esc(formatName(e.format))}</span><b>${e.inStock ? esc(money(e.price, e.currency)) : 'Gone'}</b></button>`,
          )
          .join('')}
      </div>
    </section>

    <footer class="small">
      ${r.credits ? `<p>${lines(r.credits)}</p>` : ''}
      <p class="sign">${esc(r.artist.name)}${place(r.artist) ? ' // ' + esc(place(r.artist)) : ''}</p>
    </footer>`;
}

function mount(r, c, ime) {
  if (!window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.row').forEach((row) => {
    const dir = Number(row.dataset.dir);
    gsap.fromTo(
      row,
      { xPercent: dir > 0 ? -30 : -5 },
      {
        xPercent: dir > 0 ? -5 : -30,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.5,
        },
      },
    );
  });
  gsap.to('.flyer', {
    scale: 1.25,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  });
  // on a phone the photos sit in a grid, so they stay put
  const phone = matchMedia('(max-width: 720px)').matches;
  document.querySelectorAll(phone ? '.none' : '.snap').forEach((el) => {
    gsap.fromTo(
      el,
      { y: 160 * Number(el.dataset.speed) * 4 },
      {
        y: -160 * Number(el.dataset.speed) * 4,
        ease: 'none',
        scrollTrigger: {
          trigger: '.wall',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
  gsap.from('.ticket', {
    y: 80,
    rotate: () => gsap.utils.random(-8, 8),
    opacity: 0,
    stagger: 0.06,
    duration: 0.7,
    ease: 'back.out(1.6)',
    scrollTrigger: { trigger: '.tickets', start: 'top 75%' },
  });
  if (!still) {
    gsap.to('.tape div', {
      xPercent: -50,
      duration: 30,
      ease: 'none',
      repeat: -1,
    });
  }
  // the stamp thumps in time while something plays
  const thump = gsap.to('.stamp', {
    scale: 1.08,
    duration: 0.25,
    yoyo: true,
    repeat: -1,
    ease: 'power1.inOut',
    paused: true,
  });
  ime.onPlayback((p) => (p.playing && !still ? thump.play() : thump.pause(0)));
}
