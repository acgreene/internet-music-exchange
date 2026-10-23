function render(r, c) {
  // photos lead the plates; the back cover closes them uncropped
  const photos = [...pictures(r, ['photo']), ...pictures(r, ['back_cover'])];
  const sung = r.tracks.filter((t) => t.lyrics);
  const notes = (r.description || '').split(/\n+/).filter(Boolean);
  const pull = c.pullquote || '';
  const issue = c.issue || `${kind(r)}${year(r) ? ', ' + year(r) : ''}`;
  // the essay gets its pull quote after the first paragraph
  const essay = notes
    .map(
      (para, i) =>
        `<p>${esc(para)}</p>${i === 0 && pull ? `<blockquote>${esc(pull)}</blockquote>` : ''}`,
    )
    .join('');
  return `
    <article class="book">
      <header class="mast">
        <span>${esc(r.artist.name)}</span>
        <span>${esc(issue)}</span>
        <span>${r.tracks.length} songs, ${minutes(r)}</span>
      </header>

      <section class="cover page">
        <h1>${esc(r.title)}</h1>
        <p class="byline">${esc(r.artist.name)}${place(r.artist) ? `<small>${esc(place(r.artist))}</small>` : ''}</p>
        <figure>
          <img src="${esc(r.coverUrl)}" alt="Cover of ${esc(r.title)}">
          <figcaption>Front cover${r.artist.name ? `, ${esc(r.title)} by ${esc(r.artist.name)}` : ''}</figcaption>
        </figure>
      </section>

      <section class="contents page" aria-labelledby="contents">
        <h2 id="contents">Contents</h2>
        <ol>
          ${r.tracks
            .map(
              (t) => `<li><button data-play="${t.position}">
                <span class="t">${esc(t.title)}</span>
                <span class="leader" aria-hidden="true"></span>
                <span class="p">${time(t.durationMs)}</span>
              </button></li>`,
            )
            .join('')}
        </ol>
      </section>

      ${
        essay
          ? `<section class="essay page"><h2>Notes</h2><div class="cols">${essay}</div></section>`
          : pull
            ? `<section class="essay page"><blockquote>${esc(pull)}</blockquote></section>`
            : ''
      }

      ${
        photos.length
          ? `<section class="plates page">${photos
              .map(
                (
                  p,
                  i,
                ) => `<figure class="plate p${i % 3}${p.kind === 'back_cover' ? ' square' : ''}">
                  <img src="${esc(p.url)}" alt="${esc(p.title || '')}">
                  <figcaption><b>Plate ${i + 1}.</b> ${esc(p.title || '')}${p.description ? `. ${esc(p.description)}` : ''}</figcaption>
                </figure>`,
              )
              .join('')}</section>`
          : ''
      }

      ${
        sung.length
          ? `<section class="poems page"><h2>Words</h2>${sung
              .map(
                (t) => `<div class="poem">
                  <h3><button data-play="${t.position}">${esc(t.title)}</button></h3>
                  <p>${lines(t.lyrics)}</p>
                </div>`,
              )
              .join('')}</section>`
          : ''
      }

      <footer class="colophon page">
        <h2>Colophon</h2>
        <div class="grid">
          <div>
            ${r.credits ? `<p class="credits">${lines(r.credits)}</p>` : ''}
            <p class="set">${esc(r.artist.name)}${place(r.artist) ? `, ${esc(place(r.artist))}` : ''}${year(r) ? `, ${year(r)}` : ''}</p>
          </div>
          <div class="order">
            <h3>To order</h3>
            <button data-buy><span>Digital edition</span><span>${esc(price(r.price))}</span></button>
            ${r.editions
              .map(
                (e) =>
                  `<button data-buy><span>${esc(e.name)}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'Out of print'}</span></button>`,
              )
              .join('')}
          </div>
        </div>
      </footer>
    </article>`;
}

function mount() {
  reveal('.page, .plate, .poem');
}
