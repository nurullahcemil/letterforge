import type { ManifoldToplevel, CrossSection, Manifold } from 'manifold-3d';

/**
 * Terrace planter (no text): an organic tray made of one or more "hills". Each hill is a stack of
 * smaller and smaller outlines that step in toward an off-centre peak; every outline is a thin wall
 * standing on one shared floor, taller the further in it is. Fill soil between the walls: the
 * levels become terraces for succulents and moss. Only upright walls on a flat floor, so it prints
 * without supports.
 */
export interface TerraceParams {
  tgHills: number; // 1–4 hills, joined into one tray
  tgTiers: number; // levels on the biggest hill (the others get one less, every other one)
  tgW: number; // overall length
  tgD: number; // overall depth (front to back)
  tgStep: number; // how far each level steps in
  tgShift: number; // % how far the peak sits off-centre
  tgH: number; // height of the outer wall
  tgRise: number; // extra height per level
  tgWall: number;
  tgFloor: number;
  tgWobble: number; // % how organic the outlines are
  tgSeed: number;
}

type Keep = <T extends { delete(): void }>(o: T) => T;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));

function rng(seed: number) {
  let s = (Math.round(seed) * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TerraceWall {
  name: string;
  m: Manifold;
}

export function buildTerrace(wasm: ManifoldToplevel, k: Keep, p: TerraceParams, warnings: string[]): TerraceWall[] {
  const n = Math.round(clamp(p.tgHills, 1, 4));
  const tiers = Math.round(clamp(p.tgTiers, 1, 6));
  const W = clamp(p.tgW, 60, 600);
  const D = clamp(p.tgD, 40, 400);
  const step = clamp(p.tgStep, 4, 60);
  const wall = clamp(p.tgWall, 0.8, 6);
  const floor = clamp(p.tgFloor, 0.8, 8);
  const H = clamp(p.tgH, 4, 120);
  const rise = clamp(p.tgRise, 0, 120);
  const wob = clamp(p.tgWobble, 0, 60) / 100;
  const shift = clamp(p.tgShift, 0, 100) / 100;
  const rnd = rng(p.tgSeed ?? 1);

  // hills side by side along the length, each an organic blob (a circle with a few slow waves)
  const R = Math.min(D / 2, W / (n + 0.6) * 0.62);
  const blob = (cx: number, cy: number, r: number, harm: { a: number; f: number; ph: number }[]): CrossSection => {
    const pts: [number, number][] = [];
    const N = 160;
    for (let i = 0; i < N; i++) {
      const t = (2 * Math.PI * i) / N;
      let s = 1;
      for (const h of harm) s += h.a * Math.cos(h.f * t + h.ph);
      pts.push([cx + r * s * Math.cos(t), cy + r * s * Math.sin(t)]);
    }
    return k(new wasm.CrossSection([pts], 'Positive'));
  };
  const hills = Array.from({ length: n }, (_, i) => {
    const cx = n === 1 ? 0 : -W / 2 + R + (i * (W - 2 * R)) / (n - 1);
    const cy = (rnd() - 0.5) * D * 0.15;
    const r = R * (0.85 + 0.3 * rnd()) * (i % 2 ? 0.88 : 1);
    const harm = [2, 3, 4].map((f) => ({ a: wob * (0.5 + rnd()) * (f === 2 ? 0.35 : 0.2), f, ph: rnd() * 2 * Math.PI }));
    const ang = rnd() * 2 * Math.PI;
    return { cx, cy, r, harm, ang, tiers: Math.max(1, tiers - (i % 2)) };
  });
  // the tray: all hills joined, the necks between them smoothed into one flowing outline
  let outline = k(wasm.CrossSection.union(hills.map((h) => blob(h.cx, h.cy, h.r * 1.08, h.harm))));
  const c = R * 0.35;
  outline = k(k(outline.offset(c, 'Round', 2, 64)).offset(-c, 'Round', 2, 64));

  const ring = (cs: CrossSection) => k(cs.subtract(k(cs.offset(-wall, 'Round', 2, 64))));
  const walls: TerraceWall[] = [];
  let shrunk = false;
  walls.push({ name: 'Tray', m: k(k(outline.extrude(floor)).add(k(ring(outline).extrude(H)))) });
  hills.forEach((h, i) => {
    let prev = outline;
    // the step shrinks if needed so every level asked for fits on this hill
    const st = Math.min(step, (h.r * 0.78) / h.tiers);
    if (st < step - 0.5) shrunk = true;
    for (let j = 1; j <= h.tiers; j++) {
      // each level: the hill's blob, smaller and moved toward the peak, kept inside the level below
      const sc = 1 - (j * st) / h.r;
      if (sc <= 0.12) break;
      const dx = Math.cos(h.ang) * shift * h.r * (1 - sc) * 0.9;
      const dy = Math.sin(h.ang) * shift * h.r * (1 - sc) * 0.9;
      let lvl = blob(h.cx + dx, h.cy + dy, h.r * sc, h.harm);
      lvl = k(lvl.intersect(k(prev.offset(-(wall + Math.min(st * 0.6, 8)), 'Round', 2, 64))));
      if (lvl.isEmpty() || lvl.area() < 200) break;
      walls.push({ name: `Hill ${i + 1} level ${j}`, m: k(ring(lvl).extrude(H + j * rise)) });
      prev = lvl;
    }
  });
  if (shrunk) warnings.push('The level step was made smaller so all the levels fit. Use fewer levels or a bigger planter for wider terraces.');
  if (wall < 1.2) warnings.push('Walls under 1.2 mm are fragile when filled with wet soil. Make them thicker.');
  warnings.push('Fill the outer ring with moss and the higher levels with gritty soil. There are no drain holes, so water lightly.');
  return walls;
}

