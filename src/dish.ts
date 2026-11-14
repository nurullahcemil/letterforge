/**
 * Ribbed dish (user photo of a fluted, dry-brushed bowl; own parametric design): a round dish whose
 * top is a ring of sharp ribs with soft hollows between them, fading into a flat round well in the
 * middle. The ribs end in points around the edge (scalloped rim) and wander a little, so it looks
 * hand made.
 *
 * Built as one closed mesh: a top surface and an underside on the same grid of rows (distance out)
 * and columns (one column per point around, following the ribs, so every crest sits exactly on a
 * mesh line and stays sharp). The underside is made printable without supports: along every column
 * it is the highest surface that stays `wall` below the top and never gets flatter than 45° where it
 * leaves the bed (g(s) = s + min over s' ≥ s of (top(s') − wall − s'), floored at 0). So a shallow
 * dish gets a flat foot with a 45° underside to the rim, a steep one becomes an even shell.
 */
import type { ManifoldToplevel, Manifold, CrossSection, Vec2 } from 'manifold-3d';
import { createNoise2D } from 'simplex-noise';

export interface DishParams {
  /** Diameter across the rib points (mm). */
  size: number;
  /** Height at the rim (mm). */
  height: number;
  ribs: number;
  /** Hollow depth between the ribs at the rim (mm). */
  depth: number;
  /** Middle well, share of the radius (0..0.7). */
  well: number;
  /** How far the well sits below the start of the ribs (mm). */
  wellDepth: number;
  /** Rim points: how far the edge pulls in between ribs, share of the radius. */
  scallop: number;
  /** Swirl of the ribs from the middle to the rim (degrees). */
  swirl: number;
  /** Hand-made wobble 0..1. */
  wobble: number;
  /** Thinnest wall (mm) and floor thickness in the well (mm). */
  wall: number;
  floor: number;
  seed: number;
  /** Bumpy hand-worked surface: bump height (mm). */
  bumps: number;
  /** Bumps on the middle floor too (not under a word). */
  bumpWell: boolean;
  /** Points per rib around (sharpness / file size). */
  perRib?: number;
}

export interface DishResult {
  m: Manifold;
  /** Radius and top height of the flat well floor. */
  wellR: number;
  floorZ: number;
  /** Outer radius (rib points). */
  R: number;
}

/** Small seeded random numbers (mulberry32). */
export function rng(seed: number) {
  let a = (Math.floor(seed * 9973) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hollow shape across one rib period: 0 on the crest (sharp), 1 in the middle of the hollow (round). */
const hollow = (phi: number) => Math.pow(Math.sin(Math.PI * phi), 0.75);
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function buildDish(W: ManifoldToplevel, keep: <T extends { delete(): void }>(o: T) => T, dp: DishParams, warnings: string[]): DishResult {
  const R0 = dp.size / 2;
  const n = Math.max(6, Math.round(dp.ribs));
  const per = Math.max(8, Math.round(dp.perRib ?? 18));
  const NT = n * per;
  const H = Math.max(dp.height, dp.floor + 2);
  const floorZ = dp.floor;
  const w = Math.min(0.7, Math.max(0.08, dp.well));
  const wellR = w * R0;
  const wd = Math.max(0, Math.min(dp.wellDepth, H - floorZ - 1));
  // rows (share of the radius): well, a 45° step up out of the well, then the ribbed bowl
  const rho1 = w + wd / R0; // end of the step
  const rows: number[] = [];
  const NW = 8;
  for (let i = 1; i <= NW; i++) rows.push((w * i) / NW);
  if (wd > 0.05) rows.push(rho1);
  const NB = Math.max(40, Math.round(Math.min(140, R0 * 1.1)));
  for (let i = 1; i <= NB; i++) rows.push(rho1 + ((1 - rho1) * i) / NB);
  const NR = rows.length;
  const rnd = rng(dp.seed || 1);
  const ph = [rnd(), rnd(), rnd(), rnd(), rnd()].map((v) => v * 2 * Math.PI);
  const wob = Math.max(0, Math.min(1, dp.wobble));
  const swirl = (dp.swirl * Math.PI) / 180;
  const step = (2 * Math.PI) / n;
  // ribs wander along their length, and are not all equally wide
  const wanderA = wob * Math.min(0.45 * step, 0.12);
  const kSp = Math.max(2, Math.round(n / 3));
  const spaceA = (wob * 0.18) / kSp;
  // bumpy surface (like hammered or hand-pressed clay): two sizes of smooth bumps + dents
  const nA = createNoise2D(rng((dp.seed || 1) + 11)), nB = createNoise2D(rng((dp.seed || 1) + 23)), nC = createNoise2D(rng((dp.seed || 1) + 37));
  const bump = (x: number, y: number) => dp.bumps * (0.55 * nA(x / 9, y / 9) + 0.3 * nB(x / 3.6, y / 3.6) + 0.15 * nC(x / 1.6, y / 1.6));

  // top surface, row by row (i) and column by column (j)
  const top = new Float64Array(NR * NT * 3);
  for (let j = 0; j < NT; j++) {
    const t0 = (2 * Math.PI * j) / NT;
    const phi = (j % per) / per;
    const v = hollow(phi);
    // each rib a little deeper or shallower (hand made)
    const dMul = 1 + 0.3 * wob * (0.6 * Math.sin(7 * t0 + ph[2]) + 0.4 * Math.sin(3 * t0 + ph[3]));
    for (let i = 0; i < NR; i++) {
      const rho = rows[i];
      const s = rho <= rho1 ? 0 : (rho - rho1) / (1 - rho1); // 0 at the start of the ribs, 1 at the rim
      // columns turn with the swirl and wander a little (not enough to cross each other)
      // (wander turns by at most ~0.46 per radian and uneven spacing by ~0.18, so columns never cross)
      const th = t0 + swirl * s * s + wanderA * s * (0.6 * Math.sin(3 * t0 + 2.2 * Math.PI * s + ph[0]) + 0.4 * Math.sin(5 * t0 - 1.6 * Math.PI * s + ph[1])) + spaceA * Math.sin(kSp * t0 + ph[4]);
      const r = rho * R0 * (1 - dp.scallop * v * s * s);
      let z: number;
      if (rho <= w) z = floorZ;
      else if (rho <= rho1) z = floorZ + (wd * (rho - w)) / Math.max(1e-6, rho1 - w);
      else {
        z = floorZ + wd + (H - floorZ - wd) * Math.pow(s, 1.6);
        // hollows fade in from the well, deepest at the rim; never below the well step
        const along = 1 + 0.35 * wob * nA(t0 * 2.5 + 40, s * 3);
        const d = dp.depth * dMul * along * smooth(s / 0.35) * (0.45 + 0.55 * s);
        z = Math.max(floorZ + wd * 0.5, z - d * v);
      }
      const k = (i * NT + j) * 3;
      const x = r * Math.cos(th), y = r * Math.sin(th);
      // bumps everywhere on the bowl (a little less on the crests so they stay crisp), fading in from the well
      if (dp.bumps > 0) {
        const f = rho <= w ? (dp.bumpWell ? 0.6 * smooth((rho / w - 0.15) / 0.3) : 0) : rho <= rho1 ? (dp.bumpWell ? 0.6 : 0.3) : 0.45 + 0.55 * Math.max(0.35, v);
        z += bump(x, y) * f;
      }
      top[k] = x;
      top[k + 1] = y;
      top[k + 2] = z;
    }
  }
  // underside per column: never flatter than 45° off the bed, at least `wall` under the top
  const bot = new Float64Array(NR);
  const botZ = new Float64Array(NR * NT);
  const sAlong = new Float64Array(NR);
  for (let j = 0; j < NT; j++) {
    let acc = 0;
    for (let i = 0; i < NR; i++) {
      const k = (i * NT + j) * 3;
      const px = i ? top[k - NT * 3] : 0, py = i ? top[k - NT * 3 + 1] : 0;
      acc += Math.hypot(top[k] - px, top[k + 1] - py);
      sAlong[i] = acc;
      bot[i] = rows[i] <= w ? 0 : top[k + 2] - dp.wall;
    }
    let mn = Infinity;
    for (let i = NR - 1; i >= 0; i--) {
      mn = Math.min(mn, bot[i] - sAlong[i]);
      botZ[i * NT + j] = Math.max(0, sAlong[i] + mn);
    }
  }
  // mesh: top pole, top grid, bottom pole, bottom grid
  const nv = 2 + 2 * NR * NT;
  const vp = new Float32Array(nv * 3);
  const T0 = 1, BP = 1 + NR * NT, B0 = BP + 1;
  vp[0] = 0; vp[1] = 0; vp[2] = floorZ;
  vp[BP * 3] = 0; vp[BP * 3 + 1] = 0; vp[BP * 3 + 2] = 0;
  for (let q = 0; q < NR * NT; q++) {
    vp[(T0 + q) * 3] = top[q * 3]; vp[(T0 + q) * 3 + 1] = top[q * 3 + 1]; vp[(T0 + q) * 3 + 2] = top[q * 3 + 2];
    vp[(B0 + q) * 3] = top[q * 3]; vp[(B0 + q) * 3 + 1] = top[q * 3 + 1]; vp[(B0 + q) * 3 + 2] = botZ[q];
  }
  const tri: number[] = [];
  const tv = (i: number, j: number) => T0 + i * NT + (j % NT);
  const bv = (i: number, j: number) => B0 + i * NT + (j % NT);
  for (let j = 0; j < NT; j++) {
    tri.push(0, tv(0, j), tv(0, j + 1));
    tri.push(BP, bv(0, j + 1), bv(0, j));
    for (let i = 0; i < NR - 1; i++) {
      tri.push(tv(i, j), tv(i + 1, j), tv(i + 1, j + 1), tv(i, j), tv(i + 1, j + 1), tv(i, j + 1));
      tri.push(bv(i, j), bv(i + 1, j + 1), bv(i + 1, j), bv(i, j), bv(i, j + 1), bv(i + 1, j + 1));
    }
    // rim wall
    const e = NR - 1;
    tri.push(tv(e, j), bv(e, j), bv(e, j + 1), tv(e, j), bv(e, j + 1), tv(e, j + 1));
  }
  const make = () => keep(new W.Manifold(new W.Mesh({ numProp: 3, vertProperties: vp, triVerts: new Uint32Array(tri) })));
  let m = make();
  if (m.volume() < 0) {
    for (let i = 0; i < tri.length; i += 3) [tri[i + 1], tri[i + 2]] = [tri[i + 2], tri[i + 1]];
    m = make();
  }
  if (m.status() !== 'NoError') warnings.push('The dish shape has a problem. Try fewer ribs or less depth.');
  // the foot: how much of the underside sits on the bed
  let footR = 0;
  for (let i = 0; i < NR; i++) if (botZ[i * NT] <= 1e-6) footR = rows[i] * R0;
  if (footR < R0 * 0.3) warnings.push('Only a small foot touches the bed. Make the dish less steep or wider so it stands well.');
  return { m, wellR, floorZ, R: R0 };
}

/**
 * Raised veins for the middle (own design, a bit like dried roots or cracks): branches grow out
 * from the centre with a random walk and split now and then, getting thinner. Returned as one
 * outline (radius `r`), to raise on the well floor.
 */
export function veins(W: ManifoldToplevel, keep: <T extends { delete(): void }>(o: T) => T, r: number, seed: number): CrossSection {
  const rnd = rng(seed * 7 + 3);
  const polys: Vec2[][] = [];
  const disc = (x: number, y: number, rr: number) => {
    const p: Vec2[] = [];
    for (let i = 0; i < 10; i++) p.push([x + rr * Math.cos((i / 10) * 2 * Math.PI), y + rr * Math.sin((i / 10) * 2 * Math.PI)]);
    polys.push(p);
  };
  const seg = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    // counter-clockwise
    polys.push([[x0 - nx * w0, y0 - ny * w0], [x1 - nx * w1, y1 - ny * w1], [x1 + nx * w1, y1 + ny * w1], [x0 + nx * w0, y0 + ny * w0]]);
    disc(x1, y1, w1);
  };
  const stepL = Math.max(1, r / 18);
  type B = { x: number; y: number; a: number; w: number };
  const K = 7 + Math.floor(rnd() * 3);
  let live: B[] = [];
  const a0 = rnd() * 2 * Math.PI;
  for (let k = 0; k < K; k++) live.push({ x: 0, y: 0, a: a0 + (k / K) * 2 * Math.PI + (rnd() - 0.5) * 0.5, w: Math.max(0.7, r * 0.05) });
  disc(0, 0, Math.max(0.9, r * 0.07));
  let count = 0;
  while (live.length && count < 2500) {
    const next: B[] = [];
    for (const b of live) {
      // mostly outward, wandering
      const out = Math.atan2(b.y, b.x);
      const pull = Math.hypot(b.x, b.y) > 0.5 ? Math.atan2(Math.sin(out - b.a), Math.cos(out - b.a)) * 0.25 : 0;
      const a = b.a + pull + (rnd() - 0.5) * 1.0;
      const x = b.x + stepL * Math.cos(a), y = b.y + stepL * Math.sin(a);
      const w1 = b.w * 0.965;
      if (Math.hypot(x, y) > r * 1.02 || w1 < 0.32) continue;
      seg(b.x, b.y, x, y, b.w, w1);
      count++;
      next.push({ x, y, a, w: w1 });
      if (rnd() < 0.3 && w1 > 0.42) next.push({ x, y, a: a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), w: w1 * 0.75 });
    }
    live = next;
  }
  const cs = keep(new W.CrossSection(polys, 'NonZero'));
  return keep(cs.intersect(keep(W.CrossSection.circle(r, 96))));
}
