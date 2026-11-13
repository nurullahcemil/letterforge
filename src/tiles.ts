import type { ManifoldToplevel, CrossSection, Manifold } from 'manifold-3d';

/**
 * Tile mold style (no text): eight-point stars and crosses that fit together into one pattern.
 * Our own construction: stars sit on a square grid of spacing L on the points where i+j is even;
 * a star is a square of side L joined with the same square turned 45°. The crosses fill what is
 * left: a cross is the diamond |x−L|+|y| ≤ L around its centre minus the four stars next to it.
 *
 * Make:
 *  - master: the tiles standing on a floor inside a box wall, to pour silicone over (the silicone
 *    mold is then used for plaster, concrete, resin or clay). Tiles taper slightly (draft).
 *  - tray:   a hard mold printed directly, with tile-shaped pockets.
 *  - cutter: one cutter per shape for pressing tiles out of rolled clay.
 */
export interface TileParams {
  tlSize: number; // star width tip to tip (mm)
  tlThick: number; // tile thickness
  tlStars: number;
  tlCrosses: number;
  tlWall: number; // gap / wall between pockets and around the edge
  tlDraft: number; // degrees
  tlMake: 'master' | 'tray' | 'cutter';
  tlFine?: boolean;
}

type Keep = <T extends { delete(): void }>(o: T) => T;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));

export interface TilePiece {
  name: string;
  role: 'mold' | 'tile';
  m: Manifold;
}

/** Star and cross outlines, each centred on 0. */
export function tileShapes(wasm: ManifoldToplevel, k: Keep, L: number): { star: CrossSection; cross: CrossSection } {
  const sq = k(wasm.CrossSection.square([L, L], true));
  const starAt = (x: number, y: number) => k(k(sq.add(k(sq.rotate(45)))).translate([x, y]));
  const star = starAt(0, 0);
  const diamond = k(k(wasm.CrossSection.square([L * Math.SQRT2, L * Math.SQRT2], true)).rotate(45));
  const cross = k(diamond.subtract(k(wasm.CrossSection.union([starAt(L, 0), starAt(-L, 0), starAt(0, L), starAt(0, -L)]))));
  return { star, cross };
}

/** Extrude with a taper: the top is `grow` mm bigger (or smaller, negative) all round than the bottom. */
function taper(k: Keep, cs: CrossSection, h: number, grow: number): Manifold {
  const b = cs.bounds();
  const sx = (b.max[0] - b.min[0] + 2 * grow) / (b.max[0] - b.min[0]);
  const sy = (b.max[1] - b.min[1] + 2 * grow) / (b.max[1] - b.min[1]);
  return k(cs.extrude(h, 0, 0, [sx, sy]));
}

export function buildTiles(wasm: ManifoldToplevel, k: Keep, p: TileParams, warnings: string[]): TilePiece[] {
  const S = clamp(p.tlSize, 20, 250);
  const L = S / Math.SQRT2;
  const t = clamp(p.tlThick, 2, 40);
  const gap = clamp(p.tlWall, 2, 30);
  const draft = (clamp(p.tlDraft, 0, 15) * Math.PI) / 180;
  const nS = Math.round(clamp(p.tlStars, 0, 12));
  const nC = Math.round(clamp(p.tlCrosses, 0, 12));
  const { star, cross } = tileShapes(wasm, k, L);
  const items: CrossSection[] = [...Array(nS).fill(star), ...Array(nC).fill(cross)];
  if (!items.length) return [];
  const span = (c: CrossSection) => {
    const b = c.bounds();
    return [b.max[0] - b.min[0], b.max[1] - b.min[1]];
  };
  // lay them out on a grid, as square as possible
  const cols = Math.ceil(Math.sqrt(items.length));
  const rows = Math.ceil(items.length / cols);
  const cw = Math.max(...items.map((c) => span(c)[0])) + gap;
  const ch = Math.max(...items.map((c) => span(c)[1])) + gap;
  const placed = items.map((c, i) => k(c.translate([(i % cols) * cw, -Math.floor(i / cols) * ch])));
  const grow = t * Math.tan(draft);
  const W = cols * cw + gap, H = rows * ch + gap;
  const ox = -cw / 2 - gap / 2, oy = ch / 2 + gap / 2; // box corner (top left)
  const box = (h: number, z = 0) => k(k(k(k(wasm.CrossSection.square([W - 6, H - 6], false)).translate([ox + 3, oy - H + 3])).offset(3, 'Round', 2, 24)).extrude(h).translate([0, 0, z]));
  const pieces: TilePiece[] = [];
  if (p.tlMake === 'tray') {
    const floor = 3;
    let tray = box(floor + t);
    for (const c of placed) {
      // pocket wider at the top so the tile lifts out
      const b = c.bounds();
      const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
      const pocket = k(k(taper(k, k(c.translate([-cx, -cy])), t + 0.02, grow)).translate([cx, cy, floor]));
      tray = k(tray.subtract(pocket));
    }
    pieces.push({ name: 'Tile mold', role: 'mold', m: tray });
    warnings.push('Use release spray. Printed molds show the print lines on the tiles; a silicone mold (Silicone master) gives smoother tiles.');
  } else if (p.tlMake === 'master') {
    // tiles standing on the floor of an open box, narrower at the top (that is the draft of the
    // silicone pockets later), silicone poured 5 mm over them
    const floor = 2.4;
    const cover = 5;
    const wallT = 2.4;
    const inner = box(floor + t + cover + 2);
    const shrink = (h: number) => k(k(k(wasm.CrossSection.square([W - 6, H - 6], false)).translate([ox + 3, oy - H + 3])).offset(3 - wallT, 'Round', 2, 24));
    let m = k(inner.subtract(k(k(shrink(0).extrude(t + cover + 10)).translate([0, 0, floor]))));
    for (const c of placed) {
      const b = c.bounds();
      const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
      const tile = k(k(taper(k, k(c.translate([-cx, -cy])), t + 0.01, -grow)).translate([cx, cy, floor - 0.01]));
      m = k(m.add(tile));
    }
    pieces.push({ name: 'Silicone master', role: 'tile', m });
    const ml = ((W - 2 * wallT) * (H - 2 * wallT) * (t + cover) - placed.reduce((a, c) => a + c.area() * t, 0)) / 1000;
    warnings.push(`Silicone needed: about ${Math.round(ml)} ml (5 mm over the tiles). The box tips over to pull the silicone out.`);
  } else {
    // clay cutters: thin blade, wider rim on top to press on (printed rim down)
    const blade = 0.9, rimW = 3, rimH = 2.4, hgt = t + 8;
    const seen = new Set<string>();
    for (const [name, c] of [['Star cutter', star], ['Cross cutter', cross]] as const) {
      if ((name === 'Star cutter' ? nS : nC) === 0 || seen.has(name)) continue;
      seen.add(name);
      const ring = k(k(c.offset(blade, 'Miter', 4)).subtract(c));
      const rim = k(k(c.offset(blade + rimW, 'Round', 2, 24)).subtract(k(c.offset(-0.01, 'Miter', 4))));
      const m = k(k(ring.extrude(hgt)).add(k(rim.extrude(rimH))));
      pieces.push({ name, role: 'mold', m });
    }
    warnings.push('Roll the clay to the tile thickness, press the cutter in, push the tile out from the rim side.');
  }
  if (W > 250 || H > 250) warnings.push(`The ${p.tlMake === 'cutter' ? 'set' : 'mold'} is ${Math.round(W)} × ${Math.round(H)} mm. Use fewer tiles or smaller ones if it's bigger than your bed.`);
  return pieces;
}
