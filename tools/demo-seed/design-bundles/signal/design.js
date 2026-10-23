function render(r, c) {
  const a = color(c.color1, '#00e5ff');
  const b = color(c.color2, '#6a00ff');
  const ring = `${r.title} // ${r.artist.name} // ${kind(r)}${year(r) ? ' ' + year(r) : ''} // `;
  return `
    <style>:root{--a:${a};--b:${b}}</style>
    <canvas class="field" aria-hidden="true"></canvas>
    <header class="hero">
      <div class="platter">
        <svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
          <defs><path id="circle" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"/></defs>
          <text><textPath href="#circle" textLength="552">${esc((ring + ring).toUpperCase())}</textPath></text>
        </svg>
        <div class="disc"><img src="${esc(r.coverUrl)}" alt="Cover of ${esc(r.title)}"></div>
        ${r.tracks.length ? `<button class="spin" data-play="${r.tracks[0].position}" aria-label="Play ${esc(r.tracks[0].title)}"></button>` : ''}
      </div>
      <h1><span>${esc(r.title)}</span><small>${esc(r.artist.name)}</small></h1>
    </header>

    <main class="panel">
      <section>
        <h2>Tracks <span>${minutes(r)}</span></h2>
        <ol class="tracks">
          ${r.tracks
            .map(
              (t) => `<li><button data-play="${t.position}">
                <span>${pad(t.position)}</span><span>${esc(t.title)}</span><span class="scope" aria-hidden="true"></span><span>${time(t.durationMs)}</span>
              </button></li>`,
            )
            .join('')}
        </ol>
      </section>
      ${r.description ? `<section><h2>Notes</h2><p class="notes">${lines(r.description)}</p></section>` : ''}
      ${
        pictures(r).length
          ? `<section class="pics">${pictures(r)
              .map(
                (p) => `<img src="${esc(p.url)}" alt="${esc(p.title || '')}">`,
              )
              .join('')}</section>`
          : ''
      }
      <section class="close">
        <div>
          ${r.credits ? `<h2>Credits</h2><p class="credits">${lines(r.credits)}</p>` : ''}
        </div>
        <div class="buy">
          <h2>Get it</h2>
          <button data-buy><span>Digital</span><span>${esc(price(r.price))}</span></button>
          ${r.editions
            .map(
              (e) =>
                `<button data-buy><span>${esc(formatName(e.format))}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'Sold out'}</span></button>`,
            )
            .join('')}
          <p class="from">${esc(r.artist.name)}${place(r.artist) ? ' // ' + esc(place(r.artist)) : ''}</p>
        </div>
      </section>
    </main>`;
}

const FIELD = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uEnergy; uniform vec3 uA; uniform vec3 uB;
float hash(float n){ return fract(sin(n)*43758.5453); }
float wave(float x, float i, float t){
  float hump = exp(-pow((x-0.5)*3.0, 2.0));
  float w = sin(x*17.0 + t*1.3 + i*1.7)*0.5
          + sin(x*43.0 - t*2.3 + i*3.1)*0.22
          + sin(x*6.0 + t*0.6 + hash(i)*6.28)*0.7;
  return hump*w;
}
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec3 col = vec3(0.0);
  for (float k = 0.0; k < 44.0; k++) {
    float y0 = (k + 0.5)/44.0;
    float y = y0 + wave(uv.x, k, uTime)*(0.014 + 0.045*uEnergy);
    float d = abs(uv.y - y)*uRes.y;
    col += mix(uA, uB, y0)*(smoothstep(1.8, 0.0, d) + 0.22*exp(-d*0.3));
  }
  float aspect = uRes.x/uRes.y;
  col *= smoothstep(1.25, 0.15, length((uv - 0.5)*vec2(aspect, 1.0)));
  gl_FragColor = vec4(col*0.85, 1.0);
}`;

function hex(value) {
  const n = parseInt(value.slice(1).padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mount(r, c, ime) {
  const canvas = document.querySelector('.field');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  const disc = document.querySelector('.disc');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let playing = false;
  ime.onPlayback((p) => (playing = p.playing));

  let draw = () => {};
  if (gl) {
    const shader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(
      program,
      shader(
        gl.VERTEX_SHADER,
        'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}',
      ),
    );
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FIELD));
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const at = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    const u = (name) => gl.getUniformLocation(program, name);
    gl.uniform3fv(u('uA'), hex(color(c.color1, '#00e5ff')));
    gl.uniform3fv(u('uB'), hex(color(c.color2, '#6a00ff')));
    const resize = () => {
      const scale = Math.min(devicePixelRatio, 1.5);
      canvas.width = innerWidth * scale;
      canvas.height = innerHeight * scale;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
    };
    addEventListener('resize', resize);
    resize();
    draw = (t, energy) => {
      gl.uniform1f(u('uTime'), t);
      gl.uniform1f(u('uEnergy'), energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }

  let t = 0;
  let energy = 0;
  let angle = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    energy += ((playing ? 1 : 0) - energy) * 0.03;
    t += dt * (still ? 0.05 : 0.5 + energy * 1.8);
    // a record on a platter: slow at rest, 33 and a third while it plays
    angle += dt * (still ? 0 : 8 + energy * 192);
    disc.style.transform = `rotate(${angle}deg)`;
    draw(t, energy);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  reveal('.panel section');
}
