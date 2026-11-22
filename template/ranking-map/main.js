import * as THREE from 'three';
const W = 1080, H = 1920;
const [ep, map] = await Promise.all([fetch('/build/episode.json').then(r => r.json()), fetch('/build/map.json').then(r => r.json())]);
const $ = id => document.getElementById(id);

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, t0, d) => clamp((t - t0) / d);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eout = x => 1 - Math.pow(1 - x, 3);
const eback = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function hash(x, y, s) { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v);
}
function fbm(x, y, s, o = 4) { let a = .5, f = 1, r = 0; for (let i = 0; i < o; i++) { r += a * vnoise(x * f, y * f, s + i * 13); a *= .5; f *= 2; } return r; }
function ridged(x, y, s, o = 4) { let a = .5, f = 1, r = 0; for (let i = 0; i < o; i++) { const n = 1 - Math.abs(2 * vnoise(x * f, y * f, s + i * 7) - 1); r += a * n * n; a *= .5; f *= 2.1; } return r; }
function rng(seed) { let s = seed; return () => (s = (s * 16807 + 11) % 2147483647) / 2147483647; }
const [CLON, CLAT] = ep.map.center, KX = Math.cos(CLAT * Math.PI / 180), HI = new Set(ep.map.highlight || []), LOC = ep.lang || 'en-US';
const MS = ep.map.scale || 1;   // world units per degree (use ~0.12 for whole-world topics)
const P = (lon, lat) => new THREE.Vector3((lon - CLON) * KX * MS, 0, -(lat - CLAT) * MS);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#2a4f7a');
scene.fog = new THREE.FogExp2(HORIZON, 0.028);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 400);

// sky dome
{
  const g = new THREE.SphereGeometry(180, 32, 24); const c = [];
  const top = new THREE.Color('#040816'), mid = new THREE.Color('#0d2146'), hor = new THREE.Color('#3a6798'), glow = new THREE.Color('#f3a35c');
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 180, x = pos.getX(i) / 180;
    const col = new THREE.Color();
    if (y > .25) col.lerpColors(mid, top, clamp((y - .25) / .5)); else col.lerpColors(hor, mid, clamp((y + .02) / .27));
    const w = clamp(1 - Math.abs(y) * 7) * clamp((-x - .2) * 1.2);   // warm glow low in the west
    col.lerp(glow, w * .55); c.push(col.r, col.g, col.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, toneMapped: false })));
}
scene.add(new THREE.HemisphereLight('#a9ccff', '#0d1a2e', 1.15));
const key = new THREE.DirectionalLight('#ffd9a6', 2.6); key.position.set(-6, 5, 4); scene.add(key);
const rim = new THREE.DirectionalLight('#58c8ff', 1.1); rim.position.set(6, 3, -6); scene.add(rim);

// sea + graticule
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#061a33', roughness: .35, metalness: .3 })));
{
  const pts = [];
  const st = Math.max(1, Math.round(1 / MS)), sp = Math.round(22 / MS), a = Math.round(CLON) - sp, b = Math.max(-88, Math.round(CLAT) - sp / 2), b2 = Math.min(88, b + sp);
  for (let lon = a; lon <= a + 2 * sp; lon += st) pts.push(P(lon, b).setY(.004), P(lon, b2).setY(.004));
  for (let lat = b; lat <= b2; lat += st) pts.push(P(a, lat).setY(.004), P(a + 2 * sp, lat).setY(.004));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#3f86c9', transparent: true, opacity: .16 })));
}
// land
const LAND = new THREE.Color('#1f6a6e');
let trRing = null; const hiRings = [];
const shapeOf = ring => { const s = new THREE.Shape(); ring.forEach(([lo, la], i) => { const p = P(lo, la); i ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z); }); return s; };
const otherMat = new THREE.MeshStandardMaterial({ color: '#0f2c4a', roughness: .95 });
const trMat = new THREE.MeshStandardMaterial({ color: LAND, roughness: .85, metalness: .05 });
const trSide = new THREE.MeshStandardMaterial({ color: '#0e3d4a', roughness: .9 });
for (const poly of map) {
  const isTR = HI.has(poly.id);
  const g = new THREE.ExtrudeGeometry(shapeOf(poly.ring), { depth: isTR ? .16 : .035, bevelEnabled: false }).rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(g, isTR ? [trMat, trSide] : otherMat));
  if (isTR) {
    hiRings.push(poly.ring); if (!trRing || poly.ring.length > trRing.length) trRing = poly.ring;
    const pts = poly.ring.map(([lo, la]) => P(lo, la).setY(.168));
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8ff3ff', transparent: true, opacity: .95 })));
  }
}
const GROUND = 0.16;
function inTR(lon, lat) { let c = false; for (const r of hiRings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if ((r[i][1] > lat) !== (r[j][1] > lat) && lon < (r[j][0] - r[i][0]) * (lat - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; }
// lakes (hand-placed stylised)
for (const [lon, lat, rx, rz, rot] of (ep.map.lakes || [])) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0b3f78', roughness: .2, metalness: .4 }));
  m.scale.set(rx, 1, rz); m.rotation.y = rot; m.position.copy(P(lon, lat)).setY(GROUND + .004); scene.add(m);
}
if (!trRing) { const xs = ep.items.map(i => i.lon), ys = ep.items.map(i => i.lat); trRing = [[Math.min(...xs) - 3, Math.min(...ys) - 2], [Math.max(...xs) + 3, Math.max(...ys) + 2]]; }
const BB = ep.map.frame || trRing.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [999, 999, -999, -999]);
// relief hills (instanced), clustered with noise
{
  const r = rng(7), g = new THREE.ConeGeometry(1, 1, 5, 1).translate(0, .5, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), list = [];
  const avoid = ep.items.map(i => P(i.lon, i.lat));
  for (let k = 0; k < 9000 && list.length < 1100; k++) {
    const lon = BB[0] + r() * (BB[2] - BB[0]), lat = BB[1] + r() * (BB[3] - BB[1]); if (!inTR(lon, lat)) continue;
    const east = fbm(lon * .35, lat * .35, 11), dens = .08 + 1.1 * fbm(lon * .9, lat * .9, 3) * east;
    if (r() > dens) continue;
    const p = P(lon, lat); if (avoid.some(a => a.distanceTo(p) < .5)) continue;
    const h = (.03 + .16 * r() * r()) * (.6 + east * 1.0) * clamp(MS, .3, 1), w = h * (1.2 + r());   // smaller relief on zoomed-out maps
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
    list.push(m4.clone().compose(p.setY(GROUND - .002), q.clone(), new THREE.Vector3(w, h, w)));
  }
  const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#2a7f78', roughness: .9, flatShading: true }), list.length);
  list.forEach((m, i) => im.setMatrixAt(i, m)); scene.add(im);
}
// glow texture
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const sprite = (color, op = 1, add = true) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));

// ---------- mountains ----------
const MAXV = Math.max(...ep.items.map(i => i.value));
const rock1 = new THREE.Color('#3b4657'), rock2 = new THREE.Color('#8b8f9a'), snow = new THREE.Color('#f4fbff'), warm = new THREE.Color('#7a5a48');
function buildMountain(it, idx) {
  if (it.style === 'column') return buildColumn(it, idx);
  const VM = it.value * (ep.metersPerUnit || 1);   // value in metres (set metersPerUnit: 0.3048 when the unit is feet)
  const Hh = it.value / MAXV * 1.3, R = it.radius || ({ volcano: .66, jagged: .68, massif: .74 }[it.style] * Math.sqrt(VM / 4000));
  const N = 72, seed = idx * 31 + 5;
  const g = new THREE.PlaneGeometry(2 * R, 2 * R, N, N).rotateX(-Math.PI / 2), pos = g.attributes.position, hs = new Float32Array(pos.count);
  let mx = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / R, z = pos.getZ(i) / R, a = Math.atan2(z, x);
    const rr = Math.hypot(x, z) * (1 + .16 * (fbm(Math.cos(a) * 1.3 + 5, Math.sin(a) * 1.3 + 5, seed) - .5));
    const b = clamp(1 - rr); let h;
    if (it.style === 'volcano') {
      h = Math.pow(b, 1.9);
      h *= 1 - .22 * Math.abs(Math.sin(a * 7 + 4 * fbm(x * 1.5, z * 1.5, seed))) * rr * b * 3;
      h += .05 * (fbm(x * 5, z * 5, seed + 1) - .5) * b;
      h = Math.min(h, .955 + .05 * vnoise(x * 9, z * 9, seed));
    } else {
      const f = it.style === 'jagged' ? 2.0 : 1.5, k = it.style === 'jagged' ? .8 : .5;
      h = Math.pow(b, 1.45) * (1 - k * .5 + k * ridged(x * f + 3, z * f + 3, seed)) + .1 * Math.pow(b, 6);
    }
    hs[i] = Math.max(0, h); mx = Math.max(mx, hs[i]);
  }
  const snowLine = clamp(.93 - (VM - 3000) / 3600, .4, .8), col = [];
  for (let i = 0; i < pos.count; i++) {
    const f = hs[i] / mx; pos.setY(i, f * Hh);
    const x = pos.getX(i), z = pos.getZ(i), n = fbm(x * 7, z * 7, seed + 9), c = new THREE.Color();
    c.lerpColors(LAND, rock1, clamp(f / .16)); c.lerp(rock2, clamp((f - .2) / .6) * .8); c.lerp(warm, n * .3 * clamp(1 - f * 1.4));
    c.lerp(snow, clamp((f - snowLine + (n - .5) * .22) / .07));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  const mesh = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .82, metalness: 0 }));
  const grp = new THREE.Group(); grp.add(mesh); grp.position.copy(P(it.lon, it.lat)).setY(GROUND - .001);
  // peak position
  let pk = new THREE.Vector3(); for (let i = 0; i < pos.count; i++) if (hs[i] === mx) pk.set(pos.getX(i), Hh, pos.getZ(i));
  const dot = sprite(it.rank <= 3 ? '#ffd24d' : '#7ff0ff', 1); dot.position.copy(pk); grp.add(dot);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1, 6).translate(0, .5, 0), new THREE.MeshBasicMaterial({ color: it.rank <= 3 ? '#ffd24d' : '#7ff0ff', transparent: true, opacity: .9, fog: false }));
  beam.position.copy(pk); grp.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8ff3ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.position.y = .012; grp.add(ring);
  const halo = sprite(it.rank === 1 ? '#ffcf70' : '#59c9ff', 0); halo.position.set(0, Hh * .55, 0); grp.add(halo);
  const clouds = [], r = rng(seed + 3);
  for (let k = 0; k < 6; k++) { const s = sprite('#dfeeff', 0, false); s.material.fog = true; s.userData = { a: r() * 6.28, rad: R * (.45 + r() * .5), y: Hh * (.28 + r() * .35), sp: (.05 + r() * .08) * (r() > .5 ? 1 : -1), sc: R * (.55 + r() * .6) }; grp.add(s); clouds.push(s); }
  // snow / dust burst
  const NP = 140, pp = new Float32Array(NP * 3), pv = [];
  for (let k = 0; k < NP; k++) { const a = r() * 6.28, sp = .25 + r() * .9; pv.push([Math.cos(a) * sp, .5 + r() * 1.6, Math.sin(a) * sp, r()]); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex, color: '#e8f7ff', size: .05, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending }));
  grp.add(pts);
  scene.add(grp);
  return { it, grp, mesh, Hh, R, pk, dot, beam, ring, halo, clouds, pts, pv, base: grp.position.clone() };
}
function buildColumn(it, idx) {   // generic 3D bar for non-mountain rankings (cities, lakes, buildings...)
  const Hh = it.value / MAXV * 1.5, R = it.radius || .13, top = it.rank <= 3;
  const g = new THREE.CylinderGeometry(R, R * 1.08, Hh, 6).translate(0, Hh / 2, 0), col = [], pos = g.attributes.position;
  const c0 = new THREE.Color('#0d5d86'), c1 = new THREE.Color(top ? '#ffd24d' : '#7ff0ff');
  for (let i = 0; i < pos.count; i++) { const c = new THREE.Color().lerpColors(c0, c1, Math.pow(clamp(pos.getY(i) / Hh), 1.5)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .35, metalness: .2, emissive: top ? '#6b4a00' : '#0a4a66', emissiveIntensity: .7 }));
  const grp = new THREE.Group(); grp.add(mesh); grp.position.copy(P(it.lon, it.lat)).setY(GROUND - .001);
  const pk = new THREE.Vector3(0, Hh, 0), color = top ? '#ffd24d' : '#7ff0ff';
  const dot = sprite(color, 1); dot.position.copy(pk); grp.add(dot);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1, 6).translate(0, .5, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, fog: false })); beam.position.copy(pk); grp.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8ff3ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); ring.position.y = .012; grp.add(ring);
  const halo = sprite(it.rank === 1 ? '#ffcf70' : '#59c9ff', 0); halo.position.set(0, Hh * .55, 0); grp.add(halo);
  const r = rng(idx * 31 + 8), NP = 140, pv = []; for (let k = 0; k < NP; k++) { const a = r() * 6.28, sp = .25 + r() * .9; pv.push([Math.cos(a) * sp, .5 + r() * 1.6, Math.sin(a) * sp, r()]); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex, color: '#e8f7ff', size: .05, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending })); grp.add(pts);
  scene.add(grp);
  return { it, grp, mesh, Hh, R: R * 3.2, pk, dot, beam, ring, halo, clouds: [], pts, pv, base: grp.position.clone() };
}
const mts = ep.items.map(buildMountain);
// teaser beams (hook)
const teasers = ep.items.map(it => { const s = sprite('#7ff0ff', 0); s.position.copy(P(it.lon, it.lat)).setY(GROUND + .1); scene.add(s); return s; });
// drifting motes
const motes = (() => { const n = 500, a = new Float32Array(n * 3), r = rng(99), seeds = []; for (let i = 0; i < n; i++) seeds.push([r() * 22 - 11, r() * 4 + .2, r() * 12 - 6, r()]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, color: '#cfe9ff', size: .035, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(p); return { p, a, seeds }; })();

// ---------- camera choreography ----------
const segs = ep.segments;
const CB = ep.map.frame || BB, bA = P(CB[0], CB[1]), bB = P(CB[2], CB[3]), MC = bA.clone().add(bB).multiplyScalar(.5), WX = bB.x - bA.x;   // highlighted country extent
scene.fog.density = 0.028 * clamp(15 / WX, .2, 1);
const OVER_A = { pos: new THREE.Vector3(MC.x, 1.8 * WX, MC.z + 1.28 * WX), look: new THREE.Vector3(MC.x, 0, MC.z - .2 * WX), fov: 46 };
const OVER_B = { pos: new THREE.Vector3(MC.x + .08 * WX, 1.42 * WX, MC.z + 1.08 * WX), look: new THREE.Vector3(MC.x + .08 * WX, 0, MC.z - .15 * WX), fov: 46 };
const IC = mts.reduce((a, m) => a.add(m.base), new THREE.Vector3()).multiplyScalar(1 / mts.length), SP = Math.max(2.5, ...mts.map(m => m.base.distanceTo(IC)));   // items centroid / spread
const OZ = ep.map.outroZoom || 1;   // >1 pulls the outro camera back when the items are spread far apart
const OUT_A = { pos: new THREE.Vector3(IC.x + (SP * 1.25 + 2.2) * OZ, (SP * .45 + 2.2) * OZ, IC.z + (SP * .9 + 2.2) * OZ), look: new THREE.Vector3(IC.x + .6, .3, IC.z), fov: 40 };
const OUT_B = { pos: new THREE.Vector3(IC.x + (SP * 1.45 + 2.6) * OZ, (SP * .65 + 2.6) * OZ, IC.z + (SP * 1.1 + 2.8) * OZ), look: new THREE.Vector3(IC.x + .3, .3, IC.z), fov: 40 };
if (ep.map.outro === 'overview') { Object.assign(OUT_A, OVER_B); Object.assign(OUT_B, OVER_A); }   // wide maps: end on the top-down overview so every pin is in frame
function itemPose(m, k, idx) {   // k: 0..1 through the segment
  const top = m.it.rank === 1, ang = top ? -2.95 + .95 * k : (-2.1 + idx * 0.47) + .32 * k * (idx % 2 ? -1 : 1);
  const d = (2.9 * m.Hh + 3.3) * (1 - .1 * k) * (top ? 1.06 : 1), el = .30 - .05 * k;
  const c = m.base;
  return { pos: new THREE.Vector3(c.x + Math.cos(ang) * Math.cos(el) * d, GROUND + Math.sin(el) * d + m.Hh * .3, c.z + Math.sin(ang) * Math.cos(el) * d), look: new THREE.Vector3(c.x, GROUND + m.Hh * .5, c.z), fov: 30 };
}
function segPose(i, t) {
  const s = segs[i], k = prog(t, s.start, s.end - s.start);
  if (s.kind === 'hook') return mix(OVER_A, OVER_B, eout(k));
  if (s.kind === 'outro') return mix(OUT_A, OUT_B, eout(k));
  return itemPose(mts[s.item], k, s.item);
}
function mix(a, b, k) { return { pos: a.pos.clone().lerp(b.pos, k), look: a.look.clone().lerp(b.look, k), fov: lerp(a.fov, b.fov, k) }; }
const FLY = 0.85;
function cameraAt(t, i) {
  let p = segPose(i, t);
  if (i > 0 && t < segs[i].start + FLY) {
    const k = eio(prog(t, segs[i].start, FLY)), prev = segPose(i - 1, segs[i].start);
    const dist = prev.look.distanceTo(p.look);
    p = mix(prev, p, k); p.pos.y += Math.sin(k * Math.PI) * Math.min(2.2, dist * .22);
  }
  camera.position.copy(p.pos); camera.fov = p.fov;
  camera.setViewOffset(W, H, 0, H * 0.04, W, H);   // lift subject above centre (leave room for captions)
  camera.lookAt(p.look); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}

// ---------- HUD ----------
$('series').textContent = ep.series;
$('dots').innerHTML = ep.items.map(() => '<i><b></b></i>').join('');
const dotEls = [...document.querySelectorAll('#dots b')];
$('title').innerHTML = ep.title.map((l, k) => `<div style="font-size:${Math.min(k === 2 ? 176 : 118, 1160 / l.length)}px">${l}</div>`).join('');
$('outro').innerHTML = ep.outroLines.map((l, k) => `<div style="font-size:${Math.min(k ? 70 : 100, (k ? 1000 : 1200) / l.length)}px">${l}</div>`).join('');
$('pins').innerHTML = ep.items.map(i => `<div class="pin ${i.rank <= 3 ? 'g' : ''}">${i.rank}</div>`).join('');
const pinEls = [...document.querySelectorAll('.pin')];
const BMIN = ep.barMin || 0, fmt = n => Math.round(n).toLocaleString(LOC);
{ let step = Math.pow(10, Math.floor(Math.log10(MAXV - BMIN))); if ((MAXV - BMIN) / step < 3) step /= 2; const tk = []; for (let v = Math.ceil((BMIN + step * .2) / step) * step; v <= MAXV; v += step) tk.push(v);
  $('bar').insertAdjacentHTML('beforeend', tk.map(v => `<span style="left:${(v - BMIN) / (MAXV - BMIN) * 100}%">${v >= 1e6 ? v / 1e6 + 'M' : fmt(v)}</span>`).join('')); }
const set = (el, o, tf) => { el.style.opacity = o; if (tf !== undefined) el.style.transform = tf; };
// caption chunks
const chunks = [];
for (const s of segs) { let cur = []; const flush = () => { if (cur.length) { chunks.push({ words: cur, t0: cur[0].t0, t1: cur[cur.length - 1].t1 }); cur = []; } };
  for (const w of s.words) { cur.push(w); const len = cur.reduce((a, b) => a + b.w.length + 1, 0); if (/[.!?:,]$/.test(w.w) || cur.length >= 3 || len > 12) flush(); } flush(); }
chunks.forEach((c, i) => { c.end = Math.min(c.t1 + .35, i + 1 < chunks.length ? chunks[i + 1].t0 - .02 : 1e9); });
let capKey = -1;
function captions(t) {
  const i = chunks.findIndex(c => t >= c.t0 - .06 && t < c.end), el = $('cap');
  if (i < 0) { el.style.opacity = 0; return; }
  const c = chunks[i];
  if (capKey !== i) { capKey = i; el.innerHTML = c.words.map(w => `<span>${w.w.toLocaleUpperCase(LOC)}</span>`).join(''); }
  const pop = eback(prog(t, c.t0 - .06, .16));
  const L = c.words.reduce((a, b) => a + b.w.length + 1, 0); set(el, clamp(pop * 2), `scale(${(.82 + .18 * pop) * Math.min(1, 19 / L)})`);
  [...el.children].forEach((sp, k) => { const w = c.words[k], on = t >= w.t0 - .03 && (k === c.words.length - 1 || t < c.words[k + 1].t0 - .03), said = t >= w.t0 - .03;
    sp.style.color = on ? '#ffd24d' : said ? '#fff' : 'rgba(255,255,255,.55)'; sp.style.transform = `scale(${on ? 1.1 : 1}) translateY(${on ? -6 : 0}px)`; });
}
const v3 = new THREE.Vector3();
function toScreen(p) { v3.copy(p).project(camera); return [(v3.x * .5 + .5) * W, (-v3.y * .5 + .5) * H, v3.z < 1]; }

// ---------- frame ----------
function frame(t) {
  let i = segs.findIndex(s => t < s.end); if (i < 0) i = segs.length - 1;
  const s = segs[i], u = t - s.start, left = s.end - t;
  cameraAt(t, i);
  // motes
  motes.seeds.forEach((m, k) => { motes.a[k * 3] = camera.position.x * .0 + m[0] + Math.sin(t * .2 + m[3] * 9) * .4; motes.a[k * 3 + 1] = m[1] + ((t * .06 + m[3]) % 1) * .8; motes.a[k * 3 + 2] = m[2] + Math.cos(t * .17 + m[3] * 7) * .4; }); motes.p.geometry.attributes.position.needsUpdate = true;
  // mountains state
  mts.forEach((m, k) => {
    const sg = segs[k + 1], lu = t - sg.start, a = prog(lu, .28, .8), up = lu < 0 ? 0 : eback(a);
    m.grp.visible = lu > .2; m.mesh.scale.set(lerp(.55, 1, eout(a)), Math.max(.001, up), lerp(.55, 1, eout(a)));
    const cur = k === s.item && s.kind === 'item';
    const g = eout(prog(lu, .75, .5)), pulse = .75 + .25 * Math.sin(t * 5 + k);
    m.dot.position.y = m.Hh * up; m.dot.scale.setScalar((cur ? .34 : .2) * g * pulse + .0001);
    m.beam.position.y = m.Hh * up; m.beam.scale.set(1, Math.max(.001, g * (cur ? .3 : .15)), 1);
    const rp = prog(lu, .6, 1.1); m.ring.scale.setScalar(.2 + eout(rp) * m.R * 2.4); m.ring.material.opacity = rp > 0 && rp < 1 ? (1 - rp) * .9 : 0;
    m.halo.scale.setScalar(m.R * 5.5); m.halo.material.opacity = cur ? .16 * g * (m.it.rank === 1 ? 2.4 : 1) : 0;
    m.clouds.forEach(c => { const d = c.userData, an = d.a + t * d.sp; c.position.set(Math.cos(an) * d.rad, d.y, Math.sin(an) * d.rad); c.scale.set(d.sc * 1.8, d.sc * .7, 1); c.material.opacity = .2 * g; });
    const bp = prog(lu, .62, 1.6); m.pts.material.opacity = bp > 0 && bp < 1 ? (1 - bp) * .95 : 0;
    if (bp > 0 && bp < 1) { const a3 = m.pts.geometry.attributes.position, tt = bp * 1.6; m.pv.forEach((v, q) => { a3.setXYZ(q, v[0] * tt * m.R * 1.6, Math.max(0, .05 + v[1] * tt * .5 - 1.1 * tt * tt * .5 + m.Hh * .15 * v[3]), v[2] * tt * m.R * 1.6); }); a3.needsUpdate = true; }
  });
  // teaser sprites in hook
  teasers.forEach((sp, k) => { const a = s.kind === 'hook' ? prog(t, 1.0 + k * .22, .35) : 0, out = s.kind === 'hook' ? 1 : 0; sp.material.opacity = eout(a) * out * .95; const sc = .25 + .5 * eback(a) + .08 * Math.sin(t * 6 + k); sp.scale.set(sc, sc * 2.2, 1); sp.position.y = GROUND + .25; });
  renderer.render(scene, camera);

  // HUD ---------------------------------------------------
  const isItem = s.kind === 'item', it = isItem ? ep.items[s.item] : null;
  const showTop = s.kind !== 'hook' ? eout(prog(t, segs[1].start + .1, .5)) : 0;
  set($('top'), showTop * (s.kind === 'outro' ? clamp(1 - u / .4) : 1), `translateY(${(1 - showTop) * -40}px)`);
  dotEls.forEach((d, k) => { const sg = segs[k + 1]; d.style.width = (t >= sg.end ? 100 : t > sg.start ? prog(t, sg.start, sg.end - sg.start) * 100 : 0) + '%'; });
  const outK = isItem ? clamp(left / .16) : 0;
  if (isItem) {
    const a = eback(prog(u, .06, .34));
    $('rank').className = 'abs' + (it.rank <= 3 ? ' gold' : ''); $('rank').lastElementChild.textContent = it.rank;
    set($('rank'), clamp(a * 3) * outK, `scale(${lerp(2.2, 1, a)}) rotate(${(1 - a) * -6}deg)`);
    const b = eout(prog(u, .36, .4)); $('name').textContent = it.name; $('name').style.fontSize = (it.name.length > 13 ? 84 : 98) + 'px';
    set($('name'), b * outK, `translateY(${(1 - b) * 60}px)`);
    const c = eout(prog(u, .52, .4)); $('sub').textContent = it.sub; set($('sub'), c * outK, `translateY(${(1 - c) * 40}px)`);
    const nw = s.words.find(w => /^\d/.test(w.w)), n0 = nw ? nw.t0 - .25 : s.start + 1.2;
    const d = eout(prog(t, n0, .3)), cnt = eout(prog(t, n0 + .05, .95));
    $('altnum').innerHTML = `${fmt(lerp(it.value * .55, it.value, cnt))}<em>${ep.unit}</em>`;
    set($('alt'), d * outK, `translateY(${(1 - d) * 50}px) scale(${1 + .06 * Math.sin(clamp(prog(t, n0 + 1.0, .25)) * Math.PI)})`);
    $('barfill').style.width = clamp((lerp(BMIN, it.value, cnt) - BMIN) / (MAXV - BMIN)) * 100 + '%';
    const fw = s.words.findIndex(w => /,$/.test(w.w)), f0 = fw >= 0 && fw + 1 < s.words.length ? s.words[fw + 1].t0 : s.start + 1.6, e = eback(prog(t, f0, .3));
    $('fact').firstElementChild.textContent = it.fact; set($('fact'), clamp(e * 2) * outK, `scale(${.6 + .4 * e}) rotate(-2deg)`);
  } else ['rank', 'name', 'sub', 'alt', 'fact'].forEach(id => set($(id), 0));
  // title (hook)
  if (s.kind === 'hook') { const out = clamp(left / .25); [...$('title').children].forEach((d, k) => { const a = eback(prog(u, .12 + k * .16, .4)); set(d, clamp(a * 2), `translateY(${(1 - a) * 90}px) scale(${.8 + .2 * a})`); }); set($('title'), out, `scale(${1 + (1 - out) * .25})`); } else set($('title'), 0);
  // outro
  if (s.kind === 'outro') {
    [...$('outro').children].forEach((d, k) => { const a = eback(prog(u, .5 + k * .3, .4)); set(d, clamp(a * 2), `translateY(${(1 - a) * 70}px) scale(${.8 + .2 * a}) rotate(${k ? -2 : 0}deg)`); }); set($('outro'), 1);
    pinEls.forEach((p, k) => { const m = mts[k], [x, y, ok] = toScreen(v3.set(m.base.x + m.pk.x, GROUND + m.Hh + .16, m.base.z + m.pk.z).clone()); const a = eback(prog(u, .9 + (9 - k) * .07, .3)); set(p, ok ? clamp(a * 2) : 0, `translate(${x}px,${y}px) scale(${a})`); });
  } else { set($('outro'), 0); pinEls.forEach(p => set(p, 0)); }
  // flash on each transition, bigger for #1
  let fl = 0; segs.forEach((sg, k) => { if (k === 0) return; const big = sg.kind === 'item' && ep.items[sg.item].rank === 1; const x = t - (sg.start + .6); if (sg.kind === 'item' && x > -.08 && x < .5) fl = Math.max(fl, (x < 0 ? (x + .08) / .08 : 1 - x / .5) * (big ? .75 : .2)); });
  $('flash').style.opacity = fl;
  captions(t);
}
window.EP = { duration: ep.duration, segments: segs.map(s => [s.start, s.end]) };
window.renderFrame = t => { frame(t); return true; };
await document.fonts.ready; frame(0); window.READY = true;
