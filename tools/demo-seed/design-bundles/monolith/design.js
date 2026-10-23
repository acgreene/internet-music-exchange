function render(r, c) {
  const accent = color(c.accent, '#7c5cff');
  const statement = c.statement || (r.description || '').split('. ')[0];
  const photos = pictures(r, ['photo']);
  const sung = r.tracks.filter((t) => t.lyrics);
  return `
    <style>:root{--accent:${accent}}</style>
    <canvas class="gl" aria-hidden="true"></canvas>
    <header class="hero">
      <div class="top">
        <span>${esc(kind(r))}${year(r) ? ' // ' + year(r) : ''}</span>
        <span>${esc(r.artist.name)}</span>
      </div>
      <h1>${esc(r.title)}</h1>
      <div class="actions">
        ${r.tracks.length ? `<button class="play" data-play="${r.tracks[0].position}"><span class="dot"></span>Listen</button>` : ''}
        <button class="ghost" data-buy>Buy, ${esc(price(r.price))}</button>
      </div>
    </header>

    <section class="statement fade">
      <img class="cover" src="${esc(r.coverUrl)}" alt="Cover of ${esc(r.title)}">
      ${statement ? `<p>${esc(statement)}</p>` : ''}
    </section>

    <section class="tracks fade">
      <h2>${r.tracks.length} ${r.tracks.length === 1 ? 'track' : 'tracks'} // ${minutes(r)}</h2>
      <ol>
        ${r.tracks
          .map(
            (t) => `<li><button data-play="${t.position}">
              <span class="n">${pad(t.position)}</span>
              <span class="t">${esc(t.title)}</span>
              <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="d">${time(t.durationMs)}</span>
            </button></li>`,
          )
          .join('')}
      </ol>
    </section>

    ${
      r.description
        ? `<section class="notes fade"><h2>Notes</h2><p>${lines(r.description)}</p></section>`
        : ''
    }

    ${
      photos.length
        ? `<section class="photos">${photos
            .map(
              (p, i) =>
                `<figure class="fade" style="--i:${i}"><img src="${esc(p.url)}" alt="${esc(p.title || '')}">${
                  p.title ? `<figcaption>${esc(p.title)}</figcaption>` : ''
                }</figure>`,
            )
            .join('')}</section>`
        : ''
    }

    ${
      sung.length
        ? `<section class="lyrics fade"><h2>Words</h2>${sung
            .slice(0, 3)
            .map(
              (t) =>
                `<div><h3>${esc(t.title)}</h3><p>${lines(t.lyrics)}</p></div>`,
            )
            .join('')}</section>`
        : ''
    }

    <footer class="end fade">
      <div>
        ${r.credits ? `<h2>Credits</h2><p class="credits">${lines(r.credits)}</p>` : ''}
      </div>
      <div class="buy">
        <h2>Own it</h2>
        <button data-buy><span>Digital</span><span>${esc(price(r.price))}</span></button>
        ${r.editions
          .map(
            (e) =>
              `<button data-buy><span>${esc(formatName(e.format))}</span><span>${e.inStock ? esc(money(e.price, e.currency)) : 'Sold out'}</span></button>`,
          )
          .join('')}
        <p class="by">${esc(r.artist.name)}${place(r.artist) ? `<br>${esc(place(r.artist))}` : ''}</p>
      </div>
    </footer>`;
}

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

function mount(r, c, ime) {
  reveal('.fade');
  const canvas = document.querySelector('.gl');
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
  const phone = matchMedia('(max-width: 720px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 5;

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.22 },
    uColor: { value: new THREE.Color(color(c.accent, '#7c5cff')) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `${NOISE}
      uniform float uTime; uniform float uAmp;
      varying vec3 vN; varying vec3 vP; varying float vD;
      float disp(vec3 p){ return snoise(p*1.3+vec3(0.0,0.0,uTime*0.22))*0.55 + snoise(p*3.2-uTime*0.12)*0.16; }
      vec3 shaped(vec3 n){ return n*(1.0+disp(n)*uAmp); }
      void main(){
        vec3 n=normalize(position);
        vec3 t=normalize(cross(n, abs(n.y)<0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0)));
        vec3 b=cross(n,t);
        vec3 p=shaped(n);
        vec3 pt=shaped(normalize(n+t*0.01));
        vec3 pb=shaped(normalize(n+b*0.01));
        vN=normalize(normalMatrix*normalize(cross(pt-p,pb-p)));
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        vP=mv.xyz; vD=disp(n);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vN; varying vec3 vP; varying float vD;
      void main(){
        vec3 n=normalize(vN); vec3 v=normalize(-vP);
        vec3 key=normalize(vec3(0.6,0.8,0.6)); vec3 fill=normalize(vec3(-0.9,-0.3,0.2));
        float d=max(dot(n,key),0.0)*0.85+max(dot(n,fill),0.0)*0.2;
        float s=pow(max(dot(reflect(-key,n),v),0.0),60.0);
        float f=pow(1.0-max(dot(n,v),0.0),3.0);
        vec3 film=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+vD*1.4+f*0.8));
        vec3 c=mix(uColor*0.08,uColor*0.9,d)+s*0.9+f*mix(uColor,film,0.65);
        gl_FragColor=vec4(c,1.0);
      }`,
  });
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, phone ? 28 : 56),
    material,
  );
  scene.add(mesh);

  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  let pointer = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    pointer = {
      x: e.clientX / innerWidth - 0.5,
      y: e.clientY / innerHeight - 0.5,
    };
  });
  let playing = false;
  ime.onPlayback((p) => (playing = p.playing));

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const travel =
      scrollY /
      Math.max(1, document.documentElement.scrollHeight - innerHeight);
    uniforms.uTime.value += dt * (still ? 0.1 : playing ? 2.2 : 0.8);
    uniforms.uAmp.value +=
      ((playing ? 0.42 : 0.22) - uniforms.uAmp.value) * 0.04;
    mesh.rotation.y += dt * (playing ? 0.3 : 0.12);
    mesh.rotation.z += (pointer.x * 0.4 - mesh.rotation.z) * 0.03;
    mesh.rotation.x += (pointer.y * 0.5 - mesh.rotation.x) * 0.03;
    // the sculpture drifts from beside the title to the middle as the page goes by
    const side = phone ? 0 : 1.15 * (1 - Math.min(travel * 3, 1));
    mesh.position.x += (side - mesh.position.x) * 0.06;
    mesh.position.y = phone ? 0.5 - travel * 0.6 : 0.15 - travel * 0.3;
    const scale = (phone ? 0.78 : 1) * (1 + travel * 0.25);
    mesh.scale.setScalar(scale);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  frame();
}
