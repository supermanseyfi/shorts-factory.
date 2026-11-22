// Kız Kulesi story: one hand-built 3D scene (tower, Bosphorus, skyline, ferries, gulls, people) filmed per narration segment.
import * as THREE from 'three';
const W = 1080, H = 1920;
const ep = await fetch('/build/episode.json').then(r => r.json());
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, t0, d) => clamp((t - t0) / d);
const eio = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const eout = x => 1 - Math.pow(1 - x, 3);
const eback = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function rng(seed) { let s = seed; return () => (s = (s * 16807 + 11) % 2147483647) / 2147483647; }
function hash(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, 1), hash(i + 1, 1), u); }
const fbm1 = x => vnoise(x) * .55 + vnoise(x * 2.3 + 7) * .3 + vnoise(x * 5.1 + 3) * .15;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const C = h => new THREE.Color(h);

const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xffc08a, 0.00042);
const camera = new THREE.PerspectiveCamera(38, W / H, 0.3, 30000);
const sun = new THREE.DirectionalLight(0xffffff, 2); scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbcd7ff, 0x35414d, 1); scene.add(hemi);

// ---------- textures ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const stoneTex = (base, seed, rep) => canvasTex(256, 256, (g, w, h) => {
  const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) {
    const o = (y % 2) * 26; g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${r() * .09})`; g.fillRect(x * 52 - o, y * 32, 50, 30);
    g.strokeStyle = 'rgba(60,45,30,.16)'; g.strokeRect(x * 52 - o, y * 32, 52, 32);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(40,30,20,${r() * .08})`; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 6); }
}, rep);
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0, flatShading: true, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cyl = (r1, r2, h, n, mat, x, y, z) => mesh(new THREE.CylinderGeometry(r1, r2, h, n), mat, x, y, z);

// ---------- sky ----------
const skyU = { uTop: { value: C(0) }, uHor: { value: C(0) }, uLow: { value: C(0) }, uSunDir: { value: V3(0, 1, 0) }, uSunCol: { value: C(0) }, uNight: { value: 0 }, uDisc: { value: 1 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(15000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.); }`,
  fragmentShader: `uniform vec3 uTop,uHor,uLow,uSunDir,uSunCol; uniform float uNight,uDisc; varying vec3 vP;
  float h3(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
  void main(){ vec3 d=normalize(vP-cameraPosition); float y=d.y;
    vec3 col=mix(uHor,uTop,pow(max(y,0.),.42)); if(y<0.) col=mix(uHor,uLow,clamp(-y*6.,0.,1.));
    float s=max(dot(d,uSunDir),0.);
    col+=uSunCol*(smoothstep(.99955,.9998,s)*4.*uDisc+pow(s,400.)*.9+pow(s,24.)*.35+pow(s,4.)*.12);
    vec3 g=floor(d*260.); float st=step(.9972,h3(g))*step(.05,y)*uNight; col+=vec3(st)*(.5+.5*h3(g+1.));
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }` }));
scene.add(sky);
const cloudTex = canvasTex(256, 128, (g, w, h) => { const r = rng(5); for (let i = 0; i < 26; i++) { const x = 40 + r() * 176, y = 46 + r() * 36, rad = 18 + r() * 34; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.34)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
const clouds = []; { const r = rng(11);
  for (let i = 0; i < 26; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: .8 }));
    const a = r() * Math.PI * 2, d = 5200 + r() * 3200; m.position.set(Math.sin(a) * d, 520 + r() * 1500, -Math.cos(a) * d); const s = 1500 + r() * 2200; m.scale.set(s, s * .36, 1); m.userData.v = 6 + r() * 8; scene.add(m); clouds.push(m); } }

// ---------- water ----------
const watU = { uT: { value: 0 }, uTop: skyU.uTop, uHor: skyU.uHor, uSunDir: skyU.uSunDir, uSunCol: skyU.uSunCol, uDeep: { value: C(0x0b3a52) }, uFog: { value: .00042 }, uGl: { value: 1 } };
const water = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.ShaderMaterial({
  transparent: true, uniforms: watU, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.); }`,
  fragmentShader: `uniform float uT,uFog,uGl; uniform vec3 uTop,uHor,uSunDir,uSunCol,uDeep; varying vec3 vP;
  vec2 wv(vec2 p,vec2 d,float k,float w,float a){ float c=cos(dot(d,p)*k+w*uT); return d*k*a*c; }
  void main(){ vec2 p=vP.xz; float dist=length(cameraPosition-vP); float fa=exp(-dist*.0022), fb=exp(-dist*.012);
    vec2 g=wv(p,normalize(vec2(1.,.3)),.045,.9,.34)+wv(p,normalize(vec2(-.4,1.)),.07,1.1,.24)+wv(p,normalize(vec2(.7,-.6)),.13,1.5,.16)
      +fa*(wv(p,normalize(vec2(.2,1.)),.33,2.1,.14)+wv(p,normalize(vec2(-1.,.4)),.52,2.6,.09)+wv(p,normalize(vec2(.9,.8)),.8,3.1,.06))
      +fb*(wv(p,normalize(vec2(-.6,-1.)),1.7,4.,.035)+wv(p,normalize(vec2(1.,-.2)),2.9,5.2,.022)+wv(p,normalize(vec2(.3,1.)),4.7,6.5,.014));
    vec3 N=normalize(vec3(-g.x,1.,-g.y)); vec3 V=normalize(cameraPosition-vP); vec3 R=reflect(-V,N); R.y=abs(R.y);
    vec3 skyc=mix(uHor,uTop,pow(R.y,.42)); float fr=.03+.97*pow(1.-max(dot(N,V),0.),5.);
    float s=max(dot(R,uSunDir),0.); float spec=pow(s,600.)*9.+pow(s,90.)*1.0+pow(s,14.)*.1;
    vec3 col=mix(uDeep,skyc,fr)+uSunCol*spec*uGl;
    float f=1.-exp(-pow(dist*uFog,1.6)*1.0); col=mix(col,uHor,clamp(f,0.,1.));
    gl_FragColor=vec4(col,mix(.86,1.,clamp(f*3.+fr*.4,0.,1.)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }` }));
water.rotation.x = -Math.PI / 2; water.renderOrder = 5; scene.add(water);

// mirrored copy under the water = cheap reflection
function withMirror(g) { const root = new THREE.Group(); root.add(g); const m = g.clone(true); m.scale.y = -1; m.traverse(o => { if (o.isMesh && o.userData.noMirror) o.visible = false; }); root.add(m); root.userData.main = g; root.userData.mir = m; return root; }

// ---------- the tower ----------
const cream = M(0xf2e8d2, { map: stoneTex('#f2e8d2', 3, [2, 2]) }), creamD = M(0xd9ccb0), tile = M(0xb5512f), lead = M(0x6c7c88, { roughness: .55, metalness: .35, flatShading: false });
const rockM = M(0xb3aa98, { map: stoneTex('#a59c8a', 9, [3, 1]) }), quayM = M(0xe7dcc4, { map: stoneTex('#e7dcc4', 5, [6, 1]) });
const winM = new THREE.MeshStandardMaterial({ color: 0x1b2a3a, emissive: 0xffb04a, emissiveIntensity: 0, roughness: .4 });
const lampM = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffd27a, emissiveIntensity: 0 });
function archWin(g, x, y, z, w, h, ry) { const m = box(w, h, .25, winM, x, y, z); m.rotation.y = ry; g.add(m); const top = cyl(w / 2, w / 2, .25, 12, winM, x, y + h / 2, z); top.rotation.set(ry ? 0 : Math.PI / 2, 0, ry ? Math.PI / 2 : 0); g.add(top); }
const flagTex = canvasTex(256, 170, (g, w, h) => { g.fillStyle = '#e30a17'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.arc(96, 85, 42, 0, 7); g.fill(); g.fillStyle = '#e30a17'; g.beginPath(); g.arc(107, 85, 34, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5 + .3; g.lineTo(150 + Math.cos(a) * 21, 85 + Math.sin(a) * 21); } g.fill(); });
let flag, beam, lanternGlow;
function buildTower() {
  const g = new THREE.Group(), r = rng(21);
  g.add(box(50, 9, 44, quayM, 0, -1.4, 0)); g.add(cyl(30, 36, 5, 16, rockM, 0, -2.2, 0));
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 25 + r() * 7; const m = mesh(new THREE.DodecahedronGeometry(1.6 + r() * 2.6, 0), rockM, Math.cos(a) * d, .4 + r() * 1.2, Math.sin(a) * d); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = .6; g.add(m); }
  g.add(box(46, 2.6, 40, quayM, 0, 3.4, 0));                               // terrace, top y=4.7
  for (const [w, d, x, z] of [[46, .7, 0, 19.7], [46, .7, 0, -19.7], [.7, 40, 22.7, 0], [.7, 40, -22.7, 0]]) g.add(box(w, 1.1, d, creamD, x, 5.2, z));
  g.add(box(8, .5, 5, quayM, 0, 2.2, 22.5));                               // little landing stage
  // long low building with tile roof
  g.add(box(24, 7.4, 15, cream, -5, 8.4, 0));
  const roof = mesh(new THREE.ConeGeometry(1, 1, 4), tile, -5, 14.1, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(26.5 / 1.414, 4.2, 17.5 / 1.414); g.add(roof);
  g.add(box(25.2, .5, 16.2, creamD, -5, 12.1, 0));
  for (let i = 0; i < 6; i++) { archWin(g, -15 + i * 4, 8.4, 7.55, 1.5, 2.6, 0); archWin(g, -15 + i * 4, 8.4, -7.55, 1.5, 2.6, 0); }
  for (let i = 0; i < 3; i++) archWin(g, -17.05, 8.4, -4 + i * 4, 1.5, 2.6, Math.PI / 2);
  // main tower
  const tx = 9;
  g.add(box(11, 21, 11, cream, tx, 15.2, 0));                              // top y=25.7
  g.add(box(12.2, .7, 12.2, creamD, tx, 25.9, 0));
  for (const yy of [10, 15.5, 21]) for (const [dx, dz, ry] of [[0, 5.55, 0], [0, -5.55, 0], [5.55, 0, Math.PI / 2], [-5.55, 0, Math.PI / 2]]) if (!(dx < 0 && yy < 13)) archWin(g, tx + dx, yy, dz, 1.7, 2.8, ry);
  g.add(box(14.4, .5, 14.4, creamD, tx, 26.4, 0));                         // balcony
  const rail = M(0x2c3540); for (const [w, d, x, z] of [[14.4, .15, 0, 7.1], [14.4, .15, 0, -7.1], [.15, 14.4, 7.1, 0], [.15, 14.4, -7.1, 0]]) { g.add(box(w, .12, d, rail, tx + x, 27.9, z)); g.add(box(w, .08, d, rail, tx + x, 27.3, z)); }
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { g.add(box(.12, 1.3, .12, rail, tx - 7.1 + i * 2.03, 27.3, s * 7.1)); g.add(box(.12, 1.3, .12, rail, tx + s * 7.1, 27.3, -7.1 + i * 2.03)); }
  g.add(cyl(4.3, 4.6, 6.4, 8, cream, tx, 29.8, 0));                        // lantern stage, top y=33
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; const m = box(1.3, 3, .3, winM, tx + Math.sin(a) * 4.25, 30, Math.cos(a) * 4.25); m.rotation.y = a; g.add(m); }
  g.add(cyl(5.4, 5.1, .5, 8, creamD, tx, 33.2, 0));
  const dome = mesh(new THREE.LatheGeometry([[5.3, 0], [4.9, .9], [3.9, 2.1], [2.5, 3.4], [1.3, 5], [.6, 6.8], [.28, 8.6], [0, 8.9]].map(p => new THREE.Vector2(p[0], p[1])), 20), lead, tx, 33.4, 0); g.add(dome);
  g.add(cyl(.12, .2, 3.2, 6, M(0xc9a13b, { metalness: .6, roughness: .4 }), tx, 43.6, 0));
  g.add(cyl(.09, .09, 9, 6, M(0xdddddd), tx, 49, 0));
  flag = mesh(new THREE.PlaneGeometry(5.2, 3.4, 10, 1), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: .8 }), tx + 2.7, 51.6, 0); flag.userData.noMirror = true; g.add(flag);
  lanternGlow = mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, fog: false }), tx, 30, 0); lanternGlow.userData.noMirror = true; g.add(lanternGlow);
  return g;
}
const towerRoot = withMirror(buildTower()); scene.add(towerRoot);
flag = towerRoot.userData.main.children.find(o => o.material && o.material.map === flagTex);
lanternGlow = towerRoot.userData.main.children.find(o => o.material && o.material.isMeshBasicMaterial);
// lighthouse beam
beam = new THREE.Group(); { const m = new THREE.Mesh(new THREE.ConeGeometry(34, 420, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
  m.rotation.z = Math.PI / 2; m.position.x = 210; beam.add(m); beam.position.set(9, 30, 0); scene.add(beam); }

// ---------- ancient rock (≈400 BC) and Byzantine wooden tower (1110) ----------
const woodM = M(0x7a5234), woodD = M(0x4f331f), sailM = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#eadfc4'; g.fillRect(0, 0, w, h); g.fillStyle = '#a8322a'; g.fillRect(0, 48, w, 30); }), side: THREE.DoubleSide, roughness: 1 });
function bareRock() { const g = new THREE.Group(), r = rng(33); g.add(cyl(24, 33, 9, 14, rockM, 0, -1.2, 0)); for (let i = 0; i < 34; i++) { const a = r() * 6.28, d = r() * 27; const m = mesh(new THREE.DodecahedronGeometry(2 + r() * 3.4, 0), rockM, Math.cos(a) * d, 2.2 + r() * 1.6 - d * .05, Math.sin(a) * d); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = .55; g.add(m); } return g; }
const ancient = (() => { const g = bareRock();
  g.add(box(9, 4.4, 7, M(0xcfc3a6, { map: stoneTex('#cfc3a6', 8, [2, 1]) }), 0, 6.3, 0)); const rf = mesh(new THREE.ConeGeometry(1, 1, 4), tile, 0, 9.6, 0); rf.rotation.y = Math.PI / 4; rf.scale.set(7.4, 2.2, 6); g.add(rf);
  g.add(box(1.4, 2.4, .3, winM, 0, 5.4, 3.55));
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) g.add(cyl(.35, .4, 4.4, 8, M(0xe6dcc6), s * 3.4, 6.3, 4.6 - i * 0));
  g.add(box(9.6, .5, 2.6, M(0xe6dcc6), 0, 8.7, 4.4));
  g.add(box(10, .6, 5, woodM, 0, 2.3, 22)); for (let i = 0; i < 4; i++) g.add(cyl(.3, .3, 4, 6, woodD, -4 + i * 2.7, .6, 24));
  return withMirror(g); })(); scene.add(ancient);
let chain;
const byz = (() => { const g = bareRock();
  g.add(cyl(13, 14.5, 6, 12, M(0xb9ae98, { map: stoneTex('#b9ae98', 4, [5, 1]) }), 0, 5.6, 0));
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.add(box(2.6, 1.3, 1.2, M(0xb9ae98), Math.cos(a) * 13.4, 9.2, Math.sin(a) * 13.4)); g.children.at(-1).rotation.y = -a + Math.PI / 2; }
  g.add(box(8.5, 15, 8.5, woodM, 0, 16, 0)); for (let i = 0; i < 6; i++) g.add(box(8.8, .25, 8.8, woodD, 0, 9.5 + i * 2.5, 0));
  for (const s of [-1, 1]) for (const q of [-1, 1]) g.add(box(.5, 15.4, .5, woodD, s * 4.3, 16, q * 4.3));
  g.add(box(11, .5, 11, woodD, 0, 23.7, 0)); for (const [w, d, x, z] of [[11, .3, 0, 5.4], [11, .3, 0, -5.4], [.3, 11, 5.4, 0], [.3, 11, -5.4, 0]]) g.add(box(w, 1.4, d, woodM, x, 24.6, z));
  const rf = mesh(new THREE.ConeGeometry(1, 1, 4), woodD, 0, 28.2, 0); rf.rotation.y = Math.PI / 4; rf.scale.set(8.2, 5, 8.2); g.add(rf); g.add(box(6.5, 3, 6.5, woodM, 0, 25.4, 0));
  g.add(box(1.2, 1.8, .3, winM, 0, 19, 4.3)); g.add(box(1.2, 1.8, .3, winM, 0, 13, -4.3));
  return withMirror(g); })(); scene.add(byz);
{ // iron chain from the rock toward the far (European) shore
  const n = 420, geo = new THREE.TorusGeometry(.9, .26, 6, 10); chain = new THREE.InstancedMesh(geo, M(0x33373c, { metalness: .7, roughness: .5, flatShading: false }), n); const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { const u = i / (n - 1), z = -14 - u * 620, sag = Math.sin(Math.min(u * 9, 1) * Math.PI / 2); const y = lerp(11, .55, sag) + Math.sin(u * 40) * .05; d.position.set(-6 + u * 30, y, z); d.rotation.set(i % 2 ? Math.PI / 2 : 0, i % 2 ? 0 : Math.PI / 2, 0); d.updateMatrix(); chain.setMatrixAt(i, d.matrix); }
  scene.add(chain); }

// ---------- boats ----------
function hullShape(L, Wd, blunt = .25) { const s = new THREE.Shape(), a = L / 2, b = Wd / 2; s.moveTo(-a, -b * .8); s.quadraticCurveTo(-a - L * .03, 0, -a, b * .8); s.lineTo(a * blunt, b); s.quadraticCurveTo(a * .8, b * .75, a, 0); s.quadraticCurveTo(a * .8, -b * .75, a * blunt, -b); s.closePath(); return s; }
function hull(L, Wd, h, mat, y, blunt) { const g = new THREE.ExtrudeGeometry(hullShape(L, Wd, blunt), { depth: h, bevelEnabled: false, curveSegments: 8 }); g.rotateX(-Math.PI / 2); return mesh(g, mat, 0, y, 0); }
const wakeTex = canvasTex(128, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2 - 10, 0); g.lineTo(w / 2 + 10, 0); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.globalCompositeOperation = 'destination-out'; const r = rng(4); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${r() * .5})`; g.fillRect(r() * w, r() * h, 3 + r() * 9, 2 + r() * 14); } });
const fWhite = M(0xf6f4ee), fBlack = M(0x1d2630), fWin = M(0x26384a, { roughness: .3 }), fYel = M(0xf0b83a), fRed = M(0xc8372c);
function buildFerry(seed) { const g = new THREE.Group(), r = rng(seed);
  g.add(hull(46, 9.6, 1.6, fBlack, -.6)); g.add(hull(46.4, 10, 2.0, fWhite, 1.0)); g.add(hull(46.6, 10.2, .25, fRed, .85));
  g.add(box(32, 2.9, 8.4, fWhite, -2.5, 4.4, 0)); g.add(box(32.1, 1.1, 8.5, fWin, -2.5, 4.7, 0));
  for (let i = 0; i < 15; i++) g.add(box(.35, 1.2, 8.56, fWhite, -17.5 + i * 2.15, 4.7, 0));
  g.add(box(34, .3, 9.6, fWhite, -2.5, 6.0, 0));
  g.add(box(22, 2.6, 7, fWhite, -4, 7.4, 0)); g.add(box(22.1, 1, 7.1, fWin, -4, 7.7, 0)); for (let i = 0; i < 10; i++) g.add(box(.35, 1.1, 7.16, fWhite, -14 + i * 2.2, 7.7, 0));
  g.add(box(24, .25, 8, fWhite, -4, 8.8, 0));
  g.add(box(5.5, 2.4, 5.6, fWhite, 5.5, 10.1, 0)); g.add(box(5.6, .9, 5.7, fWin, 5.7, 10.5, 0)); g.add(box(6.4, .25, 6.4, fWhite, 5.5, 11.4, 0));
  const fn = cyl(1.5, 1.7, 5, 12, fYel, -6, 11.6, 0); fn.rotation.z = .12; g.add(fn); const ft = cyl(1.55, 1.55, 1.1, 12, fBlack, -6.35, 14.3, 0); ft.rotation.z = .12; g.add(ft);
  g.add(cyl(.1, .1, 6, 5, fWhite, 6, 14.5, 0)); g.add(cyl(.08, .08, 3.4, 5, fWhite, -21, 4.6, 0));
  const fl = mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide }), -22.3, 5.6, 0); g.add(fl);
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { const lr = cyl(.55, .55, .25, 10, i % 3 ? fRed : fYel, -14 + i * 3, 3.2, s * 5.02); lr.rotation.x = Math.PI / 2; g.add(lr); }
  // passengers on the open decks
  const pr = rng(seed * 7); for (let i = 0; i < 26; i++) { const p = person(pr, false, .9); p.position.set(-16 + pr() * 30, i % 2 ? 6.15 : 8.92, (pr() < .5 ? -1 : 1) * (i % 2 ? 4.4 : 3.7)); p.rotation.y = pr() * 6; p.scale.setScalar(1.15); g.add(p); }
  const root = withMirror(g);
  const wk = mesh(new THREE.PlaneGeometry(26, 120), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, opacity: .8 }), -80, .12, 0); wk.rotation.x = -Math.PI / 2; wk.rotation.z = -Math.PI / 2; wk.renderOrder = 6; root.add(wk);
  const bw = mesh(new THREE.PlaneGeometry(14, 30), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, opacity: .7 }), 12, .14, 0); bw.rotation.x = -Math.PI / 2; bw.rotation.z = -Math.PI / 2; bw.renderOrder = 6; root.add(bw);
  return root; }

// ---------- people ----------
const SKIN = [0xf1c9a5, 0xe0ac86, 0xc68e63, 0x9a6a45], CLOTH = [0xd9483b, 0x2f6fb5, 0xf2c14e, 0x3d9a6b, 0xf5f1e8, 0x333b4a, 0xe07fa0, 0x7d5fb2, 0xe8873a, 0x4bb3c4], HAIR = [0x1e1611, 0x3a2617, 0x6b4a2b, 0x141414, 0xb89b6a];
const pGeo = { leg: new THREE.CylinderGeometry(.085, .075, .82, 6), torso: new THREE.CylinderGeometry(.21, .18, .62, 8), arm: new THREE.CylinderGeometry(.06, .055, .6, 5), head: new THREE.SphereGeometry(.135, 10, 8), hair: new THREE.SphereGeometry(.145, 10, 8, 0, 6.3, 0, 1.75) };
pGeo.leg.translate(0, -.41, 0); pGeo.arm.translate(0, -.3, 0);
const pMat = {}; const pm = c => pMat[c] || (pMat[c] = M(c, { flatShading: false }));
function person(r, sitting, lean = 1) { const g = new THREE.Group(), top = CLOTH[r() * CLOTH.length | 0], bot = [0x2b3445, 0x39445c, 0x5a4a3a, 0x222, 0x6e7f9c][r() * 5 | 0], sk = SKIN[r() * 4 | 0];
  const hip = sitting ? .42 : .86, L = [], A = [];
  for (const s of [-1, 1]) { const l = mesh(pGeo.leg, pm(bot), s * .1, hip, 0); if (sitting) l.rotation.x = Math.PI / 2 - .25; g.add(l); L.push(l); }
  g.add(mesh(pGeo.torso, pm(top), 0, hip + .32, 0));
  for (const s of [-1, 1]) { const a = mesh(pGeo.arm, pm(top), s * .27, hip + .58, 0); a.rotation.z = s * .12; if (sitting) a.rotation.x = .5; g.add(a); A.push(a); }
  g.add(mesh(pGeo.head, pm(sk), 0, hip + .78, 0)); const h = mesh(pGeo.hair, pm(HAIR[r() * 5 | 0]), 0, hip + .8, .012); h.rotation.x = .25; g.add(h);
  g.anim = { L, A, ph: r() * 6.28, sp: .9 + r() * .5 }; return g; }

// ---------- gulls ----------
const gullW = M(0xf4f4f0, { flatShading: false }), gullG = M(0xaab2ba, { side: THREE.DoubleSide }), gullK = M(0x23262b, { side: THREE.DoubleSide }), gullY = M(0xf2b21c);
const wingGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .16, .62, 0, .2, .6, 0, -.1, 0, 0, .16, .6, 0, -.1, 0, 0, -.14], 3)); g.computeVertexNormals(); return g; })();
const tipGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .2, .62, 0, .0, 0, 0, -.1], 3)); g.computeVertexNormals(); return g; })();
function buildGull() { const g = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(.14, 8, 6), gullW); b.scale.set(.85, .8, 2.3); g.add(b);
  g.add(mesh(new THREE.SphereGeometry(.09, 8, 6), gullW, 0, .05, .3)); const bk = mesh(new THREE.ConeGeometry(.03, .14, 5), gullY, 0, .04, .43); bk.rotation.x = Math.PI / 2; g.add(bk);
  const tl = mesh(tipGeo, gullW, 0, 0, -.3); tl.rotation.y = Math.PI / 2; tl.scale.set(.4, 1, 1.2); g.add(tl);
  const wings = []; for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * .07, .04, .05); const inn = mesh(wingGeo, gullG); inn.scale.x = s; sh.add(inn); const el = new THREE.Group(); el.position.x = s * .6; const tp = mesh(tipGeo, gullK); tp.scale.x = s; el.add(tp); sh.add(el); g.add(sh); wings.push([sh, el, s]); }
  g.userData.wings = wings; return g; }
const gulls = []; { const r = rng(77);
  for (let i = 0; i < 46; i++) { const g = buildGull(); const near = i < 10; g.scale.setScalar(near ? 2.4 : 2.9); scene.add(g);
    gulls.push({ g, cx: near ? 0 : 9 + (r() - .5) * 60, cz: near ? 0 : (r() - .5) * 60, rx: near ? 20 + r() * 26 : 26 + r() * 150, rz: 0, h: near ? 6 + r() * 16 : 14 + r() * 60, w: (r() < .5 ? -1 : 1) * (.16 + r() * .22) * (near ? 1.4 : 1), ph: r() * 6.28, fl: 5 + r() * 4, bob: 1 + r() * 4, near }); }
  for (const q of gulls) q.rz = q.rx * (.6 + r() * .5); }

// ---------- Üsküdar shore: steps, promenade, people, lamps, houses ----------
const shore = new THREE.Group(); scene.add(shore);
const walkers = [], sitters = [];
{ const r = rng(404), pave = M(0xb9b1a3, { map: stoneTex('#b9b1a3', 6, [120, 3]) }), stepM = M(0xa59c8c, { map: stoneTex('#a59c8c', 2, [140, 1]) });
  shore.add(box(1800, 6, 600, M(0x6d6a5e), 0, .4, 516));
  for (let i = 0; i < 4; i++) shore.add(box(1800, .8, 2, stepM, 0, .5 + i * .8, 209 + i * 2));   // steps: tops at y=.9,1.7,2.5,3.3
  shore.add(box(1800, .3, 16, pave, 0, 3.45, 225));                                             // promenade top y=3.6
  shore.add(box(1800, .25, 12, M(0x3c3f45), 0, 3.5, 239));                                       // road
  const cush = [0xd9483b, 0x2f6fb5, 0xf2c14e, 0x3d9a6b, 0xe07fa0, 0xe8873a, 0x7d5fb2];
  for (let i = 0; i < 150; i++) { const row = r() * 3 | 0, x = (i < 110 ? -55 + r() * 110 : -170 + r() * 340); shore.add(box(1.1, .16, .9, M(cush[r() * 7 | 0]), x, 1.0 + row * .8, 208.6 + row * 2));
    if (r() < .62) { const p = person(r, true); p.position.set(x, .9 + row * .8, 208.9 + row * 2); p.rotation.y = (r() - .5) * .5; shore.add(p); sitters.push(p);
      if (r() < .45) { const q = person(r, true); q.position.set(x + .62, .9 + row * .8, 208.9 + row * 2); q.rotation.y = (r() - .5) * .6; shore.add(q); sitters.push(q); } } }
  for (let i = 0; i < 44; i++) { const p = person(r, false); const dir = r() < .5 ? 1 : -1; p.anim.x0 = -170 + r() * 340; p.anim.z0 = 219 + r() * 9; p.anim.dir = dir; p.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; shore.add(p); walkers.push(p); }
  // fishermen
  for (let i = 0; i < 7; i++) { const p = person(r, false); p.position.set(-120 + i * 38 + r() * 10, 3.6, 217.2); shore.add(p); const rod = cyl(.02, .035, 5.2, 4, M(0x2a2a2a), p.position.x, 6.0, 215.3); rod.rotation.x = -.85; shore.add(rod); }
  // simit carts
  for (const x of [-46, 38, 104]) { const g = new THREE.Group(); g.add(box(2.2, 1, 1.2, M(0xc9302c), 0, 1, 0)); g.add(box(2.3, 1.1, 1.3, new THREE.MeshStandardMaterial({ color: 0xcfe8f2, transparent: true, opacity: .45 }), 0, 2.05, 0)); g.add(box(2.6, .12, 1.6, M(0xc9302c), 0, 2.7, 0));
    for (let i = 0; i < 9; i++) { const s = mesh(new THREE.TorusGeometry(.16, .06, 5, 9), M(0xb9772f), -.8 + (i % 5) * .4, 1.7 + (i / 5 | 0) * .3, .1); s.rotation.x = 1.2; g.add(s); }
    for (const s of [-1, 1]) { const wl = cyl(.4, .4, .08, 12, M(0x222), s * .8, .4, .7); wl.rotation.x = Math.PI / 2; g.add(wl); }
    const v = person(r, false); v.position.set(.2, 0, 1.6); v.rotation.y = Math.PI; g.add(v); g.position.set(x, 3.6, 228); shore.add(g); }
  for (let i = 0; i < 17; i++) { const x = -240 + i * 30; shore.add(cyl(.09, .13, 5.4, 6, M(0x23272c), x, 6.3, 234.2)); shore.add(mesh(new THREE.SphereGeometry(.42, 10, 8), lampM, x, 9.2, 234.2)); shore.add(box(1.8, .5, .6, M(0x5b4634), x + 7, 4.0, 233.4)); }
  // houses and trees behind
  const hw = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#31404f'; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) g.fillRect(8 + x * 19, 8 + y * 19, 10, 13); });
  const cols = [0xe9dcc3, 0xd9b48f, 0xc7d3d9, 0xe6c4b0, 0xf0ead6, 0xbfa58a, 0xd3c0a8];
  for (let i = 0; i < 110; i++) { const x = -640 + r() * 1280, row = r() * 4 | 0, z = 252 + row * 22 + r() * 8, w = 9 + r() * 9, hh = 8 + r() * 12 + row * 3, d = 9 + r() * 6; const t = hw.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.round(w / 6), Math.round(hh / 6)); t.needsUpdate = true;
    shore.add(box(w, hh, d, M(cols[r() * 7 | 0], { map: t }), x, 3.6 + row * 5 + hh / 2, z)); const rf = mesh(new THREE.ConeGeometry(1, 1, 4), tile, x, 3.6 + row * 5 + hh + 1.2, z); rf.rotation.y = Math.PI / 4; rf.scale.set(w * .78, 2.4, d * .78); shore.add(rf); }
  shore.add(box(1800, 22, 300, M(0x5d6a4f), 0, 6, 450));
  const leaf = M(0x3f6b3f), leaf2 = M(0x2f5a3a); for (let i = 0; i < 90; i++) { const x = -640 + r() * 1280, z = 244 + r() * 90, s = 2.2 + r() * 2.6; shore.add(cyl(.25, .3, 3, 5, woodD, x, 5, z)); const c = mesh(new THREE.IcosahedronGeometry(s, 0), r() < .5 ? leaf : leaf2, x, 7.6 + s * .5, z); c.scale.y = 1.25; shore.add(c); }
  // a small mosque on the shore (left)
  shore.add(mosque(-250, 3.6, 262, 9, 1, M(0xe3d8c2), lead));
}
function mosque(x, y, z, s, nm, wall, domeM) { const g = new THREE.Group(); g.add(box(2.6 * s, 1.5 * s, 2.6 * s, wall, 0, .75 * s, 0)); g.add(cyl(1.15 * s, 1.2 * s, .4 * s, 12, wall, 0, 1.7 * s, 0));
  g.add(mesh(new THREE.SphereGeometry(1.15 * s, 14, 8, 0, 6.3, 0, Math.PI / 2), domeM, 0, 1.9 * s, 0));
  for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(mesh(new THREE.SphereGeometry(.5 * s, 10, 6, 0, 6.3, 0, Math.PI / 2), domeM, a * .95 * s, 1.5 * s, b * .95 * s));
  const pos = [[1.7, 1.5], [-1.7, 1.5], [1.7, -1.5], [-1.7, -1.5], [2.6, 0], [-2.6, 0]].slice(0, nm);
  for (const [a, b] of pos) { g.add(cyl(.11 * s, .14 * s, 4.6 * s, 8, wall, a * s, 2.3 * s, b * s)); g.add(cyl(.2 * s, .2 * s, .12 * s, 8, wall, a * s, 3.3 * s, b * s)); g.add(mesh(new THREE.ConeGeometry(.15 * s, 1.1 * s, 8), domeM, a * s, 5.15 * s, b * s)); }
  g.position.set(x, y, z); return g; }

// ---------- far shore: the old city and Galata ----------
const far = new THREE.Group(), farModern = new THREE.Group(); scene.add(far); far.add(farModern);
const hillH = x => (x < 330 && x > -3600 ? (16 + 62 * fbm1(x * .0016 + 4)) * clamp((330 - x) / 420) * clamp((x + 3600) / 500) : 0) + (x > 620 && x < 3800 ? (20 + 80 * fbm1(x * .0015 + 30)) * clamp((x - 620) / 360) * clamp((3800 - x) / 600) : 0);
{ const hillM = M(0x4f5f55), hillB = M(0x5d6c66);
  for (const [z, k, mat] of [[-1880, 1, hillM], [-2150, 1.5, hillB]]) { const s = new THREE.Shape(); s.moveTo(-3700, -5); for (let x = -3700; x <= 3900; x += 40) s.lineTo(x, hillH(x) * k + (k > 1 ? 10 * clamp(hillH(x)) : 0)); s.lineTo(3900, -5); const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 260, bevelEnabled: false }), mat, 0, 0, z - 260); far.add(m); }
  const r = rng(909), n = 1500, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M(0xd8cdb8), n), rm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M(0xa8563a), n), d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { let x; do { x = -3500 + r() * 7200; } while (hillH(x) < 6); const depth = r(), w = 14 + r() * 26, h = 8 + r() * 16; const y = hillH(x) * (.25 + depth * .85);
    d.position.set(x, y + h / 2 - 2, -1878 - depth * 200); d.scale.set(w, h, 14); d.updateMatrix(); im.setMatrixAt(i, d.matrix); const c = C([0xd8cdb8, 0xc9b79c, 0xe6dccb, 0xb9a890][r() * 4 | 0]); im.setColorAt(i, c);
    d.position.y = y + h - 1; d.scale.set(w + 1, 2.4, 15); d.updateMatrix(); rm.setMatrixAt(i, d.matrix); }
  farModern.add(im, rm);
  const mw = M(0xcfc6b4), md = M(0x77858e, { flatShading: false });
  farModern.add(mosque(-560, hillH(-560) * .95, -1960, 30, 4, mw, md));     // Hagia Sophia
  farModern.add(mosque(-980, hillH(-980) * .95, -1990, 28, 6, mw, md));     // Blue Mosque
  farModern.add(mosque(-1900, hillH(-1900) * 1.0, -2010, 30, 4, mw, md));   // Süleymaniye
  farModern.add(mosque(-2700, hillH(-2700), -2000, 22, 2, mw, md));
  farModern.add(mosque(1750, hillH(1750) * .5, -1930, 14, 2, mw, md));
  { const g = new THREE.Group(); g.add(cyl(11, 12, 52, 12, mw, 0, 26, 0)); g.add(cyl(13, 11, 6, 12, mw, 0, 55, 0)); g.add(mesh(new THREE.ConeGeometry(12, 26, 12), md, 0, 71, 0)); g.position.set(1280, hillH(1280) * .9, -1990); farModern.add(g); } // Galata Tower
  { const g = new THREE.Group(); g.add(box(14, 40, 14, mw, 0, 20, 0)); g.add(mesh(new THREE.ConeGeometry(11, 22, 4), md, 0, 51, 0)); g.position.set(-150, hillH(-150), -1950); farModern.add(g); }             // Topkapı tower
  // trees on the ancient shore
  const tr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M(0x3c5a44), 500); for (let i = 0; i < 500; i++) { let x; do { x = -3500 + r() * 7200; } while (hillH(x) < 6); const s = 12 + r() * 16; d.position.set(x, hillH(x) * (.3 + r() * .7) + s * .3, -1876 - r() * 120); d.scale.set(s, s * 1.2, s); d.updateMatrix(); tr.setMatrixAt(i, d.matrix); } far.add(tr); far.userData.trees = tr;
}

// ---------- ferries, rowing boat, galleys ----------
const ferries = [buildFerry(3), buildFerry(5), buildFerry(8), buildFerry(13)];
const FPATH = [[[-900, -150], [900, -260], 150, 60], [[500, -80], [-700, -120], 150, 9], [[-1500, -700], [1500, -560], 260, 60], [[1300, -1100], [-1300, -1000], 280, 200]];
ferries.forEach(f => scene.add(f));
const rowboat = (() => { const g = new THREE.Group(); g.add(hull(6.4, 1.9, .75, woodM, -.15, 0)); g.add(hull(5.9, 1.5, .1, woodD, .5, 0)); for (const x of [-1, .6]) g.add(box(.35, .08, 1.6, woodM, x, .52, 0));
  const r = rng(51); const p = person(r, true); p.position.set(-1, .12, 0); p.rotation.y = -Math.PI / 2; p.scale.setScalar(1.05); g.add(p);
  const oars = []; for (const s of [-1, 1]) { const o = new THREE.Group(); o.position.set(-.5, .7, s * .9); const st = cyl(.035, .035, 3.2, 5, woodD, 0, 0, s * 1.2); st.rotation.x = Math.PI / 2; o.add(st); o.add(box(.5, .04, .7, woodM, 0, 0, s * 2.7)); g.add(o); oars.push([o, s]); }
  g.add(basket(1.9, .55, 0, .8)); g.oars = oars; return withMirror(g); })(); scene.add(rowboat);
function basket(x, y, z, s) { const g = new THREE.Group(), r = rng(8); g.add(cyl(.55, .4, .5, 12, M(0xb98a4b, { map: stoneTex('#b98a4b', 12, [4, 2]) }), 0, .25, 0)); { const rim = mesh(new THREE.TorusGeometry(.56, .05, 5, 14), M(0x8c6534), 0, .5, 0); rim.rotation.x = Math.PI / 2; g.add(rim); }
  const fc = [0xd9342b, 0xf2a01e, 0x8a2be2, 0xe8c11c, 0x7a1e3a, 0x8fbf3a]; for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = r() * .38; g.add(mesh(new THREE.SphereGeometry(.13 + r() * .06, 8, 6), M(fc[r() * 6 | 0], { flatShading: false, roughness: .5 }), Math.cos(a) * d, .52 + r() * .12, Math.sin(a) * d)); }
  g.position.set(x, y, z); g.scale.setScalar(s); return g; }
// close-up basket with the snake, on the tower's terrace
const closeup = new THREE.Group(); scene.add(closeup); closeup.position.set(-8, 4.7, 16.5);
closeup.add(basket(0, 0, 0, 2.2)); closeup.add(box(3.2, .04, 3.2, M(0x9c2f3a), 0, .02, 0));
const snakeM = M(0x3f7d2c, { flatShading: false, roughness: .45 }), snake = []; for (let i = 0; i < 26; i++) { const m = mesh(new THREE.SphereGeometry(1, 10, 8), i % 4 === 2 ? M(0x2a5a1e, { flatShading: false }) : snakeM); closeup.add(m); snake.push(m); }
const snakeEyes = [0, 1].map(() => { const m = mesh(new THREE.SphereGeometry(.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd21a })); closeup.add(m); return m; });
const tongue = box(.02, .02, .3, new THREE.MeshBasicMaterial({ color: 0xff3046 })); closeup.add(tongue);
function buildGalley(seed) { const g = new THREE.Group(); g.add(hull(27, 5, 2.4, woodM, -.7, .1)); g.add(hull(25.6, 4.2, .15, woodD, 1.6, .1));
  const prow = cyl(.3, .45, 6, 6, woodD, 13.6, 3.2, 0); prow.rotation.z = -.5; g.add(prow); const stern = cyl(.25, .4, 7, 6, woodD, -13.6, 3.8, 0); stern.rotation.z = .55; g.add(stern);
  g.add(cyl(.2, .26, 15, 6, woodD, 1, 9, 0)); const yard = cyl(.14, .14, 13, 5, woodD, 1, 14.6, 0); yard.rotation.x = Math.PI / 2; g.add(yard);
  const sg = new THREE.PlaneGeometry(12, 9, 8, 4); const pa = sg.attributes.position; for (let i = 0; i < pa.count; i++) { const u = pa.getX(i) / 6, v = pa.getY(i) / 4.5; pa.setZ(i, (1 - u * u) * (1 - v * v * .5) * 1.5); } sg.computeVertexNormals(); const sail = mesh(sg, sailM, 1.4, 10, 0); sail.rotation.y = Math.PI / 2; g.add(sail);
  const oars = []; for (let i = 0; i < 11; i++) for (const s of [-1, 1]) { const o = new THREE.Group(); o.position.set(-9 + i * 1.8, 1.5, s * 2.3); const st = cyl(.05, .05, 7, 4, woodD, 0, -1, s * 3.2); st.rotation.x = Math.PI / 2 - s * .32; o.add(st); g.add(o); oars.push([o, s, i]); }
  const r = rng(seed); for (let i = 0; i < 6; i++) { const p = person(r, false); p.position.set(-10 + r() * 20, 1.7, (r() - .5) * 2.4); p.rotation.y = r() * 6; g.add(p); }
  for (let i = 0; i < 8; i++) g.add(cyl(.5, .4, 1.2, 8, M(0xb5683a), -7 + i * 1.1, 2.3, (i % 2 - .5) * 1.4));   // amphorae
  g.oars = oars; return withMirror(g); }
const galleys = [buildGalley(2), buildGalley(6)]; galleys.forEach(g => scene.add(g));

// ---------- looks ----------
const PRE = {
  sunset: { top: 0x2c4a8c, hor: 0xffa35c, low: 0x12304a, deep: 0x0d3550, sunCol: 0xffb060, el: 5.5, az: -4, sunI: 2.5, hemiI: 1.25, hs: 0xffd3b0, hg: 0x43506a, fog: .00036, night: 0, cl: .9, clc: 0xffc7a0, ex: 1.1, win: .35, lamp: .6 },
  sunset2: { top: 0x26306e, hor: 0xff8246, low: 0x101f3c, deep: 0x0c2a46, sunCol: 0xff9148, el: 2.2, az: -7, sunI: 2.0, hemiI: 1.1, hs: 0xffbfa0, hg: 0x3a4666, fog: .00036, night: .15, cl: .9, clc: 0xff9f85, ex: 1.12, win: .9, lamp: 1.6 },
  golden: { top: 0x2f6fc2, hor: 0xf3d2a8, low: 0x14405c, deep: 0x0a4f74, sunCol: 0xfff0d0, el: 24, az: 115, sunI: 3.0, hemiI: 1.25, hs: 0xdbeaff, hg: 0x4d5a66, fog: .00026, night: 0, cl: .85, clc: 0xffffff, ex: 1.05, win: 0, lamp: 0 },
  day: { top: 0x2470c8, hor: 0xcfe6f5, low: 0x16506e, deep: 0x0c5570, sunCol: 0xffffff, el: 46, az: 150, sunI: 3.1, hemiI: 1.3, hs: 0xdbeaff, hg: 0x4d5a50, fog: .00022, night: 0, cl: .9, clc: 0xffffff, ex: 1.0, win: 0, lamp: 0 },
  overcast: { top: 0x7d8e9e, hor: 0xc8d0d4, low: 0x2c4654, deep: 0x1f4656, sunCol: 0xcfd6da, el: 40, az: -20, sunI: 1.3, hemiI: 1.7, hs: 0xdfe6ea, hg: 0x4d5458, fog: .00055, night: 0, cl: 1, clc: 0xdde3e6, ex: .95, win: 0, lamp: 0, disc: 0 },
  dusk: { top: 0x1c1f58, hor: 0xd76a6e, low: 0x0e1836, deep: 0x0d2440, sunCol: 0xff7a5a, el: -1.5, az: -6, sunI: .9, hemiI: 1.05, hs: 0xc9a9d8, hg: 0x2e3558, fog: .00042, night: .5, cl: .8, clc: 0xd98aa0, ex: 1.1, win: 1.6, lamp: 0 },
  night: { top: 0x040818, hor: 0x1a2c58, low: 0x040a16, deep: 0x06162a, sunCol: 0xcfe0ff, el: 26, az: -24, sunI: .85, hemiI: .75, hs: 0x6f8fd8, hg: 0x101830, fog: .0003, night: 1, cl: .25, clc: 0x4a5f96, ex: 1.25, win: 2.6, lamp: 0 },
  night2: { top: 0x070d26, hor: 0x2a3f78, low: 0x060c1c, deep: 0x081a32, sunCol: 0xdfe8ff, el: 30, az: 30, sunI: .9, hemiI: .85, hs: 0x7f9be0, hg: 0x141c36, fog: .0003, night: 1, cl: .3, clc: 0x566ba8, ex: 1.3, win: 2.2, lamp: 0 },
  dawn: { top: 0x3a66b0, hor: 0xffc9b8, low: 0x163a54, deep: 0x10445e, sunCol: 0xffd9c0, el: 9, az: 150, sunI: 2.2, hemiI: 1.3, hs: 0xffe1d6, hg: 0x4b566a, fog: .00038, night: 0, cl: .9, clc: 0xffd0c8, ex: 1.05, win: .5, lamp: 0 },
};
function setLook(k) { const p = PRE[k]; skyU.uTop.value.set(p.top); skyU.uHor.value.set(p.hor); skyU.uLow.value.set(p.low); watU.uDeep.value.set(p.deep);
  const el = p.el * Math.PI / 180, az = p.az * Math.PI / 180; skyU.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  skyU.uSunCol.value.set(p.sunCol); skyU.uNight.value = p.night; skyU.uDisc.value = p.disc ?? 1; watU.uFog.value = p.fog * 1.0; watU.uGl.value = p.night > .9 ? .55 : 1;
  sun.color.set(p.sunCol); sun.intensity = p.sunI; sun.position.copy(skyU.uSunDir.value).multiplyScalar(1000); if (p.el < 3) sun.position.y = 120;
  hemi.color.set(p.hs); hemi.groundColor.set(p.hg); hemi.intensity = p.hemiI; scene.fog.color.set(p.hor); scene.fog.density = p.fog; renderer.toneMappingExposure = p.ex;
  winM.emissiveIntensity = p.win; lampM.emissiveIntensity = p.lamp; for (const c of clouds) { c.material.opacity = p.cl * .8; c.material.color.set(p.clc); } }

// ---------- shots ----------
const TW = V3(6, 22, 0);
const SHOTS = [
  { look: 'sunset', mode: 'now', cam: u => { const e = eout(u); camera.fov = 40; camera.position.set(lerp(-34, -18, e), lerp(3.2, 9, e), lerp(150, 92, e)); return V3(6, lerp(30, 36, e), 0); } },
  { look: 'golden', mode: 'now', cam: u => { const a = lerp(.95, .35, u); camera.fov = 40; camera.position.set(Math.sin(a) * 400, lerp(170, 125, u), Math.cos(a) * 400); return V3(0, 10, -20); } },
  { look: 'dusk', mode: 'legend', cam: u => { const a = lerp(-.5, -.15, u); camera.fov = 34; camera.position.set(Math.sin(a) * 105, lerp(4, 30, eio(u)), Math.cos(a) * 105); return V3(8, lerp(12, 31, eio(u)), 0); } },
  { look: 'night', mode: 'legend', cam: u => { camera.fov = 36; camera.position.set(lerp(70, 40, u), lerp(9, 6, u), lerp(250, 200, u)); return V3(4, 26, 0); } },
  { look: 'dawn', mode: 'boat', cam: () => null },
  { look: 'day', mode: 'ancient', cam: u => { camera.fov = 38; const gx = galleyX(u); camera.position.set(gx - 30 + u * 24, lerp(5, 9, u), 108); return V3(lerp(gx, 0, .45), 6, 20); } },
  { look: 'overcast', mode: 'byz', cam: u => { const e = eio(u); camera.fov = 38; camera.position.set(lerp(13, 62, e), lerp(3.4, 17, e), lerp(-150, -92, e)); return V3(lerp(0, 0, e), lerp(3, 15, e), lerp(-80, 0, e)); } },
  { look: 'night2', mode: 'ottoman', cam: u => { const a = lerp(.35, .75, u); camera.fov = 38; camera.position.set(Math.sin(a) * 150, lerp(12, 20, u), Math.cos(a) * 150); return V3(6, 24, 0); } },
  { look: 'sunset', mode: 'now', cam: u => { camera.fov = 42; camera.position.set(lerp(-12, 6, u), 7.0, lerp(233, 231.5, u)); return V3(lerp(0, 6, u), lerp(-7, -5, u), 0); } },
  { look: 'sunset2', mode: 'now', cam: u => { const e = eout(u); camera.fov = 40; camera.position.set(lerp(30, 60, e), lerp(14, 70, e), lerp(250, 330, e)); return V3(0, lerp(18, 6, e), 0); } },
];
const galleyX = u => lerp(-70, 22, u);
function vis(root, v) { root.visible = v; }
const d3 = new THREE.Object3D();
function animate(t, si, u) {
  const sh = SHOTS[si], mode = sh.mode; setLook(sh.look);
  const now = mode === 'now', legend = mode === 'legend' || mode === 'boat', nightish = PRE[sh.look].night > .9;
  vis(towerRoot, mode !== 'ancient' && mode !== 'byz'); vis(ancient, mode === 'ancient'); vis(byz, mode === 'byz'); chain.visible = mode === 'byz';
  shore.visible = now; ferries.forEach(f => f.visible = now); farModern.visible = mode !== 'ancient' && mode !== 'byz'; far.userData.trees.visible = !farModern.visible;
  galleys.forEach(g => g.visible = mode === 'ancient'); rowboat.visible = mode === 'boat'; closeup.visible = false; beam.visible = mode === 'ottoman';
  flag.visible = now; lanternGlow.material.opacity = mode === 'ottoman' ? .95 : 0;
  watU.uT.value = t; for (const c of clouds) c.position.x += 0;
  // flag
  { const pa = flag.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) + 2.6; pa.setZ(i, Math.sin(x * 1.6 - t * 6) * .09 * x); } pa.needsUpdate = true; }
  // ferries
  ferries.forEach((f, i) => { const [a, b, T, off] = FPATH[i], k = ((t + off) / T) % 1, x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k); f.position.set(x, Math.sin(t * .9 + i) * .12, z); f.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); f.rotation.z = Math.sin(t * .7 + i * 2) * .012; });
  // gulls
  for (const q of gulls) { const a = q.ph + t * q.w, g = q.g; g.visible = !nightish && mode !== 'boat' || (mode === 'boat' && !q.near);
    if (nightish) g.visible = false;
    const x = q.cx + Math.cos(a) * q.rx, z = q.cz + Math.sin(a) * q.rz, y = q.h + Math.sin(t * .5 + q.ph * 3) * q.bob;
    g.position.set(x, y, z); const dx = -Math.sin(a) * q.rx * q.w, dz = Math.cos(a) * q.rz * q.w; g.rotation.set(0, Math.atan2(dx, dz), 0); g.rotateZ(-q.w * 1.2);
    const cyc = (t * .23 + q.ph) % 1, flap = cyc < .62 ? Math.sin(t * q.fl * 1.5 + q.ph) : .25 + Math.sin(t * 1.3 + q.ph) * .08;
    for (const [shd, el, s] of g.userData.wings) { shd.rotation.z = s * (flap * .55 + .08); el.rotation.z = s * (flap * .5 - .18); } }
  // people
  for (const p of walkers) { const d = p.anim; const span = 150, x = ((d.x0 + d.dir * t * 1.25 * d.sp + 75) % span + span) % span - 75; p.position.set(x, 3.6 + Math.abs(Math.sin(t * 5.2 * d.sp + d.ph)) * .035, d.z0); const sw = Math.sin(t * 5.2 * d.sp + d.ph) * .55; d.L[0].rotation.x = sw; d.L[1].rotation.x = -sw; d.A[0].rotation.x = -sw * .7; d.A[1].rotation.x = sw * .7; }
  
  // galleys
  galleys.forEach((g, i) => { const x = i ? galleyX(u) + 70 : galleyX(u); g.position.set(x, Math.sin(t * 1.1 + i) * .15, i ? -90 : 62); g.rotation.z = Math.sin(t * .8 + i) * .015; for (const [o, s, k] of g.userData.main.oars) { const ph = t * 2.6 + k * .12; o.rotation.y = Math.sin(ph) * .42 * s; o.rotation.x = s * Math.max(0, Math.cos(ph)) * .16; } });
  // beam
  beam.rotation.y = t * .55;
  // camera
  let look;
  if (mode === 'boat') {
    if (u < .56) { const v = u / .56, bz = lerp(150, 44, v), bx = lerp(-34, -6, v); rowboat.position.set(bx, Math.sin(t * 1.4) * .08, bz); const hd = Math.atan2(-(44 - 150), (-6 + 34)); rowboat.rotation.y = hd; rowboat.rotation.z = Math.sin(t * 1.2) * .03;
      for (const [o, s] of rowboat.userData.main.oars) { const ph = t * 2.4; o.rotation.y = Math.sin(ph) * .5 * s; o.rotation.x = s * Math.max(0, Math.cos(ph)) * .22; }
      camera.fov = 46; camera.position.set(bx - 12 + v * 4, 7, bz + 27); look = V3(bx + 4, 2.5, bz - 30); }
    else { const v = (u - .56) / .44; rowboat.visible = false; closeup.visible = true; camera.fov = 30; const a = lerp(-.5, -.1, eio(v)), cd = 11.5;
      camera.position.set(closeup.position.x + Math.sin(a) * cd, closeup.position.y + lerp(3.4, 4.2, v), closeup.position.z + Math.cos(a) * cd); look = V3(closeup.position.x, closeup.position.y + lerp(1.6, 2.4, eio(v)), closeup.position.z);
      const rise = eout(prog(v, .34, .36)); for (let i = 0; i < snake.length; i++) { const k = i / (snake.length - 1), len = rise * 2.5, s = k * len; const up = Math.min(s, 1.5), fw = Math.max(0, s - 1.5);
        const sway = Math.sin(t * 3 + k * 4) * .13 * k * rise; snake[i].position.set(.2 + sway + Math.sin(k * 7) * .1 * (1 - k), 1.05 + up * (.72) - (1 - rise) * 1.1, .15 + fw * .75 + Math.cos(k * 6) * .08);
        const r0 = (i === snake.length - 1 ? .15 : lerp(.11, .095, k)); snake[i].scale.set(r0, r0 * (i === snake.length - 1 ? .75 : 1), r0 * (i === snake.length - 1 ? 1.35 : 1)); snake[i].visible = rise > .02; }
      const hd = snake.at(-1).position; snakeEyes.forEach((e, i) => { e.position.set(hd.x + (i ? .08 : -.08), hd.y + .07, hd.z + .1); e.visible = rise > .3; }); tongue.position.set(hd.x, hd.y - .02, hd.z + .28 + Math.sin(t * 20) * .05); tongue.visible = rise > .7 && Math.sin(t * 9) > 0; }
  } else look = sh.cam(u);
  // tiny handheld drift
  camera.position.x += Math.sin(t * .7) * .12; camera.position.y += Math.sin(t * .9 + 1) * .08;
  camera.updateProjectionMatrix(); camera.lookAt(look); sky.position.copy(camera.position);
}

// ---------- HUD ----------
const segs = ep.segments, ERAS = ['ISTANBUL', ...ep.items.map(i => i.era), ''];
$('title').innerHTML = ep.title.map(l => `<div>${l}</div>`).join(''); $('outro').innerHTML = ep.outroLines.map(l => `<div>${l}</div>`).join('');
const chunks = []; for (const s of segs) { let cur = []; for (const w of s.words) { cur.push(w); if (cur.length >= 3 || /[.!?,:;]$/.test(w.w)) { chunks.push(cur); cur = []; } } if (cur.length) chunks.push(cur); }
let lastChunk = null;
function hud(t, si, u) {
  const s = segs[si], d = s.end - s.start, lt = t - s.start;
  $('dip').style.opacity = si === 0 ? 1 - prog(t, 0, .35) : (lt < .16 ? (1 - lt / .16) * .85 : 0);
  $('grade').style.opacity = SHOTS[si].mode === 'legend' || SHOTS[si].mode === 'boat' ? .9 : 0;
  $('old').style.opacity = ['ancient', 'byz', 'ottoman'].includes(SHOTS[si].mode) ? 1 : 0;
  const era = $('era'); era.firstChild.textContent = ERAS[si]; era.style.opacity = ERAS[si] && si > 0 ? prog(lt, .15, .3) * (1 - prog(lt, d - .25, .2)) : 0; era.style.transform = `translateY(${(1 - eout(prog(lt, .15, .4))) * -30}px)`;
  const ti = $('title'); ti.style.opacity = si === 0 ? prog(t, .25, .3) * (1 - prog(t, s.end - .35, .3)) : 0; ti.style.transform = `scale(${lerp(.86, 1, eback(prog(t, .25, .5)))})`;
  const last = si === segs.length - 1, ou = $('outro'); ou.style.opacity = last ? prog(lt, .2, .35) : 0; ou.style.transform = `scale(${lerp(.86, 1, eback(prog(lt, .2, .5)))})`;
  const ch = chunks.find(c => t >= c[0].t0 - .05 && t < c.at(-1).t1 + .22), cap = $('cap');
  if (ch !== lastChunk) { cap.innerHTML = ch ? ch.map(w => `<span>${w.w.toUpperCase()}</span>`).join('') : ''; lastChunk = ch; }
  if (ch) { const tw = ch.reduce((a, w) => a + w.w.length, 0); cap.style.fontSize = tw > 21 ? '52px' : tw > 16 ? '60px' : '70px';
    [...cap.children].forEach((el, i) => { const w = ch[i], on = t >= w.t0 && t < w.t1 + .04, done = t >= w.t1; el.style.color = on ? '#ffd24d' : done ? '#fff' : 'rgba(255,255,255,.55)'; el.style.transform = `translateY(${on ? -8 : 0}px)`; }); }
}
window.EP = { duration: ep.duration, segments: segs.map(s => [s.start, s.end]) };
window.renderFrame = t => { let si = segs.findIndex(s => t < s.end); if (si < 0) si = segs.length - 1; const s = segs[si], u = clamp((t - s.start) / (s.end - s.start)); animate(t, si, u); hud(t, si, u); renderer.render(scene, camera); };
await document.fonts.ready; window.renderFrame(0); window.READY = true;
