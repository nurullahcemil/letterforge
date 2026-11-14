/**
 * Ribbon sculpture (user photo of a flowing ribbon sculpture on a wooden base; own parametric
 * designs, no text): a flat band swept along a closed 3D curve, turning as it goes.
 *
 * The curve is sampled, scaled to the wanted width, and a rotation-minimising frame (double
 * reflection) is carried along it so the band never flips on its own. The frame's mismatch where
 * the loop closes is spread evenly along the band, plus the chosen number of half twists. Each
 * sample becomes a 4-corner cross-section (width × thickness); neighbouring rings are joined into
 * quads, and the last ring joins the first (shifted by two corners after an odd number of half
 * twists, like a Möbius band), so the mesh is closed and watertight with no caps.
 */
import type { ManifoldToplevel, Manifold } from 'manifold-3d';

export type SculptShape = 'infinity' | 'trefoil' | 'lissajous' | 'twist';
export interface SculptParams {
  shape: SculptShape;
  /** Width across (mm). */
  size: number;
  /** Band width (mm) and thickness (mm). */
  width: number;
  thick: number;
  /** Extra half twists along the loop. */
  halfTwists: number;
  /** How far the loop moves front to back, as a share of its width (0..1). */
  depth: number;
}

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** The closed curve, t in [0, 1). x = across, y = front–back, z = up. */
function curve(shape: SculptShape, t: number, depth: number): V {
  const u = t * 2 * Math.PI;
  switch (shape) {
    case 'infinity': {
      // a figure eight standing up; the two lobes pass in front of / behind each other at the crossing
      const d = 1 + Math.sin(u) ** 2;
      // front-back movement mostly at the crossing (sin³), so both loops' bottoms line up over one foot
      return [Math.cos(u) / d, depth * 0.9 * Math.sin(u) ** 3, (1.25 * Math.sin(u) * Math.cos(u)) / d];
    }
    case 'trefoil':
      // a three-lobed knot standing up
      return [(Math.sin(u) + 2 * Math.sin(2 * u)) / 3, ((-Math.sin(3 * u)) * depth * 2.2) / 3, (Math.cos(u) - 2 * Math.cos(2 * u)) / 3];
    case 'lissajous': {
      // "wave loops": a ring that weaves in and out five times (a (2,5) torus knot), standing up
      const rr = 2 + Math.cos(5 * u);
      return [(rr * Math.cos(2 * u)) / 3, depth * 1.1 * Math.sin(5 * u), (rr * Math.sin(2 * u)) / 3];
    }
    case 'twist':
    default: {
      // a ring that leans and waves a little front to back
      return [Math.cos(u), depth * 0.6 * Math.sin(2 * u), Math.sin(u)];
    }
  }
}

export function buildSculpture(W: ManifoldToplevel, keep: <T extends { delete(): void }>(o: T) => T, sp: SculptParams, warnings: string[]): Manifold {
  const N = 720;
  let pts: V[] = [];
  for (let i = 0; i < N; i++) pts.push(curve(sp.shape, i / N, sp.depth));
  // scale so it is `size` wide
  let x0 = Infinity, x1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
  const sc = Math.max(10, sp.size - sp.width) / Math.max(1e-6, x1 - x0);
  pts = pts.map((p) => mul(p, sc));
  const T: V[] = pts.map((_, i) => norm(sub(pts[(i + 1) % N], pts[(i - 1 + N) % N])));
  // start the band's width across the depth direction (front–back) where possible
  let r0 = sub([0, 1, 0], mul(T[0], T[0][1]));
  if (Math.hypot(...r0) < 0.1) r0 = sub([0, 0, 1], mul(T[0], T[0][2]));
  const R: V[] = [norm(r0)];
  // rotation-minimising frame by double reflection
  for (let i = 0; i < N - 1; i++) {
    const v1 = sub(pts[i + 1], pts[i]);
    const c1 = dot(v1, v1) || 1e-12;
    const rL = sub(R[i], mul(v1, (2 / c1) * dot(v1, R[i])));
    const tL = sub(T[i], mul(v1, (2 / c1) * dot(v1, T[i])));
    const v2 = sub(T[i + 1], tL);
    const c2 = dot(v2, v2) || 1e-12;
    R.push(norm(sub(rL, mul(v2, (2 / c2) * dot(v2, rL)))));
  }
  // mismatch where the loop closes: carry the last frame one more step and compare with the first
  const v1 = sub(pts[0], pts[N - 1]);
  const c1 = dot(v1, v1) || 1e-12;
  const rL = sub(R[N - 1], mul(v1, (2 / c1) * dot(v1, R[N - 1])));
  const tL = sub(T[N - 1], mul(v1, (2 / c1) * dot(v1, T[N - 1])));
  const v2 = sub(T[0], tL);
  const c2 = dot(v2, v2) || 1e-12;
  const rEnd = norm(sub(rL, mul(v2, (2 / c2) * dot(v2, rL))));
  const mis = Math.atan2(dot(cross(rEnd, R[0]), T[0]), dot(rEnd, R[0]));
  const half = Math.max(0, Math.round(sp.halfTwists));
  const total = mis + half * Math.PI;
  const hw = sp.width / 2, ht = sp.thick / 2;
  const vp: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (total * i) / N;
    const B = cross(T[i], R[i]);
    const w = add(mul(R[i], Math.cos(a)), mul(B, Math.sin(a))); // across the band
    const n = cross(T[i], w); // through the band
    for (const [sw, sn] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const p = add(add(pts[i], mul(w, sw * hw)), mul(n, sn * ht));
      vp.push(p[0], p[1], p[2]);
    }
  }
  const tri: number[] = [];
  const shift = half % 2 ? 2 : 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, b = i * 4 + ((k + 1) % 4);
      const kk = j === 0 ? (k + shift) % 4 : k;
      const c = j * 4 + kk, d = j * 4 + ((kk + 1) % 4);
      tri.push(a, c, b, b, c, d);
    }
  }
  let m = keep(new W.Manifold(new W.Mesh({ numProp: 3, vertProperties: new Float32Array(vp), triVerts: new Uint32Array(tri) })));
  if (m.volume() < 0) {
    for (let i = 0; i < tri.length; i += 3) [tri[i + 1], tri[i + 2]] = [tri[i + 2], tri[i + 1]];
    m = keep(new W.Manifold(new W.Mesh({ numProp: 3, vertProperties: new Float32Array(vp), triVerts: new Uint32Array(tri) })));
  }
  // the band must not run into itself: points far apart along the loop must stay clear of each other
  const arc: number[] = [0];
  for (let i = 1; i < N; i++) arc.push(arc[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const L = arc[N - 1] + Math.hypot(...sub(pts[0], pts[N - 1]));
  const clear = Math.max(sp.width, sp.thick) * 1.05;
  let hit = false;
  for (let i = 0; i < N && !hit; i += 2) for (let j = i + 2; j < N; j += 2) {
    const along = Math.min(arc[j] - arc[i], L - (arc[j] - arc[i]));
    if (along < clear * 2.5) continue;
    if (Math.hypot(...sub(pts[i], pts[j])) < clear) { hit = true; break; }
  }
  if (hit) warnings.push('The band comes too close to itself and would run into itself. Make it narrower, the shape bigger, or add more front-to-back depth.');
  return m;
}
