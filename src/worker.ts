import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { Font } from 'opentype.js';
import { Builder, type Params } from './geometry';
import { parseFont, setFallbacks } from './text';

type Req =
  | { type: 'font'; key: string; buffer: ArrayBuffer; ext?: ArrayBuffer }
  | { type: 'build'; id: number; fontKey: string; topFontKey?: string; params: Params }
  | { type: 'merged'; id: number; byColor?: boolean };

const fonts = new Map<string, Font>();
const ready = (async () => {
  const wasm = await Module({ locateFile: () => wasmUrl });
  wasm.setup();
  const builder = new Builder(wasm);
  await builder.ready();
  return builder;
})();

self.onmessage = async (e: MessageEvent<Req>) => {
  const msg = e.data;
  try {
    if (msg.type === 'font') {
      const main = parseFont(msg.buffer);
      if (msg.ext) {
        try {
          setFallbacks(main, [parseFont(msg.ext)]);
        } catch {
          /* extra glyphs are optional */
        }
      }
      fonts.set(msg.key, main);
      return;
    }
    const builder = await ready;
    if (msg.type === 'build') {
      const font = fonts.get(msg.fontKey);
      if (!font) throw new Error('Font not loaded');
      const t = performance.now();
      const res = builder.build(font, msg.params, msg.topFontKey ? fonts.get(msg.topFontKey) : undefined);
      self.postMessage({ type: 'result', id: msg.id, ...res, ms: performance.now() - t });
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
