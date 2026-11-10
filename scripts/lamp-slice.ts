// Draw horizontal slices of the lamp parts to an SVG (for checking joints by eye).
import fs from 'node:fs';
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const zs: number[] = JSON.parse(process.argv[3] ?? '[1.5, 8, 12]');
const which = process.argv[4] ?? 'Shade';
const out = process.argv[5] ?? 'slice.svg';
const { pieces } = buildLamp(wasm, (o: any) => o, { ...DEFAULTS, ...over } as any, []);
const m = pieces.find((p) => p.name === which)!.m;
const cell = 260;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell * zs.length}" height="${cell + 20}" style="background:#fff">`;
zs.forEach((z, i) => {
  const polys = m.slice(z).toPolygons();
  const b = m.boundingBox();
  const s = (cell - 20) / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
  const d = polys.map((p) => 'M' + p.map(([x, y]) => `${(i * cell + cell / 2 + x * s).toFixed(1)},${(cell / 2 - y * s).toFixed(1)}`).join('L') + 'Z').join('');
  svg += `<path d="${d}" fill="#9ab" fill-rule="evenodd" stroke="#234" stroke-width=".5"/><text x="${i * cell + 8}" y="${cell + 14}" font-size="12">${which} z=${z} pieces=${m.slice(z).decompose().length}</text>`;
});
fs.writeFileSync(out, svg + '</svg>');
