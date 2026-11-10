import type { ManifoldToplevel, CrossSection, Manifold } from 'manifold-3d';

/** Settings of the lamp style (all lengths in mm). */
export interface LampParams {
  lampShow: 'both' | 'shade' | 'base';
  shTiers: number;
  shDia: number;
  shShrink: number; // % smaller per tier going up
  shPuff: number; // % how far the waist between tiers pulls in
  shRim: number; // height of the straight rim band of each tier
  shSlope: number; // degrees the top of each tier rises toward the middle
  shUnder: number; // degrees the underside leans out from upright
  shRound: number; // rounding of rims and waists
  shTopHole: number; // vent at the top (0 = closed)
  shSides: number; // 0 = round
  shSideDepth: number; // % how far the sides pull in
  shCorner: number; // corner sharpness 1..6
  shTwist: number; // degrees per tier
  lampWall: number;
  lampTex: 'none' | 'dots' | 'ribs' | 'rings';
  lampTexSize: number;
  lampTexDepth: number;
  socketD: number;
  hubSpokes: number;
  baseH: number;
  baseD: number;
  baseTaper: number; // top diameter, % of bottom
  baseRound: number;
  baseFeet: number;
  baseTex: boolean;
}

type Pt = [number, number];
type Keep = <T extends { delete(): void }>(o: T) => T;

export interface LampPiece {
  name: string;
  m: Manifold;
  role: 'shade' | 'base';
}

/** The outer surface (r > 0) of a closed outline, from the bottom rim to the top, in order. */
function outerCurve(poly: Pt[]): Pt[] {
  const n = poly.length;
  if (n < 3) return poly;
  let start = 0;
  for (let i = 1; i < n; i++) {
    const [r, z] = poly[i];
    const [br, bz] = poly[start];
    if (z < bz - 1e-6 || (Math.abs(z - bz) < 1e-6 && r > br)) start = i;
  }
  const dir = poly[(start + 1) % n][1] > poly[(start + n - 1) % n][1] ? 1 : -1;
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const pt = poly[(start + dir * k + n * 2) % n];
    if (k > 0 && (pt[0] < 0.05 || pt[1] < 1e-3)) break;
    out.push(pt);
  }
  return out;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Outer outline of the shade in the (r, z) plane, mirrored to both sides of the axis (sharp corners).
 * Each tier: underside rising out from the waist at `shUnder`° from vertical, a straight rim band,
 * then a cone falling back in to the next waist at `shSlope`° above horizontal.
 */
export function shadeOutline(p: LampParams): { pts: Pt[]; lip: number; top: number } {
  const N = Math.max(1, Math.round(p.shTiers));
  const R = (i: number) => (p.shDia / 2) * Math.pow(1 - p.shShrink / 100, i);
  const pinch = clamp(p.shPuff / 100, 0, 0.95) * 0.5;
  const tu = Math.tan((clamp(p.shUnder, 5, 80) * Math.PI) / 180); // dr per dz on the underside
  const ts = Math.tan((clamp(p.shSlope, 5, 80) * Math.PI) / 180); // dz per dr on the cone
  const pts: Pt[] = [];
  const lip = R(0) * (1 - pinch);
  pts.push([lip - 20 * tu, -20]); // runs below the bed; trimmed after rounding so the rim stands flat
  let r = lip;
  let z = 0;
  for (let i = 0; i < N; i++) {
    const Ri = R(i);
    z += (Ri - r) / tu;
    pts.push([Ri, z]);
    z += Math.max(0.5, p.shRim);
    pts.push([Ri, z]);
    const nt = i === N - 1 ? 0 : R(i + 1) * (1 - pinch);
    z += (Ri - nt) * ts;
    r = nt;
    pts.push([r, z]);
  }
  const right = pts;
  const full: Pt[] = [...right, ...right.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Pt)];
  return { pts: full, lip, top: z };
}

/** Split long edges so the surface pattern has enough points to bend. */
function densify(polys: Pt[][], step: number): Pt[][] {
  return polys.map((poly) => {
    const out: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    return out;
  });
}

/** Same as densify, for an open curve (no closing edge). */
function densifyOpen(curve: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < curve.length; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  if (curve.length) out.push(curve[curve.length - 1]);
  return out;
}

/** Distance along a curve (r, z) for any nearby point, so patterns keep their size on slopes. */
function arcLookup(curve: Pt[]) {
  const cell = 4;
  const s: number[] = [0];
  for (let i = 1; i < curve.length; i++) s.push(s[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]));
  const grid = new Map<string, number[]>();
  curve.forEach(([r, z], i) => {
    const key = `${Math.floor(r / cell)},${Math.floor(z / cell)}`;
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(i);
  });
  return (r: number, z: number) => {
    const cx = Math.floor(r / cell);
    const cz = Math.floor(z / cell);
    let best = -1;
    let bd = Infinity;
    for (let ring = 1; ring <= 4 && best < 0; ring++) {
      for (let dx = -ring; dx <= ring; dx++)
        for (let dz = -ring; dz <= ring; dz++) {
          const l = grid.get(`${cx + dx},${cz + dz}`);
          if (!l) continue;
          for (const i of l) {
            const d = (curve[i][0] - r) ** 2 + (curve[i][1] - z) ** 2;
            if (d < bd) {
              bd = d;
              best = i;
            }
          }
        }
    }
    return best < 0 ? z : s[best];
  };
}

/** Plan-shape factor (≤ 1) at angle a: round, or a soft polygon with `sides` corners. */
function planShape(p: LampParams) {
  const n = Math.round(p.shSides);
  if (n < 2 || p.shSideDepth <= 0) return () => 1;
  const d = clamp(p.shSideDepth / 100, 0, 0.6);
  const e = clamp(p.shCorner, 0.5, 8);
  return (a: number) => 1 - d * (1 - ((1 + Math.cos(n * a)) / 2) ** e);
}

/** Surface pattern 0..1 at angle a (radians) and height z. */
function pattern(p: LampParams, rRef: number) {
  const size = Math.max(2, p.lampTexSize);
  const around = Math.max(6, Math.round((2 * Math.PI * rRef) / size)); // whole number of bumps → no seam
  const tau = 2 * Math.PI;
  switch (p.lampTex) {
    case 'dots':
      return (a: number, z: number) => {
        const u = (a / tau) * around;
        const v = z / size;
        return ((1 + Math.cos(tau * u) * Math.cos(tau * v)) / 2) ** 1.5;
      };
    case 'ribs':
      return (a: number) => ((1 - Math.cos(tau * (a / tau) * around)) / 2) ** 0.8;
    case 'rings':
      return (_a: number, z: number) => ((1 - Math.cos((tau * z) / size)) / 2) ** 0.8;
    default:
      return null;
  }
}

export function buildLamp(wasm: ManifoldToplevel, k: Keep, p: LampParams, warnings: string[]): LampPiece[] {
  const out: LampPiece[] = [];
  const w = clamp(p.lampWall, 0.4, 6);
  const tex = pattern(p, p.shDia / 2);
  const depth = tex ? clamp(p.lampTexDepth, 0, 4) : 0;
  const step = tex ? clamp(p.lampTexSize / 4, 0.6, 3) : 2;
  const sockR = p.socketD / 2;

  if (p.lampShow !== 'base') {
    const { pts, lip, top } = shadeOutline(p);
    if (lip - w < sockR + 10) warnings.push('The shade opening is small for the socket. Make the shade wider or the waist less deep.');
    const lean = Math.max(p.shUnder, 90 - p.shSlope);
    if (lean > 62) warnings.push(`Some walls lean ${Math.round(lean)}° from upright; over about 60° may sag. Raise "Top slope" or lower "Underside angle".`);
    let A = k(new wasm.CrossSection([pts], 'NonZero'));
    const rr = clamp(p.shRound, 0, 40);
    if (rr > 0.2) {
      A = k(k(A.offset(-rr, 'Round', 2, 64)).offset(rr, 'Round', 2, 64)); // round the rims
      const rw = rr * 0.6;
      A = k(k(A.offset(rw, 'Round', 2, 64)).offset(-rw, 'Round', 2, 64)); // soften the waists
    }
    A = k(A.intersect(k(wasm.CrossSection.square([4 * p.shDia, top + 50]).translate([-2 * p.shDia, 0]))));
    let wall = k(A.subtract(k(A.offset(-w, 'Round', 2, 48))));
    const rimIn = lip - w * 1.5;
    wall = k(wall.subtract(k(wasm.CrossSection.square([2 * rimIn, w + 0.02]).translate([-rimIn, -0.01]))));
    const topHole = clamp(p.shTopHole / 2, 0, lip);
    if (topHole > 0.5) wall = k(wall.subtract(k(wasm.CrossSection.square([2 * topHole, 200]).translate([-topHole, top - 100]))));
    wall = k(wall.intersect(k(wasm.CrossSection.square([4 * p.shDia, top + 50]).translate([0, -10]))));
    // outer curve (right side) for pattern placement
    const outer = (k(A.intersect(k(wasm.CrossSection.square([4 * p.shDia, top + 50]).translate([0.01, -10])))).toPolygons()[0] ?? []) as Pt[];
    const prof = k(new wasm.CrossSection(densify(wall.toPolygons() as Pt[][], step), 'NonZero'));
    const segs = Math.round(clamp((2 * Math.PI * (p.shDia / 2)) / (tex ? step : 2), 96, 1440));
    let shade = k(wasm.Manifold.revolve(prof, segs));
    // hub: a ring for the lamp socket, held by spokes that reach the rim
    const hubT = 3;
    const ringO = sockR + 7;
    const parts: Manifold[] = [shade];
    const hub = k(k(wasm.CrossSection.circle(ringO, 96)).subtract(k(wasm.CrossSection.circle(sockR, 96))));
    parts.push(k(hub.extrude(hubT)));
    const n = Math.max(2, Math.round(p.hubSpokes));
    for (let i = 0; i < n; i++) {
      const len = lip - w / 2 - (ringO - 1);
      const bar = k(wasm.CrossSection.square([len + 1, 6]).translate([ringO - 1, -3]).rotate((360 * i) / n + 90));
      parts.push(k(bar.extrude(hubT)));
    }
    shade = k(wasm.Manifold.union(parts));
    // plan shape, twist and texture: move every point out from the centre
    const S = planShape(p);
    const tierH = top / Math.max(1, Math.round(p.shTiers));
    const twist = (p.shTwist * Math.PI) / 180 / Math.max(1, tierH);
    const oc = outerCurve(outer);
    const arc = tex ? arcLookup(densifyOpen(oc, step / 3)) : null;
    shade = k(
      shade.warpBatch((v, count) => {
        for (let i = 0; i < count; i++) {
          const x = v[3 * i];
          const y = v[3 * i + 1];
          const z = v[3 * i + 2];
          const r = Math.hypot(x, y);
          if (r < 1e-9) continue;
          const a = Math.atan2(y, x);
          const fade = smooth(ringO + 1, ringO + 12, r); // keep the socket ring round
          const s = 1 - fade * (1 - S(a - twist * z));
          let d = 0;
          if (tex && arc && depth > 0 && z > 0.3) {
            d = depth * tex(a, arc(r, z)) * smooth(0.6, 3, z) * smooth(ringO + 4, ringO + 14, r) * smooth(Math.max(4, topHole), Math.max(4, topHole) + 6, r);
          }
          const r2 = r * s + d;
          v[3 * i] = (x / r) * r2;
          v[3 * i + 1] = (y / r) * r2;
        }
      }),
    );
    out.push({ name: 'Shade', m: shade, role: 'shade' });
  }

  if (p.lampShow !== 'shade') {
    const Rb = p.baseD / 2;
    const Rt = Rb * clamp(p.baseTaper / 100, 0.4, 1.3);
    const Hb = p.baseH;
    const top = sockR + w; // where the roof meets the socket hole
    const roofH = Math.max(0, Rt - top); // 45° roof inside, so it prints without support
    const zs = Math.max(5, Hb - roofH);
    const A0: Pt[] = [];
    const n = Math.max(8, Math.ceil(zs / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      A0.push([Rb + (Rt - Rb) * t, zs * t]);
    }
    const nr = Math.max(8, Math.ceil(Math.hypot(roofH, Rt) / step));
    for (let i = 1; i <= nr; i++) {
      const t = i / nr;
      A0.push([Rt * (1 - t), zs + (Rt) * t]);
    }
    const full: Pt[] = [...A0, ...A0.slice(0, -1).reverse().map(([r, z]) => [-r, z] as Pt)];
    let A = k(new wasm.CrossSection([full], 'NonZero'));
    const rr = clamp(p.baseRound, 0, Math.min(Rt, Hb) * 0.45);
    if (rr > 0.2) A = k(k(A.offset(-rr, 'Round', 2, 64)).offset(rr, 'Round', 2, 64));
    // clip height and make the wall
    A = k(A.intersect(k(wasm.CrossSection.square([4 * Rb + 20, Hb]).translate([-2 * Rb - 10, 0]))));
    const inner = k(A.offset(-w * 1.25, 'Round', 2, 48));
    let wall = k(A.subtract(inner));
    wall = k(wall.subtract(k(wasm.CrossSection.square([2 * (Rb - w * 1.25), w * 1.25 + 0.02]).translate([-(Rb - w * 1.25), -0.01]))));
    wall = k(wall.subtract(k(wasm.CrossSection.square([2 * sockR, 50]).translate([-sockR, Hb - 20]))));
    wall = k(wall.intersect(k(wasm.CrossSection.square([4 * Rb + 20, Hb + 10]).translate([0, -5]))));
    const segs = Math.round(clamp((2 * Math.PI * Rb) / (tex && p.baseTex ? step : 2), 96, 1200));
    let base = k(wasm.Manifold.revolve(wall, segs));
    // feet: notches in the bottom edge; the widest one lets the cable out
    const cuts: Manifold[] = [];
    const nf = Math.round(p.baseFeet);
    const notchH = 4;
    if (nf >= 3) {
      const gapW = clamp((2 * Math.PI * Rb) / nf - 10, 6, 40);
      for (let i = 0; i < nf; i++) {
        const a = (360 * (i + 0.5)) / nf;
        cuts.push(k(k(wasm.Manifold.cube([Rb + 20, gapW, notchH * 2], true)).translate([Rb / 2 + 10, 0, 0]).rotate([0, 0, a])));
      }
    }
    cuts.push(k(k(wasm.Manifold.cube([Rb + 20, 9, 16], true)).translate([Rb / 2 + 10, 0, 0])));
    base = k(base.subtract(k(wasm.Manifold.union(cuts))));
    if (tex && p.baseTex && depth > 0) {
      base = k(
        base.warpBatch((v, count) => {
          for (let i = 0; i < count; i++) {
            const x = v[3 * i];
            const y = v[3 * i + 1];
            const z = v[3 * i + 2];
            const r = Math.hypot(x, y);
            if (r < sockR + 6) continue;
            const a = Math.atan2(y, x);
            const d = depth * tex(a, z) * smooth(notchH + 0.4, notchH + 3, z) * smooth(sockR + 6, sockR + 14, r);
            v[3 * i] = (x / r) * (r + d);
            v[3 * i + 1] = (y / r) * (r + d);
          }
        }),
      );
    }
    out.push({ name: 'Base', m: base, role: 'base' });
  }
  return out;
}
