/**
 * Artwork import (runs on the page, not in the worker: it needs the DOM and canvas).
 * SVG files are read with three.js's SVGLoader; PNG/JPG images are turned black-and-white at a
 * threshold and traced into outlines with Potrace. Either way the result is a set of closed
 * outlines, scaled to 1 unit tall and centred on 0 (y up): outer edges counter-clockwise, holes
 * clockwise, so the worker can fill them with the non-zero rule like letters.
 */
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

export type Pt = [number, number];

export interface Artwork {
  name: string;
  contours: Pt[][];
  /** width / height of the artwork */
  aspect: number;
}

function area(q: Pt[]): number {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const [x1, y1] = q[i];
    const [x2, y2] = q[(i + 1) % q.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Read the filled shapes of an SVG. Lines that are only stroked (no fill) are skipped. */
export function svgToArtwork(svgText: string, name: string): Artwork {
  const data = new SVGLoader().parse(svgText);
  const raw: Pt[][] = [];
  let strokesOnly = 0;
  for (const path of data.paths) {
    const style = (path.userData as any)?.style ?? {};
    if (style.fill === 'none' || style.fill === 'transparent') {
      strokesOnly++;
      continue;
    }
    // white shapes on top of the drawing are cut-outs (like the eye of a logo), not more shape
    const white = isWhite(style.fill, (path as any).color);
    const sign = white ? -1 : 1;
    for (const shape of SVGLoader.createShapes(path)) {
      const { shape: outer, holes } = shape.extractPoints(16);
      const o = outer.map((v) => [v.x, -v.y] as Pt); // SVG y points down
      if (o.length < 3) continue;
      if (Math.sign(area(o)) !== sign) o.reverse();
      raw.push(o);
      if (white) continue; // holes of a white cut-out stay cut
      for (const h of holes) {
        const q = h.map((v) => [v.x, -v.y] as Pt);
        if (q.length < 3) continue;
        if (area(q) > 0) q.reverse();
        raw.push(q);
      }
    }
  }
  if (!raw.length) {
    throw new Error(
      strokesOnly
        ? 'This SVG only has lines without fill. Convert strokes to outlines (e.g. in Inkscape: Path → Stroke to Path) and try again.'
        : 'No shapes found in this SVG.',
    );
  }
  return normalise(raw, name);
}

function normalise(raw: Pt[][], name: string): Artwork {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of raw) for (const [x, y] of c) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const h = Math.max(1e-9, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  // drop points closer than 1/2000 of the height (keeps files small without visible change)
  const eps = 1 / 2000;
  const contours = raw
    .map((c) => {
      const out: Pt[] = [];
      for (const [x, y] of c) {
        const p: Pt = [(x - cx) / h, (y - cy) / h];
        const l = out[out.length - 1];
        if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > eps) out.push(p);
      }
      return out;
    })
    .filter((c) => c.length >= 3);
  return { name, contours, aspect: (x1 - x0) / h };
}

function isWhite(fill: unknown, color: any): boolean {
  const f = String(fill ?? '').trim().toLowerCase();
  if (/^(white|#fff|#ffffff|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/.test(f)) return true;
  // SVGLoader resolves the fill to path.color (a three.js Color, 0–1)
  return !!color && color.r > 0.97 && color.g > 0.97 && color.b > 0.97 && f !== '' && f !== 'currentcolor';
}

let potraceReady: Promise<typeof import('esm-potrace-wasm')> | undefined;

/**
 * Trace a picture: pixels darker than `threshold` (0–255) become the shape (or lighter ones with
 * `invert`). Transparent pixels count as background. Big pictures are scaled to 1200 px first.
 */
export async function traceImage(file: Blob, name: string, threshold = 128, invert = false): Promise<Artwork> {
  potraceReady ??= import('esm-potrace-wasm').then(async (m) => {
    await m.init();
    return m;
  });
  const pt = await potraceReady;
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const h = Math.max(1, Math.round(bmp.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const ink = invert ? lum > threshold : lum <= threshold;
    const v = ink ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  const svg = await pt.potrace(img, {
    turdsize: 4,
    turnpolicy: 4,
    alphamax: 1,
    opticurve: 1,
    opttolerance: 0.2,
    pathonly: false,
    extractcolors: false,
    posterizelevel: 2,
    posterizationalgorithm: 0,
  });
  return svgToArtwork(Array.isArray(svg) ? svg.join('') : svg, name);
}
