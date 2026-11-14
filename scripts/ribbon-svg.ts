// Draws the traced centre lines of a word over its outline, to check the ribbon style's tracing.
// npx tsx scripts/ribbon-svg.ts out.svg "Love" dancing
import fs from 'node:fs';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
const { parseFont, layoutText, setShaper, setFallbacks } = await import('../src/text');
const { centerlines } = await import('../src/ribbon');
setShaper(await import('harfbuzzjs'));
const files: Record<string, string> = {
  dancing: 'node_modules/@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff',
  pacifico: 'node_modules/@fontsource/pacifico/files/pacifico-latin-400-normal.woff',
  aref: 'node_modules/@fontsource/aref-ruqaa/files/aref-ruqaa-arabic-700-normal.woff',
};
const raw = (f: string) => { const x = fs.readFileSync(f); return parseFont(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength)); };
const [out = 'ribbon.svg', text = 'Love', fk = 'dancing'] = process.argv.slice(2);
const font = raw(files[fk]);
if (fk === 'aref') setFallbacks(font, [raw(files[fk].replace('arabic', 'latin'))]);
const lay = layoutText(font, text, { capHeight: 60, tracking: 0, lineSpacing: 1.2 } as any);
const t0 = Date.now();
const lines = centerlines(lay.contours as any, 0.3, 6);
console.log(lines.length, 'lines', Date.now() - t0, 'ms');
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
for (const c of lay.contours) for (const [x, y] of c) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
const tf = ([x, y]: number[]) => `${(x - x0 + 5).toFixed(2)},${(y1 - y + 5).toFixed(2)}`;
const cols = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x1 - x0 + 10} ${y1 - y0 + 10}" width="${(x1 - x0 + 10) * 4}">
<path d="${lay.contours.map((c: any) => 'M' + c.map(tf).join('L') + 'Z').join('')}" fill="#ddd" fill-rule="nonzero"/>
${lines.map((l, i) => `<polyline points="${l.map(tf).join(' ')}" fill="none" stroke="${cols[i % cols.length]}" stroke-width="0.8"/>`).join('\n')}
</svg>`);
