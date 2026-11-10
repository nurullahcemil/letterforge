import type { ManifoldToplevel, CrossSection, Manifold } from 'manifold-3d';

/** Settings of the lamp style (all lengths in mm). */
export interface LampParams {
  lampShow: 'both' | 'shade' | 'base';
  lampView: 'assembled' | 'print';
  /** Build at full detail (downloads); otherwise a lighter preview. */
  lampFine?: boolean;
  /** barrel = round bulges stacked like a tower; cone = umbrella tiers with a closed top. */
  lampTier: 'barrel' | 'cone';
  shTiers: number;
  /** Size across the corners (or the diameter when round). */
  shDia: number;
  shTierH: number; // barrel: height of each bulge
  shShrink: number; // % smaller per tier going up
  shPuff: number; // % how far the waist between tiers pulls in
  shRim: number; // cone: height of the upright rim band
  shSlope: number; // cone: degrees the top of each tier rises toward the middle
  shUnder: number; // cone: degrees the underside leans out from upright
  shRound: number; // cone: rounding of rims and waists
  shTopHole: number; // cone: vent at the top (0 = closed)
  shSides: number; // 0 = round
  shCorner: number; // % corner rounding (100 = round)
  shTwist: number; // degrees per tier
  lampWall: number;
  lampTex: 'none' | 'dots' | 'ribs' | 'rings';
  lampTexSize: number;
  lampTexDepth: number;
  socketD: number;
  jointD: number; // outside diameter of the base neck that the shade locks onto
  jointFit: number; // gap between neck and shade collar
  hubSpokes: number;
  baseH: number; // body height, without the neck
  baseD: number;
  baseTaper: number; // top diameter, % of bottom
  baseRound: number;
  neckH: number;
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

export interface LampResult {
  pieces: LampPiece[];
  /** Height of the shade's bottom above the base's bottom when assembled. */
  shadeZ: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const DEG = Math.PI / 180;

// ---------- twist lock ----------
// Three lugs stick out of the base neck. The shade's collar has three L-shaped slots on the inside:
// drop the shade on (lugs slide up the short slots), then turn it to lock.
const LUGS = 3;
const LUG_DEG = 22; // width of a lug
const LUG_H = 4; // height of a lug
const LUG_D = 1.8; // how far a lug sticks out
const SLOT_PLAY = 0.4; // extra room around a lug in its slot
const TURN_DEG = 32; // how far the shade turns to lock
export const LAMP_TURN = TURN_DEG;
const COLLAR_H = 14;
const COLLAR_WALL = 4.5;
const LIFT = 1; // gap between the base shoulder and the bottom of the shade
const SLOT_LOW = 6; // slot floor above the collar bottom

function joint(p: LampParams) {
  const neckR = Math.max(p.jointD / 2, p.socketD / 2 + 5);
  const collarIn = neckR + clamp(p.jointFit, 0.1, 1.5);
  return { neckR, collarIn, collarOut: collarIn + COLLAR_WALL };
}

// ---------- outlines ----------

/**
 * Outer outline of the shade in the (r, z) plane, mirrored to both sides of the axis.
 * barrel: round bulges with sharp waists, open at top and bottom.
 * cone: underside rising out at `shUnder`°, an upright rim band, then a cone back in at `shSlope`°.
 */
export function shadeOutline(p: LampParams): { pts: Pt[]; lip: number; top: number; topR: number } {
  const N = Math.max(1, Math.round(p.shTiers));
  const R = (i: number) => (p.shDia / 2) * Math.pow(1 - p.shShrink / 100, i);
  const right: Pt[] = [];
  if (p.lampTier === 'barrel') {
    const waist = 1 - clamp(p.shPuff / 100, 0, 0.95) * 0.5;
    const H = Math.max(5, p.shTierH);
    let z = 0;
    for (let i = 0; i < N; i++) {
      const Ri = R(i);
      const rb = (i === 0 ? Ri : Math.min(Ri, R(i - 1))) * waist;
      const rt = (i === N - 1 ? Ri : Math.min(Ri, R(i + 1))) * waist;
      const steps = 64;
      // a circular arc through both waists and the widest point
      const sag = Math.max(0.5, Ri - (rb + rt) / 2);
      const rho = (sag * sag + (H / 2) ** 2) / (2 * sag);
      for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
        const t = k / steps;
        const dz = H * (t - 0.5);
        const r = Ri - rho + Math.sqrt(Math.max(0, rho * rho - dz * dz)) + (rt - rb) * (t - 0.5);
        right.push([r, z + H * t]);
      }
      z += H;
    }
    const lip = right[0][0];
    const top = z;
    const topR = right[right.length - 1][0];
    const full: Pt[] = [[0, 0], ...right, [0, top]];
    return { pts: mirror(full), lip, top, topR };
  }
  const pinch = clamp(p.shPuff / 100, 0, 0.95) * 0.5;
  const tu = Math.tan(clamp(p.shUnder, 5, 80) * DEG);
  const ts = Math.tan(clamp(p.shSlope, 5, 80) * DEG);
  const lip = R(0) * (1 - pinch);
  right.push([lip - 20 * tu, -20]); // runs below the bed; trimmed after rounding so the rim stands flat
  let r = lip;
  let z = 0;
  for (let i = 0; i < N; i++) {
    const Ri = R(i);
    z += (Ri - r) / tu;
    right.push([Ri, z]);
    z += Math.max(0.5, p.shRim);
    right.push([Ri, z]);
    const nt = i === N - 1 ? 0 : R(i + 1) * (1 - pinch);
    z += (Ri - nt) * ts;
    r = nt;
    right.push([r, z]);
  }
  return { pts: mirror(right), lip, top: z, topR: 0 };
}

function mirror(right: Pt[]): Pt[] {
  const r = right.filter((pt, i) => i === 0 || i === right.length - 1 || pt[0] > 0);
  return [...r, ...r.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Pt)].filter(
    (pt, i, a) => i === 0 || Math.hypot(pt[0] - a[i - 1][0], pt[1] - a[i - 1][1]) > 1e-9,
  );
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

/**
 * Plan shape as a factor (≤ 1) of the corner radius: a regular polygon with rounded corners.
 * shCorner = corner radius as % of the corner distance (100 = round).
 */
export function planShape(p: LampParams): (a: number) => number {
  const n = Math.round(p.shSides);
  const c = clamp(p.shCorner / 100, 0, 1);
  if (n < 3 || c >= 0.999) return () => 1;
  const half = Math.PI / n;
  const rc = c; // corner radius (unit corner distance)
  const dc = 1 - rc; // distance to the corner circle's centre
  const a = dc * Math.cos(half) + rc; // distance to the flat sides
  const edgeHalf = dc * Math.sin(half); // half length of the straight part of a side
  return (ang: number) => {
    // angle from the nearest corner direction (corners at 0, 2π/n, …)
    let psi = ((ang % (2 * half)) + 2 * half) % (2 * half);
    if (psi > half) psi = 2 * half - psi;
    const phi = half - psi; // angle from the side's normal
    const rEdge = a / Math.cos(phi);
    if (Math.abs(a * Math.tan(phi)) <= edgeHalf + 1e-9) return rEdge;
    const s = Math.sin(psi);
    return dc * Math.cos(psi) + Math.sqrt(Math.max(0, rc * rc - dc * dc * s * s));
  };
}

/** Surface pattern 0..1 at angle a (radians) and distance along the surface v. */
function pattern(p: LampParams, rRef: number) {
  const size = Math.max(2, p.lampTexSize);
  const around = Math.max(6, Math.round((2 * Math.PI * rRef) / size)); // whole number of bumps → no seam
  const tau = 2 * Math.PI;
  switch (p.lampTex) {
    case 'dots':
      return (a: number, v: number) => ((1 + Math.cos(tau * (a / tau) * around) * Math.cos((tau * v) / size)) / 2) ** 1.5;
    case 'ribs':
      return (a: number) => ((1 - Math.cos(tau * (a / tau) * around)) / 2) ** 0.8;
    case 'rings':
      return (_a: number, v: number) => ((1 - Math.cos((tau * v) / size)) / 2) ** 0.8;
    default:
      return null;
  }
}

/** A ring sector (r0..r1, z0..z1) spanning `deg` degrees, starting at angle `start`. */
function sector(wasm: ManifoldToplevel, k: Keep, r0: number, r1: number, z0: number, z1: number, start: number, deg: number, chamferBelow = 0): Manifold {
  const prof: Pt[] = chamferBelow > 0
    ? [[r0, z0 - chamferBelow], [r1, z0], [r1, z1], [r0, z1]]
    : [[r0, z0], [r1, z0], [r1, z1], [r0, z1]];
  const cs = k(new wasm.CrossSection([prof], 'Positive'));
  const segs = Math.max(8, Math.round((360 / Math.max(1, deg)) * Math.max(4, deg / 3)));
  const m = k(wasm.Manifold.revolve(cs, segs, deg));
  return k(m.rotate([0, 0, start]));
}

export function buildLamp(wasm: ManifoldToplevel, k: Keep, p: LampParams, warnings: string[]): LampResult {
  const pieces: LampPiece[] = [];
  const w = clamp(p.lampWall, 0.4, 6);
  const tex = pattern(p, p.shDia / 2);
  const depth = tex ? clamp(p.lampTexDepth, 0, 4) : 0;
  // finer mesh for the files; a lighter one while editing
  const step = tex ? clamp(p.lampTexSize / (p.lampFine ? 4 : 2.5), 0.6, 3) : p.lampFine ? 1.5 : 2.5;
  const sockR = p.socketD / 2;
  const J = joint(p);
  const S = planShape(p);
  let sMin = 1;
  for (let i = 0; i < 360; i++) sMin = Math.min(sMin, S(i * DEG));

  if (p.lampShow !== 'base') {
    const { pts, lip, top, topR } = shadeOutline(p);
    if (lip * sMin - w < J.collarOut + 8) warnings.push('The shade opening is too small for the joint. Make the shade wider, the waist shallower or the corners rounder.');
    if (p.lampTier === 'cone') {
      const lean = Math.max(p.shUnder, 90 - p.shSlope);
      if (lean > 62) warnings.push(`Some walls lean ${Math.round(lean)}° from upright; over about 60° may sag. Raise "Top slope" or lower "Underside angle".`);
    }
    let A = k(new wasm.CrossSection([pts], 'NonZero'));
    if (p.lampTier === 'cone') {
      const rr = clamp(p.shRound, 0, 40);
      if (rr > 0.2) {
        A = k(k(A.offset(-rr, 'Round', 2, 64)).offset(rr, 'Round', 2, 64)); // round the rims
        const rw = rr * 0.6;
        A = k(k(A.offset(rw, 'Round', 2, 64)).offset(-rw, 'Round', 2, 64)); // soften the waists
      }
    } else {
      A = k(k(A.offset(0.8, 'Round', 2, 32)).offset(-0.8, 'Round', 2, 32)); // tiny fillet in the waists
    }
    const big = 4 * p.shDia;
    A = k(A.intersect(k(wasm.CrossSection.square([big, top]).translate([-big / 2, 0]))));
    let wall = k(A.subtract(k(A.offset(-w, 'Round', 2, 48))));
    const rimIn = lip - w * 1.5;
    wall = k(wall.subtract(k(wasm.CrossSection.square([2 * rimIn, w + 0.02]).translate([-rimIn, -0.01]))));
    if (topR > 0) {
      const tIn = topR - w * 1.5;
      wall = k(wall.subtract(k(wasm.CrossSection.square([2 * tIn, w + 1]).translate([-tIn, top - w - 0.02]))));
    }
    const topHole = p.lampTier === 'cone' ? clamp(p.shTopHole / 2, 0, lip) : 0;
    if (topHole > 0.5) wall = k(wall.subtract(k(wasm.CrossSection.square([2 * topHole, 200]).translate([-topHole, top - 100]))));
    wall = k(wall.intersect(k(wasm.CrossSection.square([big, top + 50]).translate([0, -10]))));
    const outer = (k(A.intersect(k(wasm.CrossSection.square([big, top + 50]).translate([0.01, -10])))).toPolygons()[0] ?? []) as Pt[];
    // offsets leave many tiny arcs; drop them, then add evenly spaced points for the pattern
    const prof = k(new wasm.CrossSection(densify(k(wall.simplify(0.03)).toPolygons() as Pt[][], step), 'NonZero'));
    const segs = Math.round(clamp((2 * Math.PI * (p.shDia / 2)) / (tex ? step : 2), 96, 1440));
    let shade = k(wasm.Manifold.revolve(prof, segs));
    const oc = outerCurve(outer);

    // hub at the bottom: rim ring under the wall, spokes, and the locking collar
    const hubT = 3;
    const parts: Manifold[] = [shade];
    // the ring follows the wall as it leans out, so the two fuse (and the wall's first layers are carried)
    const foot = Math.max(lip, ...oc.filter(([, z]) => z <= hubT + 0.5).map(([r]) => r)) - w * 0.4;
    const rimRing = k(k(wasm.CrossSection.circle(foot, segs)).subtract(k(wasm.CrossSection.circle(lip - 7, segs))));
    parts.push(k(rimRing.extrude(hubT)));
    const collar = k(k(wasm.CrossSection.circle(J.collarOut, 128)).subtract(k(wasm.CrossSection.circle(J.collarIn, 128))));
    parts.push(k(collar.extrude(COLLAR_H)));
    const n = Math.max(2, Math.round(p.hubSpokes));
    for (let i = 0; i < n; i++) {
      const len = lip - 6 - (J.collarOut - 1);
      const bar = k(wasm.CrossSection.square([len + 1, 8]).translate([J.collarOut - 1, -4]).rotate((360 * i) / n));
      parts.push(k(bar.extrude(hubT)));
    }
    shade = k(wasm.Manifold.union(parts));
    // L-shaped slots inside the collar
    const slots: Manifold[] = [];
    const slotR1 = J.collarIn + LUG_D + SLOT_PLAY;
    const entry = LUG_DEG + 2 * SLOT_PLAY * 4;
    const floorZ = SLOT_LOW;
    const ceilZ = SLOT_LOW + LUG_H + SLOT_PLAY;
    for (let i = 0; i < LUGS; i++) {
      const a0 = (360 * i) / LUGS - entry / 2;
      slots.push(sector(wasm, k, J.collarIn - 0.5, slotR1, -1, ceilZ, a0, entry));
      // the lugs have a 45° slope underneath, so the turning part of the slot reaches down for it
      const fit = J.collarIn - J.neckR;
      const slopeDrop = (LUG_D + 0.5) * Math.max(0, LUG_D - fit) / (LUG_D + 0.5); // slope height at the collar's inner face
      slots.push(sector(wasm, k, J.collarIn - 0.5, slotR1, floorZ + SLOT_PLAY - slopeDrop - 0.3, ceilZ, a0, entry + TURN_DEG));
    }
    shade = k(shade.subtract(k(wasm.Manifold.union(slots))));

    // plan shape, twist and texture: move every point out from the centre
    const tierH = top / Math.max(1, Math.round(p.shTiers));
    const twist = (p.shTwist * DEG) / Math.max(1, tierH);
    const fadeIn = J.collarOut + 1;
    const fadeOut = Math.max(fadeIn + 2, Math.min(J.collarOut + 12, lip * sMin - 8));
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
          const f = smooth(fadeIn, fadeOut, r); // keep the collar round
          const s = 1 - f * (1 - S(a - twist * z));
          let d = 0;
          if (tex && arc && depth > 0 && z > 0.3) {
            d = depth * tex(a, arc(r, z)) * smooth(hubT + 0.5, hubT + 3, z) * smooth(fadeOut, fadeOut + 6, r) * (topR > 0 ? smooth(top - 0.5, top - 3, z) : 1) * smooth(Math.max(4, topHole), Math.max(4, topHole) + 6, r);
          }
          const r2 = r * s + d;
          v[3 * i] = (x / r) * r2;
          v[3 * i + 1] = (y / r) * r2;
        }
      }),
    );
    pieces.push({ name: 'Shade', m: shade, role: 'shade' });
  }

  // ---------- base ----------
  const Rb = p.baseD / 2;
  const Rt = Math.max(J.neckR + 6, Rb * clamp(p.baseTaper / 100, 0.4, 1.3));
  const Hb = p.baseH;
  const neckH = Math.max(COLLAR_H + 4, p.neckH);
  const shadeZ = Hb + LIFT;
  if (p.lampShow !== 'shade') {
    const roofH = Rt - J.neckR; // 45° roof inside, so it prints without support
    const zs = Math.max(5, Hb - roofH);
    if (Hb - roofH < 5) warnings.push('The base is too short for its width; it was made a little taller.');
    // starts below the bed so rounding never eats the bottom edge; trimmed flat below
    const A0: Pt[] = [[Rb - ((Rt - Rb) / zs) * 20, -20], [Rt, zs], [J.neckR, zs + roofH], [0, zs + roofH]];
    const full: Pt[] = mirror(A0);
    let A = k(new wasm.CrossSection([full], 'NonZero'));
    const rr = clamp(p.baseRound, 0, Math.min(Rt - J.neckR, Hb) * 0.9);
    if (rr > 0.2) A = k(k(A.offset(-rr, 'Round', 2, 64)).offset(rr, 'Round', 2, 64));
    A = k(A.intersect(k(wasm.CrossSection.square([4 * Rb + 40, zs + roofH + 10]).translate([-2 * Rb - 20, 0]))));
    const bodyTop = zs + roofH;
    let wall = k(A.subtract(k(A.offset(-w * 1.25, 'Round', 2, 48))));
    wall = k(wall.subtract(k(wasm.CrossSection.square([2 * (Rb - w * 1.25), w * 1.25 + 0.02]).translate([-(Rb - w * 1.25), -0.01]))));
    // open the body under the neck
    wall = k(wall.subtract(k(wasm.CrossSection.square([2 * (J.neckR - 3), 40]).translate([-(J.neckR - 3), bodyTop - 20]))));
    // neck: a tube with a top plate holding the socket; 45° inside under the plate
    const nt = 3; // neck wall
    const plateT = 4;
    const nTop = bodyTop + neckH;
    const neck: Pt[] = [
      [J.neckR, bodyTop - 4],
      [J.neckR, nTop],
      [sockR, nTop],
      [sockR, nTop - plateT],
      [Math.max(sockR, J.neckR - nt), nTop - plateT - Math.max(0, J.neckR - nt - sockR)],
      [J.neckR - nt, bodyTop - 4],
    ];
    wall = k(wall.add(k(new wasm.CrossSection([neck], 'Positive'))));
    wall = k(wall.intersect(k(wasm.CrossSection.square([4 * Rb + 20, nTop + 10]).translate([0, -5]))));
    const prof = k(new wasm.CrossSection(densify(k(wall.simplify(0.03)).toPolygons() as Pt[][], tex && p.baseTex ? step : 2.5), 'NonZero'));
    const segs = Math.round(clamp((2 * Math.PI * Rb) / (tex && p.baseTex ? step : 2), 96, 1200));
    let base = k(wasm.Manifold.revolve(prof, segs));
    // lugs on the neck (45° underneath so they print)
    const lugs: Manifold[] = [];
    const lugZ = shadeZ + SLOT_LOW + SLOT_PLAY / 2; // sits on the slot floor when locked
    for (let i = 0; i < LUGS; i++) {
      lugs.push(sector(wasm, k, J.neckR - 0.5, J.neckR + LUG_D, lugZ, lugZ + LUG_H, (360 * i) / LUGS - LUG_DEG / 2, LUG_DEG, LUG_D + 0.5));
    }
    base = k(wasm.Manifold.union([base, ...lugs]));
    // feet: notches in the bottom edge; one wide notch lets the cable out
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
            if (r < J.neckR + 4 || z > bodyTop - 1) continue;
            const a = Math.atan2(y, x);
            const d = depth * tex(a, z) * smooth(notchH + 0.4, notchH + 3, z) * smooth(J.neckR + 4, J.neckR + 12, r) * smooth(bodyTop - 1, bodyTop - 8, z);
            v[3 * i] = (x / r) * (r + d);
            v[3 * i + 1] = (y / r) * (r + d);
          }
        }),
      );
    }
    pieces.push({ name: 'Base', m: base, role: 'base' });
  }
  return { pieces, shadeZ };
}
