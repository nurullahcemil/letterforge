import fs from 'node:fs';
import Module from 'manifold-3d';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
const { Builder } = await import('../src/geometry');
import type { Params } from '../src/geometry';
import { parseFont } from '../src/text';
import { toSTL, to3MF } from '../src/export';

const base: Params = {
  style: 'sign', text: 'MENU', capHeight: 40, tracking: 0.02, lineSpacing: 1.3,
  depth: 15, base: 'bar', baseHeight: 4, platePadding: 6, letterRelief: 3, qrText: 'https://example.com/menu', qrRelief: 1,
  wallHeight: 30, wall: 1.6, floor: 2,
  layers: 6, layerThickness: 3, step: 3, rim: 3, topoMode: 'bowl', openCenter: true, wobble: 2, seed: 7,
  facetWall: 20, angle: 45, cap: 0,
  splitBed: false, bedSize: 256, colorA: '#2e8b6e', colorB: '#f2f2f2',
};
const wasm = await Module(); wasm.setup();
const b = new Builder(wasm); await b.ready();
const fonts = {
  archivo: 'node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff',
  pacifico: 'node_modules/@fontsource/pacifico/files/pacifico-latin-400-normal.woff',
};
const load = (f: string) => { const x = fs.readFileSync(f); return parseFont(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength)); };
const cases: [string, Partial<Params>, string][] = [
  ['sign-bar', {}, 'archivo'],
  ['sign-plate', { base: 'plate' }, 'archivo'],
  ['planter', { style: 'planter', text: 'grow', capHeight: 120, splitBed: true }, 'pacifico'],
  ['topo', { style: 'topo', text: 'B', capHeight: 120 }, 'archivo'],
  ['topo-stack', { style: 'topo', text: 'B', capHeight: 120, topoMode: 'stack' }, 'archivo'],
  ['facet', { style: 'facet', text: 'LOVE', capHeight: 100 }, 'archivo'],
  ['facet-cap', { style: 'facet', text: 'EAT', capHeight: 100, cap: 8 }, 'archivo'],
  ['facet-script', { style: 'facet', text: 'hi', capHeight: 100 }, 'pacifico'],
];
fs.mkdirSync('out', { recursive: true });
for (const [name, over, font] of cases) {
  const t = performance.now();
  const r = b.build(load(fonts[font as keyof typeof fonts]), { ...base, ...over });
  const tris = r.parts.reduce((s, p) => s + p.indices.length / 3, 0);
  console.log(name, `${(performance.now() - t).toFixed(0)}ms`, 'parts', r.parts.length, 'tris', tris, 'size', r.size.map((v) => v.toFixed(1)).join('x'), r.warnings);
  const merged = b.mergedMesh();
  const stl = toSTL(merged);
  fs.writeFileSync(`out/${name}.stl`, Buffer.from(await stl.arrayBuffer()));
  const m = to3MF(r.parts, name);
  fs.writeFileSync(`out/${name}.3mf`, Buffer.from(await m.arrayBuffer()));
}
