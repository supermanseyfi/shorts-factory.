// Extracts country outlines around Türkiye from Natural Earth (world-atlas) into build/map.json
import fs from 'fs'; import { feature } from 'topojson-client';
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
const fc = feature(topo, topo.objects.countries);
const ep = JSON.parse(fs.readFileSync(process.argv[2])); const [cx, cy] = ep.map.center; const sp = 22 / (ep.map.scale || 1); const box = [cx - sp, cy - sp / 2, cx + sp, cy + sp / 2];
const out = [];
for (const f of fc.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys) {
    const ring = p[0];
    if (!ring.some(([x, y]) => x > box[0] && x < box[2] && y > box[1] && y < box[3])) continue;
    out.push({ id: f.id, name: f.properties.name, ring: ring.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]) });
  }
}
fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/map.json', JSON.stringify(out));
console.log(out.length, 'map polygons');
