import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { Font } from 'opentype.js';
import { Builder, type Params } from './geometry';
import { parseFont } from './text';

type Req =
  | { type: 'font'; key: string; buffer: ArrayBuffer }
  | { type: 'build'; id: number; fontKey: string; params: Params }
  | { type: 'merged'; id: number };

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
      fonts.set(msg.key, parseFont(msg.buffer));
      return;
    }
    const builder = await ready;
    if (msg.type === 'build') {
      const font = fonts.get(msg.fontKey);
      if (!font) throw new Error('Font not loaded');
      const t = performance.now();
      const res = builder.build(font, msg.params);
      self.postMessage({ type: 'result', id: msg.id, ...res, ms: performance.now() - t });
    } else if (msg.type === 'merged') {
      const mesh = builder.mergedMesh();
      self.postMessage({ type: 'merged', id: msg.id, mesh }, [mesh.positions.buffer, mesh.indices.buffer] as any);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: (msg as any).id, message: String((err as Error)?.message ?? err) });
  }
};
