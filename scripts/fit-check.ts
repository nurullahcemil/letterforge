// Builds every style's starting design (and its sample ideas) like the app does and checks that it
// prints on the bed: footprint, height, and how many plates the 3MF would need.
// Usage: npx tsx scripts/fit-check.ts [style]
import fs from 'node:fs';
import Module from 'manifold-3d';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
const { Builder } = await import('../src/geometry');
const T = await import('../src/text');
T.setShaper(await import('harfbuzzjs'));
const { DEFAULTS } = await import('../src/defaults');
const { PRESETS, SAMPLES } = await import('../src/presets');
const { layoutOnPlates } = await import('../src/export');
const wasm = await Module(); wasm.setup();
const b = new Builder(wasm); await b.ready();
const files: Record<string, string> = {
  archivo: 'archivo-black/files/archivo-black-latin-400-normal.woff', bungee: 'bungee/files/bungee-latin-400-normal.woff',
  oswald: 'oswald/files/oswald-latin-700-normal.woff', fredoka: 'fredoka/files/fredoka-latin-700-normal.woff',
  righteous: 'righteous/files/righteous-latin-400-normal.woff', pacifico: 'pacifico/files/pacifico-latin-400-normal.woff',
  dancing: 'dancing-script/files/dancing-script-latin-700-normal.woff',
};
const fonts: Record<string, any> = {};
const font = (k: string) => {
  if (!fonts[k]) { const x = fs.readFileSync('node_modules/@fontsource/' + (files[k] ?? files.archivo)); fonts[k] = T.parseFont(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength) as ArrayBuffer); }
  return fonts[k];
};
const only = process.argv[2];
let bad = 0;
for (const [style, pr] of Object.entries(PRESETS) as [string, any][]) {
  if (only && !only.split(',').includes(style)) continue;
  const designs = [{ name: '(start)', text: pr.text, font: pr.font, patch: {} }, ...((SAMPLES as any)[style] ?? [])];
  for (const d of designs) {
    const p: any = { ...DEFAULTS, ...pr.patch, ...d.patch, style, text: d.text ?? pr.text };
    const t = performance.now();
    let r: any;
    try {
      r = b.build(font(d.font ?? pr.font), p, font('dancing'));
    } catch (e) {
      bad++;
      console.log(`ERR ${style} ${d.name}: ${String((e as Error).message).slice(0, 120)}`);
      continue;
    }
    const ms = performance.now() - t;
    const parts = r.parts.filter((x: any) => !x.previewOnly).map((x: any) => (x.printMesh ? { ...x, ...x.printMesh } : x));
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const q of parts) for (let i = 0; i < q.positions.length; i += 3) {
      x0 = Math.min(x0, q.positions[i]); x1 = Math.max(x1, q.positions[i]);
      y0 = Math.min(y0, q.positions[i + 1]); y1 = Math.max(y1, q.positions[i + 1]);
      z0 = Math.min(z0, q.positions[i + 2]); z1 = Math.max(z1, q.positions[i + 2]);
    }
    const bed = p.bedSize;
    const lay = parts.length ? layoutOnPlates(parts, bed, style === 'pins' && p.pinSeparate) : { plates: [] as number[] };
    const plates = new Set(lay.plates).size;
    // one piece bigger than the bed can't be placed at all
    let tooBigPiece = '';
    for (const q of parts) {
      let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
      for (let i = 0; i < q.positions.length; i += 3) { a0 = Math.min(a0, q.positions[i]); a1 = Math.max(a1, q.positions[i]); c0 = Math.min(c0, q.positions[i + 1]); c1 = Math.max(c1, q.positions[i + 1]); }
      if (a1 - a0 > bed - 10 || c1 - c0 > bed - 10) tooBigPiece = `${q.name} ${Math.round(a1 - a0)}×${Math.round(c1 - c0)}`;
    }
    const tall = z1 - z0 > bed;
    const cut = r.parts.some((x: any) => / · /.test(x.name)) || r.warnings.some((w: string) => /were cut/.test(w));
    const ok = !tooBigPiece && !tall && !cut && parts.length > 0;
    if (!ok) bad++;
    console.log(`${ok ? 'ok ' : 'BAD'} ${style.padEnd(9)} ${String(d.name).padEnd(16)} ${JSON.stringify(d.text ?? pr.text).slice(0, 22).padEnd(22)} ${Math.round(x1 - x0)}×${Math.round(y1 - y0)}×${Math.round(z1 - z0)} mm, ${parts.length} pieces, ${plates} plate${plates === 1 ? '' : 's'}, ${Math.round(ms)} ms${tooBigPiece ? ' TOO BIG: ' + tooBigPiece : ''}${tall ? ' TOO TALL' : ''}${cut ? ' CUT TO FIT' : ''}`);
  }
}
console.log(bad ? `${bad} design(s) do not fit` : 'every design fits');
