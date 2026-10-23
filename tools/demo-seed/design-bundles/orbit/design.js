/** Rough middles of countries, so the globe can mark where the artist is from. */
const CENTERS = {
  US: [39, -98],
  CA: [56, -106],
  MX: [23, -102],
  BR: [-10, -55],
  AR: [-34, -64],
  CO: [4, -72],
  CL: [-30, -71],
  GB: [54, -2],
  IE: [53, -8],
  FR: [46, 2],
  DE: [51, 10],
  NL: [52, 5],
  BE: [50, 4],
  CH: [47, 8],
  AT: [47, 14],
  ES: [40, -4],
  PT: [39, -8],
  IT: [42, 12],
  PL: [52, 19],
  SE: [62, 15],
  NO: [61, 8],
  DK: [56, 10],
  FI: [64, 26],
  IS: [65, -18],
  JP: [36, 138],
  KR: [36, 128],
  CN: [35, 105],
  IN: [21, 78],
  AU: [-25, 134],
  NZ: [-41, 174],
  ZA: [-30, 25],
  NG: [9, 8],
  GH: [8, -1],
  KE: [0, 38],
};

function render(r, c) {
  const statement =
    c.statement || (r.description || '').split('. ')[0] || r.title;
  // each word takes a different weight, so the line reads like a poster
  const styles = [
    'thin',
    'heavy',
    'serif',
    'heavy',
    'outline',
    'thin',
    'serif',
  ];
  const words = statement
    .split(/\s+/)
    .map(
      (word, i) =>
        `<span class="${styles[i % styles.length]}">${esc(word)}</span>`,
    )
    .join(' ');
  const photos = [{ url: r.coverUrl, title: r.title }, ...pictures(r)];
  return `
    <canvas class="globe" aria-hidden="true"></canvas>
    <nav class="top">
      <span>${esc(r.artist.name)}</span>
      <span class="links"><a href="#tracks">Tracks</a><a href="#pictures">Pictures</a><a href="#buy">Buy</a></span>
    </nav>

    <header class="hero">
      <p class="eyebrow">${esc(r.title)} // ${esc(kind(r))}${year(r) ? ' ' + year(r) : ''}</p>
      <h1>${words}</h1>
      <p class="where">${place(r.artist) ? 'From ' + esc(place(r.artist)) : ''}</p>
    </header>

    <section class="list" id="tracks">
      <ol>
        ${r.tracks
          .map(
            (t) => `<li><button data-play="${t.position}">
              <span class="n">(${pad(t.position)})</span>
              <span class="t">${esc(t.title)}</span>
              <span class="d">${time(t.durationMs)}</span>
            </button></li>`,
          )
          .join('')}
      </ol>
    </section>

    <section class="hang" id="pictures">
      ${photos
        .map(
          (p, i) =>
            `<figure class="panel" style="--side:${i % 2 ? 1 : -1}"><img src="${esc(p.url)}" alt="${esc(p.title || '')}"><figcaption><span>${pad(i + 1)}</span>${esc(p.title || '')}</figcaption></figure>`,
        )
        .join('')}
    </section>

    ${r.description ? `<section class="about"><p>${lines(r.description)}</p></section>` : ''}

    <section class="close" id="buy">
      <div class="buy">
        <button data-buy><span>Digital</span><span>${esc(price(r.price))}</span></button>
        ${r.editions
          .map(
            (e) =>
              `<button data-buy><span>${esc(e.name)}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'Sold out'}</span></button>`,
          )
          .join('')}
      </div>
      ${r.credits ? `<p class="credits">${lines(r.credits)}</p>` : ''}
    </section>

    <div class="marquee" aria-hidden="true"><div>${`<span>${esc(r.artist.name)}</span><span class="o">${esc(r.title)}</span>`.repeat(6)}</div></div>`;
}

function mount(r, c, ime) {
  // photos swing toward you as they cross the middle of the screen
  const panels = [...document.querySelectorAll('.panel')];
  const swing = () => {
    const mid = innerHeight / 2;
    panels.forEach((panel) => {
      const box = panel.getBoundingClientRect();
      const off = Math.max(
        -1,
        Math.min(1, (box.top + box.height / 2 - mid) / mid),
      );
      const side = Number(panel.style.getPropertyValue('--side'));
      panel.style.transform = `rotateY(${off * 24 * side}deg) rotateX(${off * -8}deg) translateZ(${(1 - Math.abs(off)) * 40}px)`;
      panel.style.opacity = String(1 - Math.abs(off) * 0.3);
    });
  };
  addEventListener('scroll', swing, { passive: true });
  swing();

  const canvas = document.querySelector('.globe');
  if (!window.THREE) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.z = 4.2;
  const tint = new THREE.Color(color(c.primary, '#6366f1'));

  const globe = new THREE.Group();
  scene.add(globe);
  globe.add(
    new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 36, 18)),
      new THREE.LineBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.35,
      }),
    ),
  );
  // a fine dust of points on the surface
  const count = 1400;
  const dots = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    dots.set(
      [Math.cos(a) * ring * 1.01, y * 1.01, Math.sin(a) * ring * 1.01],
      i * 3,
    );
  }
  const dust = new THREE.BufferGeometry();
  dust.setAttribute('position', new THREE.BufferAttribute(dots, 3));
  globe.add(
    new THREE.Points(
      dust,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.012,
        transparent: true,
        opacity: 0.6,
      }),
    ),
  );

  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.004, 8, 160),
    new THREE.MeshBasicMaterial({ color: tint }),
  );
  orbit.rotation.x = Math.PI / 2.4;
  scene.add(orbit);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  scene.add(moon);

  let pin = null;
  const center = CENTERS[(r.artist.country || '').toUpperCase()];
  if (center) {
    const phi = ((90 - center[0]) * Math.PI) / 180;
    const theta = ((center[1] + 180) * Math.PI) / 180;
    const at = new THREE.Vector3(
      -Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
    pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    pin.position.copy(at.clone().multiplyScalar(1.02));
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.065, 32),
      new THREE.MeshBasicMaterial({
        color: tint,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    halo.position.copy(at.clone().multiplyScalar(1.03));
    halo.lookAt(at.clone().multiplyScalar(2));
    globe.add(pin, halo);
    pin.userData.halo = halo;
    // start with the artist's side of the world facing us
    globe.rotation.y = -Math.atan2(at.x, at.z);
    globe.rotation.x = Math.asin(at.y) * 0.6;
  }

  const phone = matchMedia('(max-width: 720px)').matches;
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  let playing = false;
  ime.onPlayback((p) => (playing = p.playing));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let spin = 0.06;
  let t = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    spin += ((playing ? 0.5 : 0.06) - spin) * 0.03;
    if (!still) globe.rotation.y += dt * spin;
    const travel = Math.min(scrollY / innerHeight, 3);
    globe.position.x = phone ? 0 : 1.25 - Math.min(travel, 1) * 0.4;
    globe.position.y = phone ? 0.9 - travel * 0.3 : -travel * 0.15;
    globe.scale.setScalar(phone ? 0.8 : 1);
    orbit.position.copy(globe.position);
    const a = t * (0.4 + spin);
    moon.position.set(
      globe.position.x + Math.cos(a) * 1.45,
      globe.position.y + Math.sin(a) * 1.45 * Math.cos(orbit.rotation.x),
      Math.sin(a) * 1.45 * Math.sin(orbit.rotation.x),
    );
    if (pin) {
      const pulse = 1 + ((t * (playing ? 2 : 0.8)) % 1) * 1.6;
      pin.userData.halo.scale.setScalar(pulse);
      pin.userData.halo.material.opacity = 1 - (pulse - 1) / 1.6;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
