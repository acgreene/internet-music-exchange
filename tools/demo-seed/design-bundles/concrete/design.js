function render(r, c) {
  const manifesto = (
    c.manifesto || `${r.title} // ${r.artist.name} // ${kind(r)} ${year(r)}`
  ).toUpperCase();
  const photos = pictures(r);
  const sung = r.tracks.filter((t) => t.lyrics);
  const facts = [
    ['Artist', r.artist.name],
    ['From', place(r.artist)],
    ['Format', kind(r)],
    ['Year', year(r)],
    ['Tracks', String(r.tracks.length)],
    ['Length', minutes(r)],
    ['Genre', (r.genres || []).join(', ')],
  ].filter(([, value]) => value);
  const tick = (text) =>
    `<div class="tick" aria-hidden="true"><div>${`<span>${esc(text)}</span>`.repeat(8)}</div></div>`;
  return `
    ${tick(manifesto)}
    <h1 class="mega"><span>${esc(r.title)}</span></h1>

    <section class="slab">
      <div class="cell art">
        <div class="tone">
          <div class="dots"><img src="${esc(r.coverUrl)}" alt="Cover of ${esc(r.title)}"></div>
          <div class="ink" aria-hidden="true"></div>
        </div>
      </div>
      <dl class="cell facts">
        ${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
      </dl>
      <div class="cell buy">
        <button data-buy class="big"><span>Buy</span><span>${esc(price(r.price))}</span></button>
        ${r.editions
          .map(
            (e) =>
              `<button data-buy><span>${esc(formatName(e.format))}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'SOLD OUT'}</span></button>`,
          )
          .join('')}
      </div>
    </section>

    <section class="cell list">
      <h2>Tracklist</h2>
      <ol>
        ${r.tracks
          .map(
            (t) => `<li><button data-play="${t.position}">
              <span>${pad(t.position)}</span><span>${esc(t.title)}</span><span>${time(t.durationMs)}</span><span class="go">PLAY</span>
            </button></li>`,
          )
          .join('')}
      </ol>
    </section>
    <img class="chaser" src="${esc(r.coverUrl)}" alt="" aria-hidden="true">

    ${
      r.description
        ? `<section class="cell notes"><h2>Notes</h2><p>${lines(r.description)}</p></section>`
        : ''
    }

    ${
      photos.length
        ? `<section class="pics">${photos
            .map(
              (p) =>
                `<figure class="cell"><img src="${esc(p.url)}" alt="${esc(p.title || '')}"><figcaption>${esc(p.title || '')}</figcaption></figure>`,
            )
            .join('')}</section>`
        : ''
    }

    ${
      sung.length
        ? `<section class="words">${sung
            .map(
              (t) =>
                `<div class="cell"><h3>${pad(t.position)} ${esc(t.title)}</h3><p>${lines(t.lyrics)}</p></div>`,
            )
            .join('')}</section>`
        : ''
    }

    ${r.credits ? `<section class="cell credits"><h2>Credits</h2><p>${lines(r.credits)}</p></section>` : ''}

    ${tick(r.artist.name.toUpperCase())}`;
}

function mount(r, c, ime) {
  // the cover chases the cursor down the tracklist
  const chaser = document.querySelector('.chaser');
  const list = document.querySelector('.list');
  if (matchMedia('(hover: hover)').matches) {
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    list.addEventListener('pointermove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
    });
    list.addEventListener('pointerenter', () => chaser.classList.add('on'));
    list.addEventListener('pointerleave', () => chaser.classList.remove('on'));
    const follow = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      chaser.style.transform = `translate(${x + 24}px, ${y - 90}px) rotate(${(tx - x) * 0.05}deg)`;
      requestAnimationFrame(follow);
    };
    follow();
  }
  ime.onPlayback((p) =>
    document.documentElement.classList.toggle('loud', p.playing),
  );
}
