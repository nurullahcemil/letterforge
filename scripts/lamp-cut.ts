// Dumps cuts of the shade near one flat side to JSON (for comparing with the original by eye).
import fs from 'node:fs';
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const m = buildLamp(wasm, (x: any) => x, { ...DEFAULTS, lampShow: 'shade', ...over } as any, []).pieces[0].m;
// a triangle's flat side faces -x here (corner at angle 0) → rotate so it faces +y like the original
const r = m.rotate([0, 0, -90]);
const out: any = { horiz: {}, vert: {} };
for (const z of JSON.parse(process.argv[3] ?? '[85.4, 86.5, 87.5]')) out.horiz[z] = r.slice(z).toPolygons();
for (const x of [0, 0.6, 1.2]) out.vert[x] = r.rotate([0, 90, 0]).slice(x).toPolygons(); // plane x = const
fs.writeFileSync(process.argv[4] ?? 'cut.json', JSON.stringify(out));
