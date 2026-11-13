import type { ManifoldToplevel, Manifold } from 'manifold-3d';

/**
 * Candle & mold style: our own parametric candle shapes (pleated ball, drop ornament, gem,
 * pillar, tiered tree) and a printable mold around each one.
 *
 * Every shape is a "lathe" around the z axis: a list of (z, r) profile points, and each ring of the
 * mesh has 2·sides points alternating between a ridge (radius r) and a valley (pleats) or the
 * middle of a flat face (facets). Rings can turn with height (twist).
 *
 * Molds:
 *  - two:    a block split down the middle (two halves, pins + sockets, optional bolt holes and
 *            rubber band grooves), like a classic two-part candle mold.
 *  - zigzag: a round mold split across the widest part. Outside the candle the split surface is a
 *            zigzag crown whose teeth line up with the pleats, so the halves key into each other.
 *  - open:   a one-piece cup (only for shapes that get wider toward the top).
 * The pour opening is always at the top; a wick hole goes through the bottom on the axis.
 */
export interface MoldParams {
  moldShape: 'tree' | 'ball' | 'drop' | 'gem' | 'pillar';
  moldH: number;
  moldD: number;
  moldSides: number;
  moldDepth: number;
  moldTwist: number;
  moldTiers: number;
  moldShrink: number;
  moldKind: 'two' | 'zigzag' | 'open';
  moldWall: number;
  moldWick: number;
  moldPour: number;
  moldPins: boolean;
  moldBolts: boolean;
  moldBands: boolean;
  moldZig: number;
  moldShow: 'all' | 'mold' | 'shape';
  moldView: 'open' | 'print';
  /** Build at full detail (downloads). */
  moldFine?: boolean;
  /** Tests only: also return the cavity shape. */
  moldDebug?: boolean;
}

/** Defaults that suit each shape (the UI applies them when the shape changes). */
export const MOLD_SHAPE_DEFAULTS: Record<MoldParams['moldShape'], Partial<MoldParams>> = {
  tree: { moldSides: 8, moldDepth: 0, moldTwist: 0, moldH: 110, moldD: 80, moldKind: 'two' },
  ball: { moldSides: 14, moldDepth: 5, moldTwist: 0, moldH: 70, moldD: 70, moldKind: 'zigzag' },
  drop: { moldSides: 16, moldDepth: 4, moldTwist: 0, moldH: 95, moldD: 70, moldKind: 'zigzag' },
  gem: { moldSides: 10, moldDepth: 0, moldTwist: 0, moldH: 70, moldD: 75, moldKind: 'zigzag' },
  pillar: { moldSides: 12, moldDepth: 3, moldTwist: 0, moldH: 80, moldD: 60, moldKind: 'open' },
};

export interface MoldPiece {
  name: string;
  role: 'mold' | 'shape';
  /** As shown in the preview. */
  view: Manifold;
  /** As printed (flat on the bed, any x/y; the builder lines pieces up). */
  print: Manifold;
}

export interface MoldResult {
  pieces: MoldPiece[];
  /** Candle volume in cm³. */
  volume: number;
  debug?: { cavity: Manifold; halves: Manifold[]; profile: [number, number][] };
}

type Keep = <T extends { delete(): void }>(o: T) => T;
type ZR = [number, number];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
const DEG = Math.PI / 180;

/** Profile (z up from 0 to H, r ≥ 0) in the candle's standing orientation (flat end down). */
function profile(p: MoldParams): { pts: ZR[]; H: number; R: number } {
  const H = clamp(p.moldH, 20, 300);
  const R = clamp(p.moldD, 20, 250) / 2;
  const pts: ZR[] = [];
  switch (p.moldShape) {
    case 'pillar':
      pts.push([0, R], [H, R]);
      break;
    case 'ball': {
      // a round ball (stretched if height ≠ width), pole to pole
      const n = 48;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI;
        pts.push([(H / 2) * (1 - Math.cos(a)), i === 0 || i === n ? 0 : R * Math.sin(a)]);
      }
      break;
    }
    case 'drop': {
      // point at the bottom, wide rim, cone up to a small neck for an ornament cap
      const neckR = clamp(R * 0.13, 3, 7);
      const neckH = clamp(H * 0.06, 4, 8);
      const hb = H - neckH;
      const rim = hb * 0.42;
      const n = 16;
      // slightly rounded cones (bulge out a little), so it reads as a drop, not a spinning top
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push([rim * t, i === 0 ? 0 : R * Math.pow(t, 0.8)]);
      }
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const s = 1 - Math.pow(t, 1.25);
        pts.push([rim + (hb - rim) * t, neckR + (R - neckR) * s]);
      }
      pts.push([H, neckR]);
      break;
    }
    case 'gem': {
      // table on top, crown down to the girdle, pavilion down to a point (standing: table down)
      const girdle = 0.45 * H; // measured from the table side
      const t = 0.55 * R;
      // standing orientation is the table on the bed
      pts.push([0, t], [H * 0.04, t + (R - t) * 0.06]);
      pts.push([girdle - H * 0.02, R], [girdle + H * 0.02, R]);
      pts.push([H, 0]);
      break;
    }
    case 'tree': {
      // a short trunk, then tiers that get smaller; each tier is a cone with a ledge under it
      const tiers = Math.round(clamp(p.moldTiers, 1, 6));
      const s = clamp(p.moldShrink, 0, 60) / 100;
      const trunkH = H * 0.12;
      const trunkR = R * 0.42;
      pts.push([0, trunkR], [trunkH * 0.3, trunkR], [trunkH * 0.3, trunkR - 1], [trunkH * 0.45, trunkR - 1], [trunkH * 0.45, trunkR], [trunkH, trunkR]);
      const tierH = (H - trunkH) / (tiers - (tiers - 1) * 0.35); // tiers overlap 35%
      let z = trunkH;
      for (let i = 0; i < tiers; i++) {
        const rb = R * Math.pow(1 - s, i);
        const last = i === tiers - 1;
        const top = last ? H : z + tierH;
        pts.push([z, rb]);
        if (last) pts.push([top, 0]);
        else {
          // this tier narrows toward a point; the next one starts 65 % of the way up (a ledge)
          const zNext = z + tierH * 0.65;
          pts.push([zNext, rb * (1 - 0.7 * 0.65)]);
          z = zNext;
        }
      }
      break;
    }
  }
  return { pts, H, R };
}

/** Split long profile steps so twist and curves stay smooth. */
function densify(pts: ZR[], step: number): ZR[] {
  const out: ZR[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [z0, r0] = pts[i - 1];
    const [z1, r1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(z1 - z0, r1 - r0) / step));
    for (let j = 1; j <= n; j++) out.push([z0 + ((z1 - z0) * j) / n, r0 + ((r1 - r0) * j) / n]);
  }
  return out;
}

function toManifold(wasm: ManifoldToplevel, k: Keep, pos: number[], tri: number[]): Manifold {
  // signed volume: flip the triangles if the mesh came out inside-out
  let v = 0;
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i] * 3, b = tri[i + 1] * 3, c = tri[i + 2] * 3;
    v += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (v < 0) for (let i = 0; i < tri.length; i += 3) [tri[i + 1], tri[i + 2]] = [tri[i + 2], tri[i + 1]];
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(pos), triVerts: new Uint32Array(tri) });
  // (no merge: every vertex is already shared)
  return k(new wasm.Manifold(mesh));
}

/**
 * The candle as a closed mesh, standing (flat end down), z from 0 to H.
 * Ring k-th point: angle kπ/n + twist; even k = ridge (r), odd k = valley (facet middle minus depth).
 */
function candle(wasm: ManifoldToplevel, k: Keep, p: MoldParams, fine: boolean) {
  const { pts, H, R } = profile(p);
  const n = Math.round(clamp(p.moldSides, 3, 48));
  const depth = clamp(p.moldDepth, 0, R * 0.6);
  const tw = clamp(p.moldTwist, -360, 360) * DEG;
  const prof = densify(pts, fine ? 0.6 : 1.2);
  const pos: number[] = [];
  const tri: number[] = [];
  const rings: { start: number; pole: boolean }[] = [];
  const inner = Math.cos(Math.PI / n);
  for (const [z, r] of prof) {
    const start = pos.length / 3;
    if (r < 1e-6) {
      pos.push(0, 0, z);
      rings.push({ start, pole: true });
      continue;
    }
    const rot = (tw * z) / H;
    for (let i = 0; i < 2 * n; i++) {
      const a = (i * Math.PI) / n + rot;
      const rr = i % 2 === 0 ? r : Math.max(r * 0.2, r * inner - (depth * r) / R);
      pos.push(rr * Math.cos(a), rr * Math.sin(a), z);
    }
    rings.push({ start, pole: false });
  }
  const m = 2 * n;
  const cap = (ring: { start: number }, z: number, up: boolean) => {
    const c = pos.length / 3;
    pos.push(0, 0, z);
    for (let i = 0; i < m; i++) {
      const a = ring.start + i, b = ring.start + ((i + 1) % m);
      if (up) tri.push(c, a, b);
      else tri.push(c, b, a);
    }
  };
  if (!rings[0].pole) cap(rings[0], prof[0][0], false);
  for (let j = 0; j + 1 < rings.length; j++) {
    const A = rings[j], B = rings[j + 1];
    if (A.pole && B.pole) continue;
    for (let i = 0; i < m; i++) {
      const i1 = (i + 1) % m;
      if (A.pole) tri.push(A.start, B.start + i1, B.start + i);
      else if (B.pole) tri.push(A.start + i, A.start + i1, B.start);
      else tri.push(A.start + i, A.start + i1, B.start + i1, A.start + i, B.start + i1, B.start + i);
    }
  }
  const last = rings[rings.length - 1];
  if (!last.pole) cap(last, prof[prof.length - 1][0], true);
  return { m: toManifold(wasm, k, pos, tri), H, R, n, tw, prof };
}

/**
 * A round solid from z = zBot up to a top surface zTop(ρ, θ), radius Rout. Used for the lower
 * half of the zigzag mold (its top is the zigzag parting surface).
 */
function polarSolid(wasm: ManifoldToplevel, k: Keep, zTop: (rho: number, th: number) => number, zBot: number, Rout: number, radii: number[], nAng: number): Manifold {
  const pos: number[] = [];
  const tri: number[] = [];
  const ang = (i: number) => (2 * Math.PI * i) / nAng;
  const c = 0;
  pos.push(0, 0, zTop(0, 0));
  const ringStart: number[] = [];
  for (const rho of radii) {
    ringStart.push(pos.length / 3);
    for (let i = 0; i < nAng; i++) pos.push(rho * Math.cos(ang(i)), rho * Math.sin(ang(i)), zTop(rho, ang(i)));
  }
  for (let i = 0; i < nAng; i++) tri.push(c, ringStart[0] + i, ringStart[0] + ((i + 1) % nAng));
  for (let j = 0; j + 1 < radii.length; j++) {
    const a = ringStart[j], b = ringStart[j + 1];
    for (let i = 0; i < nAng; i++) {
      const i1 = (i + 1) % nAng;
      tri.push(a + i, b + i, b + i1, a + i, b + i1, a + i1);
    }
  }
  // outer wall down to the flat bottom
  const top = ringStart[radii.length - 1];
  const bot = pos.length / 3;
  for (let i = 0; i < nAng; i++) pos.push(Rout * Math.cos(ang(i)), Rout * Math.sin(ang(i)), zBot);
  const bc = pos.length / 3;
  pos.push(0, 0, zBot);
  for (let i = 0; i < nAng; i++) {
    const i1 = (i + 1) % nAng;
    tri.push(top + i, bot + i, bot + i1, top + i, bot + i1, top + i1);
    tri.push(bc, bot + i1, bot + i);
  }
  return toManifold(wasm, k, pos, tri);
}

export function buildMold(wasm: ManifoldToplevel, k: Keep, p: MoldParams, warnings: string[]): MoldResult {
  const fine = !!p.moldFine;
  const c = candle(wasm, k, p, fine);
  const { H, R, n, tw } = c;
  const standing = c.m;
  const volume = standing.volume() / 1000;
  const pieces: MoldPiece[] = [];
  const wall = clamp(p.moldWall, 2, 30);
  const kind = p.moldKind;
  const shape = p.moldShape;
  const segs = fine ? 160 : 96;

  // pour orientation: flat end up (the pour opening), point or tip down where the wick goes
  const flip = shape !== 'drop' && shape !== 'ball';
  const cav = flip ? k(k(standing.rotate([180, 0, 0])).translate([0, 0, H])) : standing;
  // profile in pour orientation (z, r), for checks
  const pourProf: ZR[] = (flip ? c.prof.map(([z, r]) => [H - z, r] as ZR) : c.prof.slice()).sort((a, b) => a[0] - b[0]);
  const topR = pourProf.filter(([z]) => z >= H - 1e-6).reduce((a, [, r]) => Math.max(a, r), 0);
  const openTop = topR > 1.5; // a flat end at the top is the pour opening
  const pourR = clamp(p.moldPour, 4, 40) / 2;
  const topZ = openTop && shape !== 'drop' ? H : H + wall;

  // pour channel for shapes without a big flat top, wick hole through the bottom
  let cavity = cav;
  if (!openTop || shape === 'drop') {
    const r0 = shape === 'drop' ? Math.max(topR, 1) : Math.min(pourR, R * 0.5);
    const sprue = k(k(wasm.Manifold.cylinder(topZ - H + 2 + 1, r0, Math.min(pourR, R * 0.6), 48)).translate([0, 0, H - 2]));
    cavity = k(cavity.add(sprue));
  }
  const wickR = clamp(p.moldWick, 0, 8) / 2;
  if (wickR > 0.2) cavity = k(cavity.add(k(k(wasm.Manifold.cylinder(wall + 4, wickR, wickR, 24)).translate([0, 0, -wall - 1]))));

  const zBot = -wall;
  const blockH = topZ - zBot;
  let halves: Manifold[] = [];
  const names: string[] = [];
  const views: Manifold[] = [];
  const prints: Manifold[] = [];
  let candleView: Manifold = cav;

  if (kind === 'two') {
    const flange = p.moldBolts ? 11 : p.moldPins ? 8 : 0;
    const X = 2 * (R + wall + flange);
    const Y = 2 * (R + wall);
    const rr = 3;
    const cs = k(k(wasm.CrossSection.square([X - 2 * rr, Y - 2 * rr], true)).offset(rr, 'Round', 2, 24));
    let block = k(k(cs.extrude(blockH)).translate([0, 0, zBot]));
    if (p.moldBands) {
      const ring = k(k(cs.offset(1, 'Round', 2, 24)).subtract(k(cs.offset(-2, 'Round', 2, 24))));
      for (const f of [0.3, 0.7]) block = k(block.subtract(k(k(ring.extrude(6)).translate([0, 0, zBot + blockH * f - 3]))));
    }
    const xs = R + wall + flange / 2;
    if (p.moldBolts) {
      for (const sx of [-1, 1])
        for (const z of [zBot + 7, topZ - 7]) {
          const hole = k(k(k(wasm.Manifold.cylinder(Y + 2, 2.25, 2.25, 24)).rotate([90, 0, 0])).translate([sx * xs, Y / 2 + 1, z]));
          block = k(block.subtract(hole));
        }
    }
    block = k(block.subtract(cavity));
    let [b, a] = block.splitByPlane([0, 1, 0], 0); // b: y > 0, a: y < 0
    k(a);
    k(b);
    if (p.moldPins) {
      // pins on half A at different heights on each side (the halves only fit one way round)
      const px = p.moldBolts ? xs : R + wall + flange / 2;
      const spots: [number, number][] = [[px, zBot + blockH * 0.38], [-px, zBot + blockH * 0.62]];
      for (const [x, z] of spots) {
        const pin = k(k(k(wasm.Manifold.cylinder(5, 2.5, 2.1, 24)).rotate([-90, 0, 0])).translate([x, -1, z]));
        a = k(a.add(pin));
        const sock = k(k(k(wasm.Manifold.cylinder(4.5, 2.7, 2.7, 24)).rotate([-90, 0, 0])).translate([x, -0.1, z]));
        b = k(b.subtract(sock));
      }
    }
    halves = [a, b];
    names.push('Mold half A', 'Mold half B');
    // pulled apart sideways (turned so the halves open left and right on screen)
    const gap = R * 0.9 + 10;
    views.push(k(k(a.translate([0, -gap, 0])).rotate([0, 0, 90])), k(k(b.translate([0, gap, 0])).rotate([0, 0, 90])));
    candleView = k(cav.rotate([0, 0, 90]));
    // parting face up, back on the bed: the cavity opens upward, no supports
    prints.push(k(a.rotate([90, 0, 0])), k(b.rotate([-90, 0, 0])));
    const deepNote = p.moldDepth > 0.5 && (shape === 'ball' || shape === 'drop' || shape === 'pillar');
    if (deepNote) warnings.push('Pleats next to the split can catch in a two-part block. The zigzag split releases pleated shapes more easily.');
    if (Math.abs(p.moldTwist) > 1) warnings.push('Twisted pleats can lock into a two-part block. Keep the twist small, or use soft wax.');
  } else if (kind === 'zigzag') {
    // split across the widest ring of the candle
    let zEq = H / 2, rEq = 0;
    for (const [z, r] of pourProf) if (r > rEq + 1e-6) { rEq = r; zEq = z; }
    if (shape === 'tree') warnings.push('The tree has ledges all the way up, so a split across the middle will hold it. Use the two-part block.');
    if (shape === 'pillar') zEq = H / 2;
    const Rm = R + wall;
    let mold: Manifold = k(k(wasm.Manifold.cylinder(blockH, Rm, Rm, segs)).translate([0, 0, zBot]));
    mold = k(mold.subtract(cavity));
    const amp = clamp(p.moldZig, 0, wall + R * 0.4);
    const r0 = rEq + 1.5; // the candle's own seam stays a flat ring; teeth start just outside it
    const ramp = Math.max(1, amp * 0.6);
    const twEq = (tw * (flip ? H - zEq : zEq)) / H * (flip ? -1 : 1);
    const per = 4; // samples per tooth half
    const nAng = Math.max(2 * n * per, 96);
    // match the ridges: triangle wave with a peak on every ridge angle
    const zTop = (rho: number, th: number) => {
      if (amp < 0.05) return zEq;
      const t = smooth01((rho - r0) / ramp);
      let u = ((th - twEq) * n) / (2 * Math.PI);
      u -= Math.floor(u);
      const triW = 1 - 4 * Math.abs(u - 0.5); // -1 on a ridge, +1 between ridges
      return zEq + amp * t * triW * 0.5;
    };
    const rOut = Rm + 1;
    const radii: number[] = [];
    for (let i = 1; i <= 6; i++) radii.push((r0 * i) / 6);
    for (let i = 1; i <= 6; i++) radii.push(r0 + (ramp * i) / 6);
    const ring = radii.filter((r) => r < rOut - 0.2).concat([rOut]);
    // angles that hit every tooth peak exactly
    const nAngExact = 2 * n * Math.ceil(nAng / (2 * n));
    const region = polarSolid(wasm, k, zTop, zBot - 1, rOut, ring, nAngExact);
    const lower = k(mold.intersect(region));
    const upper = k(mold.subtract(region));
    halves = [lower, upper];
    names.push('Mold bottom', 'Mold top');
    // pulled apart: candle raised a little out of the bottom, top half lifted clear above it
    const rise = H * 0.35;
    const lift = rise + (H - zEq) + amp + wall + 12;
    views.push(lower, k(upper.translate([0, 0, lift])));
    candleView = k(cav.translate([0, 0, rise]));
    prints.push(lower, k(upper.rotate([180, 0, 0])));
    if (Math.abs(p.moldTwist) > 1 && shape !== 'ball') warnings.push('Twisted pleats: turn the top half as you lift it off.');
  } else {
    // open cup: needs a shape that only gets wider toward the opening
    let stuck = false;
    let prev = 0;
    for (const [, r] of pourProf) {
      if (r < prev - 0.3) { stuck = true; break; }
      prev = Math.max(prev, r);
    }
    if (stuck || !openTop) warnings.push('This shape is narrower at the top than further down, so it will get stuck in a one-piece mold. Use the two-part block or the zigzag split.');
    if (Math.abs(p.moldTwist) > 1) warnings.push('Twisted pleats: turn the candle as you pull it out.');
    const Rm = R + wall;
    let cup: Manifold = k(k(wasm.Manifold.cylinder(blockH, Rm, Rm, segs)).translate([0, 0, zBot]));
    cup = k(cup.subtract(cavity));
    halves = [cup];
    names.push('Mold');
    views.push(cup);
    candleView = k(cav.translate([0, 0, H + wall + 15]));
    prints.push(cup);
  }

  if (p.moldShow !== 'shape') {
    halves.forEach((_, i) => pieces.push({ name: names[i], role: 'mold', view: views[i], print: prints[i] }));
  }
  if (p.moldShow !== 'mold') {
    // the candle itself (a master for silicone, or a check of the shape), standing on its flat end
    const view = p.moldShow === 'shape' ? standing : candleView;
    pieces.push({ name: 'Candle', role: 'shape', view, print: standing });
  }
  if (p.moldShow !== 'mold' && (shape === 'ball' || shape === 'drop')) {
    if (p.moldShow === 'shape') warnings.push('Printing the candle shape itself (e.g. as a master for a silicone mold) needs supports under the round bottom.');
  }
  const res: MoldResult = { pieces, volume };
  if (p.moldDebug) res.debug = { cavity: cav, halves, profile: pourProf };
  return res;
}

function smooth01(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

