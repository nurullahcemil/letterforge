// Builds a design with the laser-cut backing on and prints its size, pieces, holes and warnings.
import fs from 'node:fs';
import Module from 'manifold-3d';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
const { Builder } = await import('../src/geometry');
const { parseFont } = await import('../src/text');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const b = new Builder(wasm); await b.ready();
const f = fs.readFileSync('node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff');
const font = parseFont(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength));
const over = JSON.parse(process.argv[2] ?? '{}');
const r = b.build(font, { ...DEFAULTS, style: 'planter', text: 'Kraftstories', capHeight: 70, backOn: true, ...over } as any);
const bk = r.backing;
console.log(JSON.stringify(over), 'size', bk?.size.map((v) => v.toFixed(1)).join('x'), 'pieces', bk?.pieces, 'loops', bk?.cut.length, 'guide', bk?.guide.length, 'parts', r.parts.length, r.warnings);
