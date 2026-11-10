// How many print lines each layer of the shade wall needs: measures the wall width in level slices
// (as the slicer sees it) every 1 mm of height. 0.42 mm = 1 line with a 0.4 mm nozzle.
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const p = { ...DEFAULTS, lampShow: 'shade', ...over } as any;
const pc = buildLamp(wasm, (x: any) => x, p, []).pieces[0];
const all = [pc.m, ...(pc.extra ?? [])];
const H = Math.max(...all.map((m) => m.boundingBox().max[2]));
const area = (q: number[][]) => Math.abs(q.reduce((a, s, i) => { const r = q[(i + 1) % q.length]; return a + s[0] * r[1] - r[0] * s[1]; }, 0)) / 2;
const counts: Record<string, number> = {};
const rows: string[] = [];
for (let z = 15.1; z < H - 0.3; z += 1) {
  const polys = all.flatMap((m) => m.slice(z).toPolygons()).sort((a, b) => area(b) - area(a));
  if (polys.length < 2) continue;
  // wall width ≈ (outer area − inner area) / mean perimeter
  const per = (q: number[][]) => q.reduce((a, s, i) => { const r = q[(i + 1) % q.length]; return a + Math.hypot(r[0] - s[0], r[1] - s[1]); }, 0);
  const o = polys[0], i = polys[1];
  // perimeter of the wavy line is long; use the plain loop length (area-equivalent) is unreliable, so measure directly
  const w = (area(o) - area(i)) / ((per(o) + per(i)) / 2);
  const lines = w <= 0.5 ? '1 line' : w <= 0.9 ? '2 lines' : '3+ lines';
  counts[lines] = (counts[lines] ?? 0) + 1;
  rows.push(`z${z.toFixed(0).padStart(3)} ${w.toFixed(2)} mm ${lines}`);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(Object.entries(counts).map(([k, v]) => `${k}: ${Math.round((100 * v) / total)}% of height`).join(', '));
console.log(rows.filter((r) => !r.endsWith('1 line')).join('\n'));
