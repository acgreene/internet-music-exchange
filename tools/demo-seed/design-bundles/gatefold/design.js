function render(r, c) {
  const back = asset(r, 'back_cover');
  // the inside sleeve leads with the artist's line, or the notes' first sentence
  const notes = r.description || '';
  const split = notes.indexOf('. ');
  const quote = c.quote || (split > 0 ? notes.slice(0, split + 1) : notes);
  const rest = c.quote || split < 0 ? notes : notes.slice(split + 2);
  return `
    <section class="stage">
      <div class="scene">
        <div class="titles">
          <div class="kind">${esc(kind(r))} ${year(r) ? '// ' + year(r) : ''}</div>
          <h1>${esc(r.title)}</h1>
          <p>${esc(r.artist.name)}</p>
        </div>
        <div class="fold">
          <div class="disc"><div class="label"><img src="${esc(r.coverUrl)}" alt=""></div></div>
          <div class="panel right">
            <h2>${r.tracks.length} songs // ${minutes(r)}</h2>
            <ol class="tracks" style="--rows:${Math.max(r.tracks.length, 8)}">
              ${r.tracks
                .map(
                  (t) => `<li><button data-play="${t.position}">
                    <span>${side(r, t.position)}</span><span>${esc(t.title)}</span><span>${time(t.durationMs)}</span>
                  </button></li>`,
                )
                .join('')}
            </ol>
          </div>
          <div class="door">
            <div class="face front"><img src="${esc(r.coverUrl)}" alt="Cover of ${esc(r.title)}"></div>
            <div class="face inside">
              <p class="quote">${esc(quote)}</p>
              <p class="notes">${esc(rest)}</p>
              <span class="sig">${esc(r.artist.name)}${place(r.artist) ? ', ' + esc(place(r.artist)) : ''}</span>
            </div>
          </div>
        </div>
        <div class="hint">Scroll to open</div>
      </div>
    </section>
    <section class="after">
      <div class="back">
        <p class="label-small">The back</p>
        <img src="${esc(back ? back.url : r.coverUrl)}" alt="">
      </div>
      <div>
        ${r.credits ? `<p class="label-small">Credits</p><p class="credits">${esc(r.credits)}</p>` : ''}
        <p class="label-small">Take it home</p>
        <div class="buy">
          <button class="main" data-buy><span>Digital</span><span>${esc(price(r.price))}</span></button>
          ${r.editions
            .map(
              (e) =>
                `<button data-buy><span>${esc(formatName(e.format))}, ${esc(e.name)}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'Sold out'}</span></button>`,
            )
            .join('')}
        </div>
        <div class="artist">
          ${r.artist.avatarUrl ? `<img src="${esc(r.artist.avatarUrl)}" alt="">` : ''}
          <div><strong>${esc(r.artist.name)}</strong><br><span style="opacity:.7">${esc(place(r.artist))}</span></div>
        </div>
      </div>
    </section>`;
}

function mount(r, c, ime) {
  if (!window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);
  const fold = document.querySelector('.fold');
  const door = document.querySelector('.door');
  const disc = document.querySelector('.disc');
  // tall screens open the sleeve top to bottom so it stays readable
  const tall = matchMedia('(max-aspect-ratio: 4/5)').matches;
  document.documentElement.classList.toggle('tall', tall);
  const size = () => (tall ? fold.offsetWidth : fold.offsetHeight);
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: {
      trigger: '.stage',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8,
      invalidateOnRefresh: true,
    },
  });
  const along = tall ? 'y' : 'x';
  gsap.set(fold, {
    [along]: () => -size() / 2,
    rotateX: 22,
    rotateY: -28,
    scale: 0.84,
  });
  tl.to(fold, { rotateX: 0, rotateY: 0, scale: 1, duration: 1 })
    .to('.hint', { opacity: 0, duration: 0.3 }, 0)
    .to(
      door,
      tall ? { rotateX: 180, duration: 1.4 } : { rotateY: -180, duration: 1.4 },
      '>',
    )
    .to(fold, { [along]: 0, duration: 1.4 }, '<')
    .to(
      disc,
      { x: () => size() * (tall ? 0.42 : 0.62), rotate: 120, duration: 1.1 },
      '>-0.2',
    )
    .to(fold, { scale: 0.86, duration: 0.6 });
  // a disc already out of its sleeve keeps turning while it plays
  ime.onPlayback((p) => {
    gsap.to(disc, { scale: p.playing ? 1.03 : 1, duration: 0.6 });
  });
}
