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

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * Coral channels (mushroom coral / Fungia model): valley centre lines grow outward from the ring.
 * Each step they wander a little (noise) and relax toward the middle of their neighbours (even
 * spacing, like real septa); when the gap between two grows wider than `wMax`, a new channel starts
 * in the middle of the gap (septa insertion). Returned as angle tracks sampled every `dr` mm.
 */
export function growChannels(r0: number, R: number, ribs: number, wob: number, seed: number) {
  const dr = 0.5;
  const nA = createNoise2D(rng(seed + 5));
  const rnd = rng(seed + 9);
  const N = Math.max(6, Math.round(ribs));
  const n0 = Math.max(5, Math.round(N * 0.7));
  const wMax = ((2 * Math.PI * R) / N) * 1.22;
  type Ch = { r: number; th: number[]; id: number };
  const all: Ch[] = [];
  let live: Ch[] = [];
  for (let k = 0; k < n0; k++) {
    const c = { r: r0, th: [(2 * Math.PI * (k + (rnd() - 0.5) * 0.35 * wob)) / n0], id: all.length };
    all.push(c);
    live.push(c);
  }
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const cur = (c: Ch) => c.th[c.th.length - 1];
  for (let r = r0 + dr; r <= R + 4; r += dr) {
    const m = live.length;
    const next = live.map((c, i) => {
      const a = cur(c), pa = cur(live[(i - 1 + m) % m]), na = cur(live[(i + 1) % m]);
      const mid = a + (wrap(pa - a) + wrap(na - a)) / 2;
      const relax = 0.035 * dr;
      const wander = wob * 0.9 * nA(c.id * 3.7, r / 14) * (dr / Math.max(r, 1));
      return a + relax * (mid - a) + wander;
    });
    live.forEach((c, i) => c.th.push(next[i]));
    // septa insertion: a new channel in the middle of every gap that got too wide
    const grown: Ch[] = [];
    for (let i = 0; i < live.length; i++) {
      grown.push(live[i]);
      const a = cur(live[i]), b = cur(live[(i + 1) % live.length]);
      const gap = wrap(b - a) < 0 ? wrap(b - a) + 2 * Math.PI : wrap(b - a);
      if (gap * r > wMax) {
        const c = { r, th: [a + gap / 2 + (rnd() - 0.5) * 0.15 * gap * wob], id: all.length };
        all.push(c);
        grown.push(c);
      }
    }
    live = grown;
  }
  return { chans: all, dr, wMax, count: live.length };
}

export function buildDish(W: ManifoldToplevel, keep: <T extends { delete(): void }>(o: T) => T, dp: DishParams, warnings: string[]): DishResult {
  const R0 = dp.size / 2;
  const H = Math.max(dp.height, dp.floor + 2);
  const floorZ = dp.floor;
  const w = Math.min(0.6, Math.max(0.08, dp.well));
  const wellR = w * R0;
  const wd = Math.max(0, Math.min(dp.wellDepth, H - floorZ - 1));
  const ringW = Math.max(2, R0 * 0.05); // flat ring between the well and the channels
  const r1 = wellR + wd; // top of the 45° step out of the well
  const rC = r1 + ringW; // channels start here
  const wob = Math.max(0, Math.min(1, dp.wobble));
  const swirl = (dp.swirl * Math.PI) / 180;
  const seed = dp.seed || 1;
  const { chans, dr, wMax } = growChannels(rC, R0, dp.ribs, wob, seed);
  const nA = createNoise2D(rng(seed + 11)), nB = createNoise2D(rng(seed + 23)), nC = createNoise2D(rng(seed + 37));
  const bump = (x: number, y: number) => dp.bumps * (0.55 * nA(x / 9, y / 9) + 0.3 * nB(x / 3.6, y / 3.6) + 0.15 * nC(x / 1.6, y / 1.6));
  const TAU = 2 * Math.PI;
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  // grid: fine enough that the knife-edge walls stay sharp (~0.5 mm preview, ~0.4 mm download)
  const fine = (dp.perRib ?? 16) > 18;
  const cell = fine ? 0.42 : 0.6;
  const NT = Math.max(360, Math.min(2400, Math.round((TAU * R0) / cell)));
  const rows: number[] = [];
  const NW = 10;
  for (let i = 1; i <= NW; i++) rows.push((wellR * i) / NW);
  if (wd > 0.05) rows.push(r1);
  rows.push(rC - 0.6);
  const nb = Math.max(40, Math.round((R0 - rC) / (cell * 1.25)));
  for (let i = 0; i <= nb; i++) rows.push(rC + ((R0 - rC) * i) / nb);
  const NR = rows.length;

  /** Channel field at radius r, angle th: depth share (0 on a wall, 1 on a channel line) + width there. */
  const field = (() => {
    let rowR = -1;
    let cand: { a: number; dz: number; r: number }[] = [];
    return (r: number, th: number) => {
      if (r !== rowR) {
        rowR = r;
        cand = [];
        for (const c of chans) {
          const lead = c.r - r;
          if (lead > wMax) continue;
          const idx = Math.min(c.th.length - 1, Math.max(0, Math.round((r - c.r) / dr)));
          cand.push({ a: c.th[idx], dz: Math.max(0, lead), r: c.r });
        }
      }
      let d1 = Infinity, d2 = Infinity, s1 = 0;
      for (const c of cand) {
        const d = Math.hypot(r * wrap(th - c.a), c.dz);
        if (d < d1) { d2 = d1; d1 = d; s1 = c.r; } else if (d < d2) d2 = d;
      }
      const t = d2 + d1 > 1e-9 ? (d2 - d1) / (d2 + d1) : 0;
      return { t, width: d1 + d2, start: s1 };
    };
  })();
  /** Round-bottomed channel, knife-edge wall: a circle arc across. */
  const prof = (t: number) => Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));

  // rim: points where the walls reach the edge, pulled in over the channels
  const rimT = new Float64Array(NT);
  for (let j = 0; j < NT; j++) rimT[j] = field(R0, (TAU * j) / NT - swirl).t;

  const top = new Float64Array(NR * NT * 3);
  const vMask = new Float64Array(NR * NT);
  for (let i = 0; i < NR; i++) {
    const r0 = rows[i];
    for (let j = 0; j < NT; j++) {
      const th = (TAU * j) / NT;
      const s = r0 <= rC ? 0 : (r0 - rC) / (R0 - rC);
      const r = r0 * (1 - dp.scallop * prof(rimT[j]) * s * s);
      let z: number;
      let valley = 0;
      if (r0 <= wellR) z = floorZ;
      else if (r0 <= r1) z = floorZ + (wd * (r0 - wellR)) / Math.max(1e-6, r1 - wellR);
      else {
        z = floorZ + wd + (H - floorZ - wd) * Math.pow(s, 1.3);
        const f = field(r0, th - swirl * s * s);
        // deeper where the channel is wide; a new channel deepens from its rounded tip
        // a half-round channel: as deep as half its width (up to `depth`)
        const D = Math.min(dp.depth, 0.48 * f.width) * smooth((r0 - f.start + 2.5) / 7) * smooth((r0 - rC + 1.5) / 3);
        valley = prof(f.t);
        z = Math.max(floorZ + 1.2, z - D * valley);
      }
      const x = r * Math.cos(th), y = r * Math.sin(th);
      if (dp.bumps > 0) {
        // rough inside the channels (like the hand-made original), walls stay crisp
        const k = r0 <= wellR ? (dp.bumpWell ? 0.5 * smooth((r0 / wellR - 0.15) / 0.3) : 0) : r0 <= rC ? 0.25 : 0.2 + 0.8 * valley;
        z += bump(x, y) * k;
      }
      const q = (i * NT + j) * 3;
      top[q] = x;
      top[q + 1] = y;
      top[q + 2] = z;
      vMask[i * NT + j] = valley;
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
      bot[i] = rows[i] <= wellR ? 0 : top[k + 2] - dp.wall;
    }
    let mn = Infinity;
    for (let i = NR - 1; i >= 0; i--) {
      mn = Math.min(mn, bot[i] - sAlong[i]);
      botZ[i * NT + j] = Math.max(0, sAlong[i] + mn);
    }
  }
  // the underside of neighbouring columns can differ a lot under a knife edge; keep it smooth across
  // (only ever lowering it, so it stays under the top and at least as steep)
  for (let i = 0; i < NR; i++) {
    const row = botZ.subarray(i * NT, (i + 1) * NT);
    const out = new Float64Array(NT);
    const span = 4;
    for (let j = 0; j < NT; j++) {
      let m = row[j];
      for (let k = -span; k <= span; k++) m = Math.min(m, row[(j + k + NT) % NT]);
      out[j] = m;
    }
    row.set(out);
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
      // split each quad along its shorter diagonal in height so walls stay knife sharp
      const a = vp[tv(i, j) * 3 + 2], b = vp[tv(i + 1, j) * 3 + 2], c = vp[tv(i + 1, j + 1) * 3 + 2], d = vp[tv(i, j + 1) * 3 + 2];
      if (Math.abs(a - c) <= Math.abs(b - d)) tri.push(tv(i, j), tv(i + 1, j), tv(i + 1, j + 1), tv(i, j), tv(i + 1, j + 1), tv(i, j + 1));
      else tri.push(tv(i, j), tv(i + 1, j), tv(i, j + 1), tv(i + 1, j), tv(i + 1, j + 1), tv(i, j + 1));
      tri.push(bv(i, j), bv(i + 1, j + 1), bv(i + 1, j), bv(i, j), bv(i, j + 1), bv(i + 1, j + 1));
    }
    const e = NR - 1;
    tri.push(tv(e, j), bv(e, j), bv(e, j + 1), tv(e, j), bv(e, j + 1), tv(e, j + 1));
  }
  void vMask;
  const make = () => keep(new W.Manifold(new W.Mesh({ numProp: 3, vertProperties: vp, triVerts: new Uint32Array(tri) })));
  let m = make();
  if (m.volume() < 0) {
    for (let i = 0; i < tri.length; i += 3) [tri[i + 1], tri[i + 2]] = [tri[i + 2], tri[i + 1]];
    m = make();
  }
  if (m.status() !== 'NoError') warnings.push('The dish shape has a problem. Try fewer ribs or less depth.');
  let footR = 0;
  for (let i = 0; i < NR; i++) if (botZ[i * NT] <= 1e-6) footR = rows[i];
  if (footR < R0 * 0.3) warnings.push('Only a small foot touches the bed. Make the dish less steep or wider so it stands well.');
  return { m, wellR, floorZ, R: R0 };
}

/**
 * Raised veins for the middle, grown with space colonisation (Runions et al. 2005, the model used
 * for leaf veins and coral-like branching): random attraction points fill the disc; every step each
 * point pulls on its nearest branch tip, tips grow one step toward the average pull, points that are
 * reached are used up. Branch width follows the pipe model (w ∝ tips below ^ 1/2.5), so the
 * veins are thick at the centre and fine at the edge. Returned as one outline of radius `r`.
 */
export function veins(W: ManifoldToplevel, keep: <T extends { delete(): void }>(o: T) => T, r: number, seed: number): CrossSection {
  const rnd = rng(seed * 7 + 3);
  const L = Math.max(0.8, r / 30); // growth step
  const kill = L * 1.6;
  const reach = r * 0.45;
  const att: [number, number][] = [];
  for (let i = 0; i < 900; i++) {
    const a = rnd() * 2 * Math.PI, q = r * 0.97 * Math.sqrt(rnd());
    att.push([q * Math.cos(a), q * Math.sin(a)]);
  }
  const nx: number[] = [0], ny: number[] = [0], par: number[] = [-1];
  for (let it = 0; it < 400 && att.length; it++) {
    const pull = new Map<number, [number, number, number]>();
    for (const [ax, ay] of att) {
      let best = -1, bd = reach;
      for (let k = 0; k < nx.length; k++) {
        const d = Math.hypot(ax - nx[k], ay - ny[k]);
        if (d < bd) { bd = d; best = k; }
      }
      if (best < 0) continue;
      const v = pull.get(best) ?? [0, 0, 0];
      v[0] += (ax - nx[best]) / bd; v[1] += (ay - ny[best]) / bd; v[2]++;
      pull.set(best, v);
    }
    if (!pull.size) break;
    for (const [k, [vx, vy]] of pull) {
      const l = Math.hypot(vx, vy);
      if (l < 1e-6) continue;
      const x = nx[k] + (L * vx) / l, y = ny[k] + (L * vy) / l;
      nx.push(x); ny.push(y); par.push(k);
    }
    for (let i = att.length - 1; i >= 0; i--) {
      const [ax, ay] = att[i];
      for (let k = 0; k < nx.length; k++) if (Math.abs(ax - nx[k]) < kill && Math.hypot(ax - nx[k], ay - ny[k]) < kill) { att.splice(i, 1); break; }
    }
  }
  // pipe model widths: count tips below every node
  const tips = new Array(nx.length).fill(0);
  const kids = new Array(nx.length).fill(0);
  for (let k = 1; k < nx.length; k++) kids[par[k]]++;
  for (let k = nx.length - 1; k >= 0; k--) {
    if (!kids[k]) tips[k] = 1;
    if (par[k] >= 0) tips[par[k]] += tips[k];
  }
  const wTip = Math.max(0.28, r / 90);
  const half = (k: number) => Math.min(r * 0.06, wTip * Math.pow(tips[k], 1 / 2.5));
  const polys: Vec2[][] = [];
  const disc = (x: number, y: number, rr: number) => {
    const p: Vec2[] = [];
    for (let i = 0; i < 10; i++) p.push([x + rr * Math.cos((i / 10) * 2 * Math.PI), y + rr * Math.sin((i / 10) * 2 * Math.PI)]);
    polys.push(p);
  };
  for (let k = 1; k < nx.length; k++) {
    const p = par[k];
    const x0 = nx[p], y0 = ny[p], x1 = nx[k], y1 = ny[k];
    const w0 = half(k) * 1.05, w1 = half(k);
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
    const ux = -dy / l, uy = dx / l;
    polys.push([[x0 - ux * w0, y0 - uy * w0], [x1 - ux * w1, y1 - uy * w1], [x1 + ux * w1, y1 + uy * w1], [x0 + ux * w0, y0 + uy * w0]]);
    disc(x1, y1, w1);
  }
  disc(0, 0, half(0) * 1.2);
  const cs = keep(new W.CrossSection(polys, 'NonZero'));
  return keep(cs.intersect(keep(W.CrossSection.circle(r, 96))));
}
