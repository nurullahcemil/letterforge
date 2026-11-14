// Ribbed dish check: every design builds as a valid solid and no downward face above the bed is
// flatter than 45° (prints without supports). Usage: npx tsx scripts/dish-check.ts ['{...}']
import Module from 'manifold-3d';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
const { Builder } = await import('../src/geometry');
const { DEFAULTS } = await import('../src/defaults');
const { parseFont } = await import('../src/text');
import fs from 'node:fs';
const wasm = await Module(); wasm.setup();
const b = new Builder(wasm); await b.ready();
const x = fs.readFileSync('node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff');
const font = parseFont(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength));
const cases = process.argv[2] ? [JSON.parse(process.argv[2])] : [{}, { dsHeight: 80, dsSize: 120 }, { dsHeight: 12, dsRibs: 48, dsDepth: 12 }, { dsSwirl: 90, dsWobble: 100, dsRibs: 8, dsDepth: 15 }, { dsCentre: 'cut', text: 'HI' }];
let bad = 0;
for (const c of cases) {
  const r = b.build(font, { ...DEFAULTS, style: 'dish', text: 'KEYS', ...c } as any);
  let worst = 0, n = 0;
  for (const p of r.parts) {
    const P = p.positions, I = p.indices;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, q = I[t + 1] * 3, w = I[t + 2] * 3;
      const ux = P[q] - P[a], uy = P[q + 1] - P[a + 1], uz = P[q + 2] - P[a + 2];
      const vx = P[w] - P[a], vy = P[w + 1] - P[a + 1], vz = P[w + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz); if (L < 0.02) continue; // slivers under 0.01 mm² do not print
      const zMin = Math.min(P[a + 2], P[q + 2], P[w + 2]);
      if (zMin < 0.05) continue;
      const cz = nz / L; // −1 = facing straight down
      if (cz < -Math.SQRT1_2 - 0.02) { n++; worst = Math.min(worst, cz); if (process.env.WHERE) console.log(P[a], P[a + 1], P[a + 2], P[q + 2], P[w + 2], L / 2); }
    }
  }
  const ok = r.parts.length > 0 && n === 0;
  if (!ok) bad++;
  console.log(ok ? 'ok ' : 'BAD', JSON.stringify(c), `parts ${r.parts.length}`, n ? `${n} faces flatter than 45° (worst ${(Math.acos(-worst) * 180 / Math.PI).toFixed(1)}° from straight down)` : 'no overhangs');
}
console.log(bad ? `${bad} problem(s)` : 'all clean');
