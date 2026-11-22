// Extracts country outlines around Türkiye from Natural Earth (world-atlas) into build/map.json
import fs from 'fs'; import { feature } from 'topojson-client';
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
const fc = feature(topo, topo.objects.countries);
const ep = JSON.parse(fs.readFileSync(process.argv[2])); const [cx, cy] = ep.map.center; const sp = 22 / (ep.map.scale || 1); const box = [cx - sp, cy - sp / 2, cx + sp, cy + sp / 2];
if (ep.map.frame) { const f = ep.map.frame, m = 8; box[0] = Math.min(box[0], f[0] - m); box[1] = Math.min(box[1], f[1] - m); box[2] = Math.max(box[2], f[2] + m); box[3] = Math.max(box[3], f[3] + m); }   // neighbours around the overview frame
const out = [];
for (const f of fc.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys) {
    let ring = p[0];
    if (p.length > 1 && ring.every(([, y]) => y < -89)) ring = [...p[1].slice(0, -1), [180, -89.9], [-180, -89.9]];   // Antarctica: the coast is stored as the second ring
    if (!ring.some(([x, y]) => x > box[0] && x < box[2] && y > box[1] && y < box[3])) continue;
    out.push({ id: f.id, name: f.properties.name, ring: ring.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]) });
  }
}
fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/map.json', JSON.stringify(out));
console.log(out.length, 'map polygons');
