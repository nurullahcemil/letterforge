// Draws the letter flower outline from the top as SVG, to judge how readable it is.
// Usage: npx tsx scripts/flower-svg.ts out.svg '{"text":"BLOOM","flCount":15}' [font]
import fs from 'node:fs';
import Module from 'manifold-3d';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
const { Builder } = await import('../src/geometry');
const { parseFont, setShaper } = await import('../src/text');
const { DEFAULTS } = await import('../src/defaults');
setShaper(await import('harfbuzzjs'));
const wasm = await Module(); wasm.setup();
const b = new Builder(wasm); await b.ready();
const fonts: Record<string, string> = {
  archivo: 'node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff',
  righteous: 'node_modules/@fontsource/righteous/files/righteous-latin-400-normal.woff',
  oswald: 'node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff',
};
const x = fs.readFileSync(fonts[process.argv[4] ?? 'archivo']);
const font = parseFont(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength));
const r = b.build(font, { ...DEFAULTS, style: 'flower', capHeight: 80, tracking: 0, ...JSON.parse(process.argv[3] ?? '{}') } as any);
const p = r.parts[0];
// top faces only: triangles whose 3 points are at the top z
let zMax = -Infinity;
for (let i = 2; i < p.positions.length; i += 3) zMax = Math.max(zMax, p.positions[i]);
let path = '';
for (let t = 0; t < p.indices.length; t += 3) {
  const v = [0, 1, 2].map((j) => p.indices[t + j] * 3);
  if (!v.every((i) => Math.abs(p.positions[i + 2] - zMax) < 1e-3)) continue;
  path += `M${v.map((i) => `${p.positions[i].toFixed(2)},${(-p.positions[i + 1]).toFixed(2)}`).join('L')}Z`;
}
const R = Math.max(r.size[0], r.size[1]) / 2 + 5;
fs.writeFileSync(process.argv[2], `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-R} ${-R} ${2 * R} ${2 * R}" width="500" height="500"><rect x="${-R}" y="${-R}" width="${2 * R}" height="${2 * R}" fill="#222"/><path d="${path}" fill="#f0642d" stroke="#f0642d" stroke-width="0.2"/></svg>`);
console.log(r.warnings);
