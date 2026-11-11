import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { Font } from 'opentype.js';
import { Builder, type Params } from './geometry';
import decompressWoff2 from 'woff2-encoder/decompress';
import { fontAxes, isWoff2, parseFont, setFallbacks, setFontVariation, setShaper, hasShaper } from './text';

type Req =
  | { type: 'font'; key: string; buffer: ArrayBuffer; ext?: ArrayBuffer }
  | { type: 'build'; id: number; fontKey: string; topFontKey?: string; params: Params }
  | { type: 'merged'; id: number; byColor?: boolean };

const fonts = new Map<string, Font>();

/** Fonts arrive as TTF/OTF/WOFF (read directly) or WOFF2 (decoded here first). */
async function sfnt(buf: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isWoff2(buf)) return buf;
  const out = await decompressWoff2(buf);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}
// HarfBuzz text shaping (kerning, ligatures, complex scripts, variable-font spacing); without it the
// layout uses opentype.js, so a failed load only costs quality
const shaper = import('harfbuzzjs').then((hb) => setShaper(hb)).catch(() => undefined);

const ready = (async () => {
  await shaper;
  const wasm = await Module({ locateFile: () => wasmUrl });
  wasm.setup();
  const builder = new Builder(wasm);
  await builder.ready();
  return builder;
})();

const loading = new Map<string, Promise<void>>();

async function loadFont(msg: Extract<Req, { type: 'font' }>) {
  const main = parseFont(await sfnt(msg.buffer));
  if (msg.ext) {
    try {
      setFallbacks(main, [parseFont(await sfnt(msg.ext))]);
    } catch {
      /* extra glyphs are optional */
    }
  }
  fonts.set(msg.key, main);
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const msg = e.data;
  try {
    if (msg.type === 'font') {
      // decoding is async: builds wait for it (see `loading`)
      let done!: () => void;
      loading.set(msg.key, new Promise<void>((r) => (done = r)));
      try {
        await loadFont(msg);
      } finally {
        done();
        loading.delete(msg.key);
      }
      return;
    }
    const builder = await ready;
    if (msg.type === 'build') {
      await loading.get(msg.fontKey);
      if (msg.topFontKey) await loading.get(msg.topFontKey);
    }
    if (msg.type === 'build') {
      const font = fonts.get(msg.fontKey);
      if (!font) throw new Error('Font not loaded');
      const t = performance.now();
      // variable fonts: weight/width etc. chosen for this font (saved with the design)
      const fv = msg.params.fontVar;
      setFontVariation(font, fv && fv.key === msg.fontKey ? fv.axes : undefined);
      for (const fb of ((font as any).__fallbacks ?? []) as Font[]) setFontVariation(fb, fv && fv.key === msg.fontKey ? fv.axes : undefined);
      const res = builder.build(font, msg.params, msg.topFontKey ? fonts.get(msg.topFontKey) : undefined);
      self.postMessage({ type: 'result', id: msg.id, ...res, axes: fontAxes(font), shaper: hasShaper(), ms: performance.now() - t });
    } else if (msg.type === 'merged') {
      const meshes = builder.mergedByColor(!!msg.byColor);
      self.postMessage(
        { type: 'merged', id: msg.id, meshes },
        meshes.flatMap((m) => [m.positions.buffer, m.indices.buffer]) as any,
      );
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: (msg as any).id, message: String((err as Error)?.message ?? err) });
  }
};
