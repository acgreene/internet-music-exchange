function render(r, c) {
  const photos = pictures(r, ['photo']);
  const back = asset(r, 'back_cover');
  const snapshot = c.snapshot || (photos[0] && photos[0].url);
  const note = c.note || (r.description || '').split('. ')[0];
  const sung = r.tracks.find((t) => t.lyrics);
  const date = r.releasedAt
    ? new Date(r.releasedAt).toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  const items = [];
  const add = (cls, html, label) =>
    items.push(
      `<div class="bit ${cls}" aria-label="${esc(label)}">${html}</div>`,
    );

  add(
    'polaroid cover',
    `<img src="${esc(r.coverUrl)}" alt="Cover of ${esc(r.title)}"><p>${esc(r.title)}</p>`,
    'Cover',
  );
  add(
    'notebook',
    `<h1>${esc(r.title)}</h1><ol>${r.tracks
      .map(
        (t) =>
          `<li><button data-play="${t.position}">${esc(t.title)}<small>${time(t.durationMs)}</small></button></li>`,
      )
      .join('')}</ol>`,
    'Tracklist',
  );
  if (note) add('sticky', `<p>${esc(note)}</p>`, 'Note');
  add(
    'ticket',
    `<span class="admit">Admit one</span><b>${esc(r.artist.name)}</b><span>${esc(kind(r))}${date ? ' // ' + esc(date) : ''}</span><span>${esc(place(r.artist))}</span>`,
    'Ticket',
  );
  if (back)
    add(
      'polaroid back',
      `<img src="${esc(back.url)}" alt="Back cover"><p>the back</p>`,
      'Back cover',
    );
  photos.slice(0, 3).forEach((p, i) => {
    if (p.url === snapshot && i > 0) return;
    add(
      `polaroid photo p${i}`,
      `<img src="${esc(p.url)}" alt="${esc(p.title || '')}"><p>${esc(p.title || '')}</p>`,
      p.title || 'Photo',
    );
  });
  if (snapshot && !photos.some((p) => p.url === snapshot)) {
    add(
      'polaroid photo p3',
      `<img src="${esc(snapshot)}" alt=""><p></p>`,
      'Snapshot',
    );
  }
  if (sung)
    add(
      'torn',
      `<h2>${esc(sung.title)}</h2><p>${lines(sung.lyrics)}</p>`,
      'Lyrics',
    );
  add(
    'receipt',
    `<h2>${esc(r.artist.name)}</h2><p class="rule"></p>
     <button data-buy><span>${esc(r.title)}, digital</span><span>${esc(price(r.price))}</span></button>
     ${r.editions
       .map(
         (e) =>
           `<button data-buy><span>${esc(e.name)}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'sold out'}</span></button>`,
       )
       .join('')}
     <p class="rule"></p><p class="thanks">thank you</p>`,
    'Buy',
  );
  if (r.credits)
    add('index', `<h2>Credits</h2><p>${lines(r.credits)}</p>`, 'Credits');

  return `<main class="board">${items.join('')}</main>`;
}

function mount() {
  const board = document.querySelector('.board');
  const bits = [...board.querySelectorAll('.bit')];
  let top = bits.length;
  bits.forEach((bit, i) => {
    bit.style.setProperty('--tilt', `${((i * 37) % 11) - 5}deg`);
    bit.style.zIndex = String(i + 1);
  });
  if (!matchMedia('(hover: hover) and (min-width: 900px)').matches) return;

  // drag anything around; whatever you pick up comes to the top
  bits.forEach((bit) => {
    let start = null;
    bit.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      start = {
        x: e.clientX,
        y: e.clientY,
        left: bit.offsetLeft,
        top: bit.offsetTop,
      };
      bit.setPointerCapture(e.pointerId);
      bit.style.zIndex = String(++top);
      bit.classList.add('held');
    });
    bit.addEventListener('pointermove', (e) => {
      if (!start) return;
      bit.style.left = `${start.left + e.clientX - start.x}px`;
      bit.style.top = `${start.top + e.clientY - start.y}px`;
    });
    const drop = () => {
      start = null;
      bit.classList.remove('held');
    };
    bit.addEventListener('pointerup', drop);
    bit.addEventListener('pointercancel', drop);
  });
}
