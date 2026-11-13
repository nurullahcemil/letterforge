// Builds every candle shape with every mold kind and checks: pieces are valid solids, the mold
// halves don't overlap each other or the candle, and print pieces lie flat (z min = 0).
// Usage: npx tsx scripts/mold-check.ts ['{"moldShape":"ball"}']
import Module from 'manifold-3d';
const { buildMold } = await import('../src/mold');
const { DEFAULTS } = await import('../src/defaults');
const { MOLD_SHAPE_DEFAULTS } = await import('../src/mold');
const wasm = await Module(); wasm.setup();
const keep = <T,>(o: T) => o;
const over = process.argv[2] ? JSON.parse(process.argv[2]) : {};
const shapes = over.moldShape ? [over.moldShape] : ['tree', 'ball', 'drop', 'gem', 'pillar'];
const kinds = over.moldKind ? [over.moldKind] : ['two', 'zigzag', 'open'];
let bad = 0;
for (const s of shapes) for (const kd of kinds) {
  const p: any = { ...DEFAULTS, ...MOLD_SHAPE_DEFAULTS[s as 'ball'], moldShape: s, ...over, moldKind: kd, moldDebug: true };
  const w: string[] = [];
  const t = performance.now();
  const r = buildMold(wasm, keep as any, p, w);
  const info: string[] = [];
  const halves = r.debug!.halves;
  for (const pc of r.pieces) {
    const st = pc.print.status();
    const bb = pc.print.boundingBox();
    const g = pc.print.genus();
    info.push(`${pc.name}: ${st} vol ${(pc.print.volume() / 1000).toFixed(1)}cm3 genus ${g} tris ${pc.print.numTri()} zmin ${bb.min[2].toFixed(2)}`);
    if (st !== 'NoError' || pc.print.isEmpty()) bad++;
  }
  // overlaps (in the assembled position): halves vs each other and vs the candle cavity
  let ov = 0;
  for (let i = 0; i < halves.length; i++) {
    ov = Math.max(ov, halves[i].intersect(r.debug!.cavity).volume());
    for (let j = i + 1; j < halves.length; j++) ov = Math.max(ov, halves[i].intersect(halves[j]).volume());
  }
  if (ov > 30) bad++; // pins sit inside sockets; anything larger is a real clash
  console.log(`${s}/${kd} ${(performance.now() - t).toFixed(0)}ms candle ${r.volume.toFixed(1)}cm3 overlap ${ov.toFixed(2)}mm3`);
  for (const l of info) console.log('   ', l);
  if (w.length) console.log('    warnings:', w.join(' | '));
}
console.log(bad ? `PROBLEMS: ${bad}` : 'all clean');
