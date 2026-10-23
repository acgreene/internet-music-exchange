function render(r, c) {
  const count = r.tracks.length;
  return `
    <nav class="index" aria-label="Tracks">
      ${r.tracks.map((t) => `<a href="#t${t.position}" data-to="t${t.position}">${pad(t.position)}</a>`).join('')}
    </nav>

    <section class="screen front">
      <div class="head">
        <h1>${esc(r.title)}</h1>
        <p>${esc(r.artist.name)}</p>
      </div>
      <div class="meta">
        <span>${esc(kind(r))}</span>
        <span>${year(r)}</span>
        <span>${esc(place(r.artist))}</span>
        <span>${minutes(r)}</span>
      </div>
      <div class="numeral" aria-hidden="true">${count}</div>
      <img class="cover" src="${esc(r.coverUrl)}" alt="Cover of ${esc(r.title)}">
      <button class="buy-now" data-buy>Buy ${esc(price(r.price))}</button>
    </section>

    ${r.tracks
      .map(
        (t) => `<section class="screen song" id="t${t.position}">
          <div class="bar"><span>${esc(r.title)}</span><span>${pad(t.position)}/${pad(count)}</span></div>
          <div class="big" aria-hidden="true">${pad(t.position)}</div>
          <div class="info">
            <h2>${esc(t.title)}</h2>
            <p class="facts"><span>${time(t.durationMs)}</span>${r.sideStarts && r.sideStarts.length ? `<span>Side ${side(r, t.position).charAt(0)}</span>` : ''}</p>
            <button class="play" data-play="${t.position}" aria-label="Play ${esc(t.title)}"><i></i></button>
          </div>
          ${t.lyrics ? `<p class="words">${lines(t.lyrics)}</p>` : ''}
        </section>`,
      )
      .join('')}

    <section class="screen back">
      ${r.description ? `<div class="col"><h3>Notes</h3><p>${lines(r.description)}</p></div>` : ''}
      ${r.credits ? `<div class="col"><h3>Credits</h3><p>${lines(r.credits)}</p></div>` : ''}
      <div class="col buy">
        <h3>Buy</h3>
        <button data-buy><span>Digital</span><span>${esc(price(r.price))}</span></button>
        ${r.editions
          .map(
            (e) =>
              `<button data-buy><span>${esc(formatName(e.format))}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'Sold out'}</span></button>`,
          )
          .join('')}
      </div>
      ${
        pictures(r).length
          ? `<div class="strip">${pictures(r)
              .map(
                (p) => `<img src="${esc(p.url)}" alt="${esc(p.title || '')}">`,
              )
              .join('')}</div>`
          : ''
      }
    </section>`;
}

function mount() {
  const links = [...document.querySelectorAll('.index a')];
  links.forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document
        .getElementById(a.dataset.to)
        .scrollIntoView({ behavior: 'smooth' });
    }),
  );
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        entry.target.classList.toggle('here', entry.isIntersecting);
        const link = links.find((a) => a.dataset.to === entry.target.id);
        if (link) link.classList.toggle('here', entry.isIntersecting);
      }),
    { threshold: 0.55 },
  );
  document.querySelectorAll('.screen').forEach((s) => io.observe(s));
}
