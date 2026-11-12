// Builds a design, lays it out on plates like the 3MF download does and checks every object fits
// its plate. Writes the 3MF to the path in OUT if given.
import fs from 'node:fs';
import Module from 'manifold-3d';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
const { Builder } = await import('../src/geometry');
const T = await import('../src/text');
T.setShaper(await import('harfbuzzjs'));
const { DEFAULTS } = await import('../src/defaults');
const { layoutOnPlates, to3MF } = await import('../src/export');
const wasm = await Module(); wasm.setup();
const b = new Builder(wasm); await b.ready();
const f = fs.readFileSync(process.env.FONT ?? 'node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff');
const font = T.parseFont(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer);
const p = { ...DEFAULTS, ...JSON.parse(process.argv[2] ?? '{}') } as any;
const r = b.build(font, p);
const parts = r.parts.filter((x: any) => !x.previewOnly);
const lay = layoutOnPlates(parts, p.bedSize);
const sq = Math.sqrt(new Set(lay.plates).size), cols = sq > Math.round(sq) ? Math.round(sq) + 1 : Math.round(sq);
let bad = 0;
lay.groups.forEach((g, k) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity;
  for (const i of g) { const q = lay.parts[i].positions; for (let j = 0; j < q.length; j += 3) { x0 = Math.min(x0, q[j]); x1 = Math.max(x1, q[j]); y0 = Math.min(y0, q[j + 1]); y1 = Math.max(y1, q[j + 1]); z0 = Math.min(z0, q[j + 2]); } }
  const pl = lay.plates[k], px = (pl % cols) * p.bedSize * 1.2, py = -Math.floor(pl / cols) * p.bedSize * 1.2;
  const ok = x0 >= px - 0.01 && x1 <= px + p.bedSize + 0.01 && y0 >= py - 0.01 && y1 <= py + p.bedSize + 0.01 && Math.abs(z0) < 0.01;
  if (!ok) bad++;
  console.log(`object ${k + 1} (${g.map((i) => parts[i].name).join(' + ')}) plate ${pl + 1}: ${(x1 - x0).toFixed(0)}×${(y1 - y0).toFixed(0)} mm ${ok ? 'fits' : 'DOES NOT FIT'}`);
});
console.log(`size ${r.size.map((v: number) => v.toFixed(0)).join('×')} → ${lay.groups.length} objects on ${new Set(lay.plates).size} plates, ${bad ? bad + ' not fitting' : 'all fit'}`);
if (process.env.OUT) fs.writeFileSync(process.env.OUT, Buffer.from(await to3MF(lay.parts, 'test', false, { groups: lay.groups, plates: lay.plates }).arrayBuffer()));
