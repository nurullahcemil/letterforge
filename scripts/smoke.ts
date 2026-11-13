import fs from 'node:fs';
import Module from 'manifold-3d';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
const { Builder } = await import('../src/geometry');
import type { Params } from '../src/geometry';
import { parseFont } from '../src/text';
import { toSTL, to3MF } from '../src/export';

const { DEFAULTS } = await import('../src/defaults');
const base: Params = { ...DEFAULTS };
const wasm = await Module(); wasm.setup();
const b = new Builder(wasm); await b.ready();
const fonts = {
  archivo: 'node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff',
  pacifico: 'node_modules/@fontsource/pacifico/files/pacifico-latin-400-normal.woff',
  dancing: 'node_modules/@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff',
  fredoka: 'node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff',
  oswald: 'node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff',
};
const { setFallbacks, setShaper } = await import('../src/text');
if (!process.env.NOHB) setShaper(await import('harfbuzzjs')); // the app always shapes with HarfBuzz
const raw = (f: string) => { const x = fs.readFileSync(f); return parseFont(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength)); };
const load = (f: string) => { const font = raw(f); const ext = f.replace('-latin-', '-latin-ext-'); if (fs.existsSync(ext)) setFallbacks(font, [raw(ext)]); return font; };
const cases: [string, Partial<Params>, string][] = [
  ['sign-bar', {}, 'archivo'],
  ['sign-plate', { base: 'plate' }, 'archivo'],
  ['planter', { style: 'planter', text: 'grow', capHeight: 120, splitBed: true }, 'pacifico'],
  ['topo', { style: 'topo', text: 'B', capHeight: 120 }, 'archivo'],
  ['topo-stack', { style: 'topo', text: 'B', capHeight: 120, topoMode: 'stack' }, 'archivo'],
  ['facet', { style: 'facet', text: 'LOVE', capHeight: 100 }, 'archivo'],
  ['facet-cap', { style: 'facet', text: 'EAT', capHeight: 100, cap: 8 }, 'archivo'],
  ['facet-script', { style: 'facet', text: 'hi', capHeight: 100 }, 'pacifico'],
  ['keychain', { style: 'keychain', text: 'Olivia', capHeight: 16, tracking: 0 }, 'pacifico'],
  ['duo', { style: 'duo', text: 'BIRTHDAY', capHeight: 36, tracking: -0.04, vHoles: true }, 'fredoka'],
  ['duo-moved', { style: 'duo', text: 'BIRTHDAY', capHeight: 36, tracking: -0.04, topDx: 300 }, 'fredoka'],
  ['book-standing', { style: 'book', text: 'ON SUCH\nA FULL SEA', capHeight: 11, lineSpacing: 1.35 }, 'oswald'],
  ['book-lying-flat', { style: 'book', text: 'ON SUCH\nA FULL SEA', capHeight: 11, lineSpacing: 1.35, bookOrient: 'lying', bookEffect: 'flat' }, 'oswald'],
  ['book-turkish', { style: 'book', text: "Nasıl ki bir ağacın bütün aksamı, yaprakları, çiçekleri ve meyveleri arasında bir münasebet ve bir irtibat vardır. Ve o ağacın her bir cüz'ü, o ağacın umumuna bir cihetle bakar ve bir münasebetle bağlıdır.", rLean: 55, rMin: 0.4, rMax: 7, lineSpacing: 1.35 }, 'oswald'],
  ['book-fill', { style: 'book', text: 'Bismillah\nher\nhayrın\nbaşıdır.', bookStretch: true, rLean: 55, rMin: 0.4, rMax: 7, lineSpacing: 1.1 }, 'oswald'],
  ['book-line', { style: 'book', text: 'ON SUCH\nA FULL SEA', lineMode: true, lineW: 1.2, bookStretch: true, rLean: 55, rMin: 0.4, rMax: 9 }, 'oswald'],
  ['ramp-line', { style: 'ramp', text: 'LINE', capHeight: 30, lineMode: true, lineW: 1.2 }, 'oswald'],
  ['lamp', { style: 'lamp' }, 'archivo'],
  ['lamp-stone', { style: 'lamp', lampTex: 'stone', lampWall: 1.6 }, 'archivo'],
  ['mold-ball', { style: 'mold' }, 'archivo'],
  ['mold-tree', { style: 'mold', moldShape: 'tree', moldKind: 'two', moldSides: 8, moldDepth: 0, moldH: 110, moldD: 80 }, 'archivo'],
  ['flower', { style: 'flower', text: 'BLOOM', capHeight: 55, flCount: 10, tracking: 0 }, 'archivo'],
  ['arrow-turn', { style: 'arrow', text: 'F\nU\nN', capHeight: 45, tracking: 0, lineSpacing: 1.25 }, 'archivo'],
  ['arrow-plain', { style: 'arrow', text: 'EXIT', arShape: 'arrow', arDir: 'up' }, 'oswald'],
  ['pyramid', { style: 'pyramid', text: 'C', capHeight: 120 }, 'archivo'],
  ['pyramid-45', { style: 'pyramid', text: 'AB', capHeight: 100, pyRotate: true }, 'archivo'],
  ['tile-master', { style: 'tile' }, 'archivo'],
  ['pins-wave', { style: 'pins', text: 'HI' }, 'archivo'],
  ['pins-wave-text', { style: 'pins', text: 'HI', capHeight: 90, pinText: 'up' }, 'archivo'],
  ['pins-apart', { style: 'pins', text: 'HI', pinText: 'up', pinSeparate: true }, 'archivo'],
  ['pins-text', { style: 'pins', text: 'HI', capHeight: 120, pinMode: 'letters' }, 'archivo'],
  ['tile-tray', { style: 'tile', tlMake: 'tray' }, 'archivo'],
  ['tile-cutter', { style: 'tile', tlMake: 'cutter' }, 'archivo'],
  ['sign-backing', { backOn: true, backHoles: 'two', backKerf: 0.15 }, 'archivo'],
  ['book-widths', { style: 'book', text: 'ON SUCH\nA FULL SEA', letterW: { '0': 3, '6': 0.5 }, rLean: 55, rMin: 0.4, rMax: 9 }, 'oswald'],
  ['stack-widths', { style: 'stack', text: 'RAISE\nYOUR\nGAME', capHeight: 45, lineSpacing: 0.8, letterW: { '5': 2.5 } }, 'archivo'],
  ['stepped-word', { style: 'stepped', text: 'BES', capHeight: 140 }, 'oswald'],
  ['stack', { style: 'stack', text: 'RAISE\nYOUR\nGAME', capHeight: 45, lineSpacing: 0.8, tracking: -0.05 }, 'archivo'],
  ['stepped', { style: 'stepped', text: 'A', capHeight: 140 }, 'oswald'],
  ['ramp', { style: 'ramp', text: 'ON SUCH\nA FULL SEA', capHeight: 30, lineSpacing: 1.3 }, 'oswald'],
];
fs.mkdirSync('out', { recursive: true });
for (const [name, over, font] of cases) {
  const t = performance.now();
  const r = b.build(load(fonts[font as keyof typeof fonts]), { ...base, ...over }, load(fonts.dancing));
  const tris = r.parts.reduce((s, p) => s + p.indices.length / 3, 0);
  console.log(name, `${(performance.now() - t).toFixed(0)}ms`, 'parts', r.parts.length, 'tris', tris, 'size', r.size.map((v) => v.toFixed(1)).join('x'), r.warnings);
  const merged = b.mergedMesh();
  const stl = toSTL(merged);
  fs.writeFileSync(`out/${name}.stl`, Buffer.from(await stl.arrayBuffer()));
  const m = to3MF(r.parts, name);
  fs.writeFileSync(`out/${name}.3mf`, Buffer.from(await m.arrayBuffer()));
}
