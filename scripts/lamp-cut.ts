// Dumps cuts of the shade near one flat side to JSON (for comparing with the original by eye).
import fs from 'node:fs';
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const pc = buildLamp(wasm, (x: any) => x, { ...DEFAULTS, lampShow: 'shade', ...over } as any, []).pieces[0];
// a triangle's flat side faces -x here (corner at angle 0) → rotate so it faces +y like the original
const rs = [pc.m, ...(pc.extra ?? [])].map((m) => m.rotate([0, 0, -90]));
const sl = (f: (m: any) => any, c: number) => rs.flatMap((m) => f(m).slice(c).toPolygons());
const out: any = { horiz: {}, vert: {} };
for (const z of JSON.parse(process.argv[3] ?? '[85.4, 86.5, 87.5]')) out.horiz[z] = sl((m) => m, z);
for (const x of [0, 0.6, 1.2]) out.vert[x] = sl((m) => m.rotate([0, 90, 0]), x); // plane x = const
fs.writeFileSync(process.argv[4] ?? 'cut.json', JSON.stringify(out));
