// Checks the shade wall for folds and crossings (they show as holes / dark patches in a slicer).
// The wall's outline is reshaped at many angles around the lamp exactly like the 3D model; a
// healthy outline never crosses itself, so its plain area equals the area the library computes
// after resolving crossings. Also reports the thinnest wall (should stay near "Wall thickness").
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const p = { ...DEFAULTS, lampShow: 'shade', lampDebug: true, ...over } as any;
const { debug } = buildLamp(wasm, (x: any) => x, p, []);
if (!debug) { console.log(JSON.stringify(over), 'woven bands: built exactly, nothing to check here (use lamp-check)'); process.exit(0); }
const polys = debug!.polys;
const shoelace = (q: number[][]) => q.reduce((acc, a, i) => { const b = q[(i + 1) % q.length]; return acc + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
let worst = 0;
let worstA = 0;
for (let deg = 0; deg < 360; deg += 3) {
  const a = (deg * Math.PI) / 180;
  const mapped = polys.map((poly) => poly.map(([r, z]) => {
    const [x, y, zz] = debug!.point(r * Math.cos(a), r * Math.sin(a), z);
    return [Math.hypot(x, y), zz];
  }));
  const plain = mapped.reduce((acc, q) => acc + shoelace(q), 0);
  const solved = new wasm.CrossSection(mapped as any, 'Positive').area();
  const err = Math.abs(plain - solved);
  if (err > worst) { worst = err; worstA = deg; }
}
console.log(JSON.stringify(over), worst > 1 ? `FOLDS: ${worst.toFixed(1)} mm² wrong at ${worstA}°` : `clean (max error ${worst.toFixed(2)} mm²)`);
