// Outlines for quiz visuals -> build/shapes.json. ids: "c:792" (country, ISO numeric, world-atlas) or "s:48" (US state FIPS, us-atlas).
// Each shape is projected around its own centre in km, so shapes drawn at one px-per-km scale compare truthfully.
import fs from 'fs'; import { feature } from 'topojson-client';
const ep = JSON.parse(fs.readFileSync('build/episode.json')); const ids = new Set();
for (const q of ep.questions || []) for (const id of (q.visual && q.visual.ids) || []) ids.add(id);
const W = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json')), U = JSON.parse(fs.readFileSync('node_modules/us-atlas/states-10m.json'));
const src = { c: feature(W, W.objects.countries).features, s: feature(U, U.objects.states).features };
const R = 6371, rad = d => d * Math.PI / 180, wrap = d => ((d + 540) % 360) - 180, out = {};
const ringArea = r => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += rad(wrap(r[i + 1][0] - r[i][0])) * (2 + Math.sin(rad(r[i][1])) + Math.sin(rad(r[i + 1][1]))); return Math.abs(a * R * R / 2); };
for (const id of ids) { const [k, code] = id.split(':'); const f = src[k].find(f => String(+f.id) === String(+code)); if (!f) throw new Error('shape not found: ' + id);
  let polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map(p => ({ r: p[0], a: ringArea(p[0]) })).sort((a, b) => b.a - a.a);
  const cen = p => { let x = 0, y = 0; const l0 = p.r[0][0]; for (const q of p.r) { x += wrap(q[0] - l0); y += q[1]; } return [l0 + x / p.r.length, y / p.r.length]; };
  const c0 = cen(polys[0]); const dist = p => { const c = cen(p); return Math.hypot(wrap(c[0] - c0[0]) * Math.cos(rad(c0[1])), c[1] - c0[1]) * 111; };
  polys = polys.filter((p, i) => i === 0 || (p.a > polys[0].a * .012 && dist(p) < 2600));
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const lat0 = c0[1];
  const paths = polys.map(p => p.r.map(q => { const x = R * rad(wrap(q[0] - c0[0])) * Math.cos(rad(lat0)), y = -R * rad(q[1] - lat0); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); return [x, y]; }));
  const step = Math.max(1, Math.round(paths.reduce((a, p) => a + p.length, 0) / 900));
  out[id] = { w: x1 - x0, h: y1 - y0, paths: paths.map(p => p.filter((_, i) => i % step === 0 || i === p.length - 1).map(([x, y]) => [+(x - (x0 + x1) / 2).toFixed(1), +(y - (y0 + y1) / 2).toFixed(1)])) }; }
fs.writeFileSync('build/shapes.json', JSON.stringify(out)); console.log(Object.keys(out).length, 'shapes');
