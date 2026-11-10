// Checks the seam notch: in level slices at many heights, finds the sharpest inward corner of the
// shade's outer outline and prints its angle (should stay near 90° = the back, +Y).
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const pc = buildLamp(wasm, (x: any) => x, { ...DEFAULTS, lampShow: 'shade', ...over } as any, []).pieces[0];
const all = [pc.m, ...(pc.extra ?? [])];
const res: string[] = [];
for (let z = 6; z < 170; z += 7.3) {
  const polys = all.flatMap((m) => m.slice(z).toPolygons());
  // outer outline = largest polygon
  const area = (q: number[][]) => Math.abs(q.reduce((a, p, i) => { const r = q[(i + 1) % q.length]; return a + p[0] * r[1] - r[0] * p[1]; }, 0));
  const o = polys.sort((a, b) => area(b) - area(a))[0];
  if (!o) continue;
  const sgn = Math.sign(o.reduce((a, p, i) => { const r = o[(i + 1) % o.length]; return a + p[0] * r[1] - r[0] * p[1]; }, 0));
  let best = 0, bi = 0;
  for (let i = 0; i < o.length; i++) {
    const a = o[(i - 1 + o.length) % o.length], b = o[i], c = o[(i + 1) % o.length];
    const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = t2 - t1; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    const concave = -d * sgn; // turning against the outline's direction = inward corner
    if (concave > best) { best = concave; bi = i; }
  }
  const p = o[bi];
  res.push(`z${z.toFixed(0)}: ${(Math.atan2(p[1], p[0]) * 180 / Math.PI).toFixed(1)}° (corner ${(best * 180 / Math.PI).toFixed(0)}°)`);
}
console.log(JSON.stringify(over)); console.log(res.join('\n'));
