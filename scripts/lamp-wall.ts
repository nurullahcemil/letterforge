// Measures the shade's wall thickness (at right angles to the wall) at corners and flat sides.
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const p = { ...DEFAULTS, lampShow: 'shade', lampTex: 'none', ...over } as any;
const m = buildLamp(wasm, (x: any) => x, p, []).pieces[0].m;
const H = m.boundingBox().max[2];
for (const z of [H * 0.17, H * 0.5]) {
  const loops = m.slice(z).toPolygons();
  // distance from each outer-loop point to the nearest inner-loop segment, grouped by angle
  const byArea = loops.map((l) => ({ l, a: Math.abs(l.reduce((s, q, i) => { const r = l[(i + 1) % l.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) })).sort((x, y) => y.a - x.a);
  const [outer, inner] = [byArea[0].l, byArea[1].l];
  const dist = (P: number[]) => { let best = Infinity; for (let i = 0; i < inner.length; i++) { const A = inner[i], B = inner[(i + 1) % inner.length]; const ex = B[0] - A[0], ey = B[1] - A[1]; const u = Math.max(0, Math.min(1, ((P[0] - A[0]) * ex + (P[1] - A[1]) * ey) / (ex * ex + ey * ey || 1))); best = Math.min(best, Math.hypot(A[0] + ex * u - P[0], A[1] + ey * u - P[1])); } return best; };
  const ds = outer.map(dist);
  console.log(`z=${z.toFixed(0)} wall in plan: min ${Math.min(...ds).toFixed(2)} max ${Math.max(...ds).toFixed(2)} (set ${p.lampWall}; in plan it reads thicker where the wall slopes)`);
}
