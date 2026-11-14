import type { ManifoldToplevel, CrossSection, Manifold, Vec2 as MVec2 } from 'manifold-3d';
import * as SS from 'straight-skeleton';
import QRCode from 'qrcode';
import type { Font } from 'opentype.js';
import { layoutText, smartLines, type Vec2 } from './text';
import { buildLamp, LAMP_TURN, type LampParams } from './lamp';
import { buildMold, type MoldParams } from './mold';
import { buildTiles, type TileParams } from './tiles';
import { buildTerrace, type TerraceParams } from './terrace';

const SkeletonBuilder: typeof SS.SkeletonBuilder = (SS as any).SkeletonBuilder ?? (SS as any).default.SkeletonBuilder;

export type Style = 'sign' | 'planter' | 'topo' | 'facet' | 'keychain' | 'duo' | 'stack' | 'stepped' | 'ramp' | 'book' | 'lamp' | 'mold' | 'flower' | 'arrow' | 'pyramid' | 'tile' | 'pins' | 'lines' | 'concrete' | 'terrace' | 'standee' | 'trophy';

export interface Params extends LampParams, MoldParams, TileParams, TerraceParams {
  /** Letter flower: letters around a centre like petals. */
  flRadius?: number;
  flDepth?: number;
  flCount?: number;
  flBend?: number;
  /** Letter flower: middle size, % of the radius. */
  flMiddle?: number;
  /** Letter flower diameter (mm). */
  flSize?: number;
  /** Trophy top: 'stack' = first line turned up the side + the other lines stacked; 'badge' = a shaped plaque with raised text. */
  tpShape?: 'stack' | 'badge';
  /** Trophy badge outline. */
  tpBadge?: 'circle' | 'rounded' | 'shield' | 'bulb';
  /** Trophy badge size across (mm). */
  tpSize?: number;
  /** Trophy top thickness (mm). */
  tpDepth?: number;
  /** Trophy badge: raised text height (mm). */
  tpRaise?: number;
  /** Trophy stack: bridges small gaps between letters so the top is one piece (mm). */
  tpJoin?: number;
  /** Trophy base: 'wood' = a solid wood block (front laser-engraved, slot cut by hand), 'printed' = 3D printed block, 'none'. ('layers' = old name of 'wood'.) */
  tpBase?: 'wood' | 'layers' | 'printed' | 'none';
  tpBaseW?: number;
  tpBaseH?: number;
  tpBaseD?: number;
  /** Engraved on the base front. */
  tpTitle?: string;
  tpSub?: string;
  tpYear?: string;
  /** Word stand: thickness of the flat back (mm). */
  sdThick?: number;
  /** Word stand: width of the raised letter lines (mm). */
  sdLine?: number;
  /** Word stand: how far the letter lines stand off the back (mm). */
  sdRaise?: number;
  /** Word stand: outline margin around the letters (mm). */
  sdMargin?: number;
  /** Word stand: what is raised on the front: 'outline' = letter outlines + edge, 'solid' = whole letters. */
  sdLetters?: 'outline' | 'solid';
  /** Word stand: 'printed' = a printed stand with a slot, 'none' = just the word piece. */
  sdStand?: 'printed' | 'none';
  /** Word stand: stand depth front to back (mm). */
  sdStandD?: number;
  /** Word stand: play in the slot (mm, each side). */
  sdFit?: number;
  /** Letter flower: 'one' = all text in one flower, 'row' = one flower per word, side by side (wall art). */
  flLayout?: 'one' | 'row';
  /** Letter flower row: gap between the flowers (mm). */
  flGap?: number;
  /** Arrow sign: shaped board, block-shadow letters. */
  arShape?: 'turn' | 'arrow' | 'rect' | 'circle';
  arDir?: 'right' | 'left' | 'up' | 'down';
  arMargin?: number;
  arRound?: number;
  arBoard?: number;
  arShadowLen?: number;
  arShadowAng?: number;
  arShadowT?: number;
  arLetterT?: number;
  colorC?: string;
  /** Concrete letters: silicone master (letters on a base in a box) or a hard mold (letter pockets). */
  ccMake?: 'master' | 'mold';
  ccDepth?: number;
  ccWall?: number;
  ccFloor?: number;
  ccDraft?: number;
  ccShape?: 'outline' | 'block';
  ccHoles?: boolean;
  ccHoleD?: number;
  /** Line letters: each letter in its own square tile, made of thin standing fins. */
  lnTile?: number;
  lnPitch?: number;
  lnFin?: number;
  lnHeight?: number;
  lnBack?: number;
  lnBase?: number;
  lnCols?: number;
  lnSeed?: number;
  /** Pin art: a grid of round pins whose heights follow a pattern. */
  pinMode?: 'letters' | 'wave' | 'ripple' | 'halo';
  pinPitch?: number;
  pinD?: number;
  pinMin?: number;
  pinMax?: number;
  pinWaves?: number;
  pinAngle?: number;
  pinSoft?: number;
  pinGrow?: boolean;
  pinPlate?: number;
  pinPad?: number;
  pinW?: number;
  pinH?: number;
  pinFrame?: boolean;
  /** Pin art with waves/ripples: your text shows as taller ('up') or shorter ('down') pins. */
  pinText?: 'none' | 'up' | 'down';
  /** Square grid or circles around the middle; empty hole in the middle (mm); pin tops. */
  pinLayout?: 'grid' | 'rings';
  pinHole?: number;
  pinTip?: 'flat' | 'round' | 'tube';
  /** Print the pins apart from the base: the base gets a hole per pin. */
  pinSeparate?: boolean;
  pinSocket?: number;
  pinFit?: number;
  /** Pyramid-tile letters. */
  pyCell?: number;
  pyHeight?: number;
  pyBase?: number;
  pyMix?: number;
  pySeed?: number;
  pyRotate?: boolean;
  /** Mix letters (variable fonts): which axes to shuffle and how far (%). */
  mixWght?: boolean;
  mixWdth?: boolean;
  mixItal?: boolean;
  mixAmount?: number;
  /** Made-up letter style for fonts without these settings: width %, slant degrees, extra
   * thickness mm (negative = thinner). Real variable-font axes go in fontVar instead. */
  textWidth?: number;
  textSlant?: number;
  textBold?: number;
  /** Downloads: simplify meshes within 0.02 mm (meshoptimizer). */
  lightFiles?: boolean;
  /** Artwork (SVG or traced picture): outlines 1 unit tall, centred on 0, y up (see art.ts). */
  art?: { name: string; contours: [number, number][][]; aspect: number };
  artSize?: number;
  artPlace?: 'left' | 'right' | 'above' | 'below' | 'center';
  artGap?: number;
  artX?: number;
  artY?: number;
  artRot?: number;
  /** Picture tracing (page only): darkness threshold 0–255 and swap shape/background. */
  artThreshold?: number;
  artInvert?: boolean;
  /** Variable font axes for the main font; used only while `key` is the selected font. */
  fontVar?: { key: string; axes: Record<string, number> };
  /** Laser-cut wooden backing (a board behind the letters; SVG for the laser, preview only in 3D). */
  backOn?: boolean;
  backShape?: 'outline' | 'rect';
  backMargin?: number;
  backRound?: number;
  backHoles?: 'none' | 'two' | 'four';
  backHoleD?: number;
  backT?: number;
  backGuide?: boolean;
  /** Laser kerf (mm): the cut path moves out by half of it, so the board comes out at true size. */
  backKerf?: number;
  style: Style;
  text: string;
  capHeight: number;
  tracking: number;
  lineSpacing: number;
  // sign
  depth: number;
  base: 'bar' | 'plate' | 'none';
  baseHeight: number;
  platePadding: number;
  letterRelief: number;
  qrText: string;
  qrRelief: number;
  // planter
  wallHeight: number;
  wall: number;
  floor: number;
  // topo
  layers: number;
  layerThickness: number;
  step: number;
  rim: number;
  topoMode: 'bowl' | 'stack';
  openCenter: boolean;
  wobble: number;
  seed: number;
  // facet
  facetWall: number;
  angle: number;
  cap: number;
  // output
  splitBed: boolean;
  bedSize: number;
  colorA: string;
  colorB: string;
  // keychain
  kcOutline: number;
  kcBase: number;
  kcTier: number;
  kcText: number;
  ringHole: number;
  ringWall: number;
  // vase (flower stand)
  topText: string;
  topFont: string;
  topCap: number;
  topThickness: number;
  vDepth: number;
  holeD: number;
  holeDepth: number;
  holeWall: number;
  vBar: boolean;
  vHoles: boolean;
  topDx: number;
  topDy: number;
  // bold stack
  stDepth: number;
  stStep: number;
  stMode: 'cascade' | 'alternate';
  stRound: number;
  stStretch: boolean;
  // stepped
  spSteps: number;
  spHeight: number;
  spInset: number;
  spJoin: 'Miter' | 'Round';
  // ramp relief
  rMin: number;
  rMax: number;
  rDir: 'right' | 'left' | 'alternate';
  rSpan: 'letter' | 'line';
  rPlate: boolean;
  rPlateT: number;
  rPad: number;
  // book sleeve
  bookW: number;
  bookH: number;
  bookT: number;
  bookClear: number;
  bookWall: number;
  bookCover: number;
  bookEffect: 'flat' | 'ramp' | 'sweep';
  bookFit: boolean;
  bookStretch: boolean;
  bookMargin: number;
  bookAlign: 'left' | 'center';
  rLean: number;
  bookRelief: number;
  bookOrient: 'lying' | 'standing';
  textDx: number;
  textDy: number;
  /** Line letters: only a thin outline of each letter instead of the solid shape. */
  lineMode: boolean;
  lineW: number;
  /** Width factor per letter (key = index among the text's non-space characters). */
  letterW: Record<string, number>;
  /** Move (mm) / rotate (degrees) single letters; same keys as letterW. */
  letterMove: Record<string, { dx?: number; dy?: number; rot?: number; wght?: number; wdth?: number; slnt?: number; ital?: number; bold?: number; slant?: number }>;
  // stepped base
  spBase: boolean;
  spBaseT: number;
  spBasePad: number;
  spBaseShape: 'rect' | 'outline';
}

/** A part the user can drag in the viewer. axes = model axes the 2D offset maps to. */
export interface DragInfo {
  /** 'letter:<n>' moves one letter (n = index among non-space characters). */
  key: 'top' | 'main' | 'text' | `letter:${number}`;
  axes: [number, number];
}

export interface Part {
  name: string;
  color: string;
  positions: Float32Array;
  indices: Uint32Array;
  /** Shown in the viewer only (e.g. moss fill); never exported. */
  previewOnly?: boolean;
  drag?: DragInfo;
  /** Lamp, assembled view: move the part by this to get its print position. */
  printOffset?: [number, number, number];
  /** Lamp, assembled view: the part as printed, when it can't just be moved there. */
  printMesh?: { positions: Float32Array; indices: Uint32Array };
}

export interface BuildResult {
  parts: Part[];
  warnings: string[];
  size: [number, number, number];
  /** Where each letter sits on the model (model x/y, mm), for picking letters on the canvas. */
  letters: { i: number; x: number; y: number }[];
  /** Laser-cut backing, in model x/y mm: `cut` = board outline and holes, `guide` = where the letters sit. */
  backing?: { cut: [number, number][][]; guide: [number, number][][]; size: [number, number]; pieces: number; engrave?: [number, number][][]; sheets?: number; what?: string; slot?: [number, number, number] };
}

interface WorkPart {
  name: string;
  color: string;
  m?: Manifold;
  raw?: { positions: Float32Array; indices: Uint32Array };
  previewOnly?: boolean;
  drag?: DragInfo;
  /** The part as printed, when that differs from the preview (e.g. pins printed separately). */
  print?: Manifold;
}

type Deletable = { delete(): void };

/** Stacked slabs overlap by this much so unions fuse into one solid. */
/** Styles built from the plain letter outline, where loose letter pieces would print apart. */
const JOIN_STYLES = new Set(['sign', 'planter', 'topo', 'facet', 'keychain', 'duo', 'stepped']);
const OVERLAP = 0.01;
const fmtN = (v: number) => String(Math.round(v * 10) / 10);

export class Builder {
  private bin: Deletable[] = [];
  private kept: WorkPart[] = [];
  private spots: { i: number; x: number; y: number }[] = [];
  private skeletonReady: Promise<void>;

  constructor(private wasm: ManifoldToplevel) {
    this.skeletonReady = SkeletonBuilder.init();
  }

  ready() {
    return this.skeletonReady;
  }

  private k<T extends Deletable>(o: T): T {
    this.bin.push(o);
    return o;
  }

  private flush() {
    for (const o of this.bin) {
      try {
        o.delete();
      } catch {
        /* already deleted */
      }
    }
    this.bin = [];
  }

  private releaseKept() {
    for (const p of this.kept) p.m?.delete();
    this.kept = [];
  }

  /** Laser file made by a style itself (trophy base), returned like the backing. */
  private laser: BuildResult['backing'];

  build(font: Font, p: Params, topFont?: Font): BuildResult {
    this.releaseKept();
    this.laser = undefined;
    const warnings: string[] = [];
    let parts: WorkPart[] = [];
    try {
      if (p.style === 'lamp') return this.lamp(p, warnings);
      if (p.style === 'mold') return this.mold(p, warnings);
      if (p.style === 'tile') return this.tiles(p, warnings);
      if (p.style === 'terrace') return this.terrace(p, warnings);
      const layout = layoutText(font, p.text || ' ', {
        ...textStyle(p),
        capHeight: p.capHeight,
        tracking: p.tracking,
        lineSpacing: p.lineSpacing,
        // stepped tiers grow outward, so keep letters far enough apart that they never fuse
        // concrete molds need room for a wall between letter pockets
        gap: p.style === 'concrete' ? 2 * clampN(p.ccWall ?? 4, 1.2, 30) + 2 : p.style === 'stepped' ? 2 * (Math.max(1, Math.round(p.spSteps)) - 1) * p.spInset + 0.8 : 0,
        widths: p.letterW,
        moves: p.style === 'stepped' || Object.keys(p.letterMove ?? {}).length ? (p.letterMove ?? {}) : undefined,
      });
      // no letters at all (empty text): manifold can't take an empty list, so start from nothing
      let cs = layout.contours.length
        ? this.k(new this.wasm.CrossSection(layout.contours as MVec2[][], 'NonZero'))
        : this.k(this.wasm.CrossSection.square([0, 0]));
      // made-up weight: grow (bolder) or shrink (lighter) every outline by half the amount
      const bold = clampN(p.textBold ?? 0, -3, 6) / 2;
      if (Math.abs(bold) > 0.005) {
        cs = this.k(cs.offset(bold, 'Round', 2, 32));
        layout.lines = this.boldLines(layout.lines, p);
      }
      cs = this.letterBold(cs, layout, p);
      if (JOIN_STYLES.has(p.style)) cs = this.joinLetterPieces(cs, layout.glyphs, p, warnings);
      // artwork joins the text shape (flat styles) or becomes one more line (stack, ramp)
      const art = p.style === 'book' ? undefined : this.artwork(p, cs);
      if (art) {
        cs = this.k(cs.add(art));
        layout.lines.push(art.toPolygons() as Vec2[][]);
      }
      // pin art waves and ripples don't need any text
      const textFree = p.style === 'pins' && (p.pinMode ?? 'wave') !== 'letters';
      if (cs.isEmpty() && !textFree) {
        return { parts: [], warnings: ['Type something to get started.'], size: [0, 0, 0], letters: [] };
      }
      // flat styles keep layout coordinates; book and stack replace these with their own layout
      this.spots = p.style === 'duo' ? [] : layout.letterCenters;
      switch (p.style) {
        case 'sign':
          parts = this.sign(cs, layout.lastBaseline, p, warnings);
          break;
        case 'planter':
          parts = this.planter(cs, p, warnings);
          break;
        case 'topo':
          parts = this.topo(cs, p, warnings);
          break;
        case 'facet':
          parts = this.facet(cs, p, warnings);
          break;
        case 'keychain':
          parts = this.keychain(cs, p, warnings);
          break;
        case 'duo':
          parts = this.duo(cs, layout.lastBaseline, p, warnings, topFont ?? font);
          break;
        case 'book':
          parts = this.book(font, p, warnings);
          break;
        case 'stack': {
          let lines = layout.lines;
          const hasW = Object.keys(p.letterW ?? {}).length > 0;
          if ((p.stStretch && layout.lineCount > 1) || hasW) {
            // every line the same width, like a block set in a variable-width font
            const b = cs.bounds();
            const l2 = layoutText(font, p.text, {
              ...textStyle(p),
              capHeight: p.capHeight,
              tracking: p.tracking,
              lineSpacing: p.lineSpacing,
              stretchTo: p.stStretch ? b.max[0] - b.min[0] : undefined,
              widths: p.letterW,
              moves: p.letterMove,
            });
            lines = this.boldLines(l2.lines, p);
            l2.lines = lines;
            this.letterBold(undefined, l2, p);
            lines = l2.lines;
            this.spots = l2.letterCenters;
          }
          parts = this.stack(lines, p, warnings);
          break;
        }
        case 'stepped':
          parts = this.stepped(cs, layout.letterCenters, p, warnings);
          break;
        case 'ramp':
          parts = this.ramp(cs, layout.lines, p, warnings);
          break;
        case 'flower':
          this.spots = [];
          parts = p.flLayout === 'row'
            ? this.flowerRow(layout.glyphs, layout.glyphLetter, p, warnings)
            : this.flower(layout.glyphs, layout.glyphLetter, p, warnings);
          break;
        case 'arrow':
          parts = this.arrowSign(cs, p, warnings);
          break;
        case 'standee':
          this.spots = [];
          parts = this.standee(cs, p, warnings);
          break;
        case 'trophy':
          this.spots = [];
          parts = this.trophy(cs, layout.lines, font, p, warnings);
          break;
        case 'pyramid':
          parts = this.pyramid(cs, p, warnings);
          break;
        case 'concrete':
          this.spots = [];
          parts = this.concrete(cs, p, warnings);
          break;
        case 'lines':
          this.spots = [];
          parts = this.lineLetters(font, p, warnings);
          break;
        case 'pins':
          this.spots = [];
          parts = this.pins(cs, p, warnings);
          break;
      }
      if (p.splitBed && p.style !== 'lines' && p.style !== 'concrete' && p.style !== 'standee' && p.style !== 'trophy') parts = this.splitToBed(parts, p.bedSize, warnings);

      // Detach manifolds we keep for export from the garbage bin.
      const keep = new Set(parts.filter((x) => !x.previewOnly).map((x) => x.m).filter(Boolean) as Manifold[]);
      this.bin = this.bin.filter((o) => !keep.has(o as Manifold));
      this.kept = parts.filter((x) => !x.previewOnly);
      const backing = p.backOn && p.style !== 'book' ? this.backing(p, warnings) : undefined;
      if (backing) {
        const t = clampN(p.backT ?? 3, 1, 30);
        parts.push({ name: 'Wood backing', color: '#c8a27a', previewOnly: true, m: this.k(backing.board.extrude(t).translate([0, 0, -t])) });
      }

      const out: Part[] = [];
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (const wp of parts) {
        let positions: Float32Array;
        let indices: Uint32Array;
        if (wp.m) {
          const mesh = wp.m.getMesh();
          const np = mesh.numProp;
          const vp = mesh.vertProperties;
          positions = new Float32Array((vp.length / np) * 3);
          for (let i = 0, j = 0; i < vp.length; i += np, j += 3) {
            positions[j] = vp[i];
            positions[j + 1] = vp[i + 1];
            positions[j + 2] = vp[i + 2];
          }
          indices = new Uint32Array(mesh.triVerts);
        } else if (wp.raw) {
          positions = wp.raw.positions;
          indices = wp.raw.indices;
        } else continue;
        if (!indices.length) continue;
        if (wp.previewOnly) {
          out.push({ name: wp.name, color: wp.color, positions, indices, previewOnly: true });
          continue;
        }
        for (let i = 0; i < positions.length; i += 3) {
          for (let a = 0; a < 3; a++) {
            const v = positions[i + a];
            if (v < lo[a]) lo[a] = v;
            if (v > hi[a]) hi[a] = v;
          }
        }
        const part: Part = { name: wp.name, color: wp.color, positions, indices, drag: wp.drag };
        if (wp.print) {
          const g = wp.print.getMesh();
          const q = new Float32Array((g.vertProperties.length / g.numProp) * 3);
          for (let i = 0, j = 0; i < g.vertProperties.length; i += g.numProp, j += 3) {
            q[j] = g.vertProperties[i];
            q[j + 1] = g.vertProperties[i + 1];
            q[j + 2] = g.vertProperties[i + 2];
          }
          part.printMesh = { positions: q, indices: new Uint32Array(g.triVerts) };
        }
        out.push(part);
      }
      const size: [number, number, number] = out.length
        ? [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]
        : [0, 0, 0];
      if (!p.splitBed && (size[0] > p.bedSize || size[1] > p.bedSize)) {
        warnings.push(
          `Model is ${Math.round(size[0])}×${Math.round(size[1])} mm, larger than your ${p.bedSize} mm bed. Turn on "Split to fit bed".`,
        );
      }
      return { parts: out, warnings, size, letters: this.spots, backing: backing?.svg ?? this.laser };
    } finally {
      this.flush();
    }
  }

  /** Union of kept parts per colour (one group when byColor is off), for STL export. */
  mergedByColor(byColor: boolean): { color: string; positions: Float32Array; indices: Uint32Array }[] {
    const colors = byColor ? [...new Set(this.kept.map((p) => p.color.toLowerCase()))] : [''];
    return colors.map((c) => ({ color: c, ...this.mergedMesh(c) }));
  }

  /** Union of all kept parts (or only those of one colour), for STL export. */
  mergedMesh(color = ''): { positions: Float32Array; indices: Uint32Array } {
    const kept = color ? this.kept.filter((p) => p.color.toLowerCase() === color) : this.kept;
    const ms = kept.filter((p) => p.m).map((p) => p.m!) as Manifold[];
    const raws = kept.filter((p) => p.raw).map((p) => p.raw!);
    const chunks: { positions: Float32Array; indices: Uint32Array }[] = [...raws];
    if (ms.length) {
      const u = this.wasm.Manifold.union(ms);
      const mesh = u.getMesh();
      const np = mesh.numProp;
      const vp = mesh.vertProperties;
      const positions = new Float32Array((vp.length / np) * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) {
        positions[j] = vp[i];
        positions[j + 1] = vp[i + 1];
        positions[j + 2] = vp[i + 2];
      }
      chunks.push({ positions, indices: new Uint32Array(mesh.triVerts) });
      u.delete();
    }
    return concatMeshes(chunks);
  }

  /**
   * Lamp: shade and base. Shown standing on each other ("assembled") or side by side; the files are
   * always laid out side by side, each part flat on the bed (printOffset moves a part there).
   * Never bed-split (cuts would show in the light).
   */
  /** Terrace planter: thin walls on one floor, joined into one piece. */
  private terrace(p: Params, warnings: string[]): BuildResult {
    const walls = buildTerrace(this.wasm, (o) => this.k(o), p, warnings);
    this.kept = [];
    if (!walls.length) return { parts: [], warnings, size: [0, 0, 0], letters: [] };
    const m = this.k(this.wasm.Manifold.union(walls.map((w) => w.m)));
    const g = m.getMesh();
    const q = new Float32Array((g.vertProperties.length / g.numProp) * 3);
    for (let i = 0, j = 0; i < g.vertProperties.length; i += g.numProp, j += 3) {
      q[j] = g.vertProperties[i];
      q[j + 1] = g.vertProperties[i + 1];
      q[j + 2] = g.vertProperties[i + 2];
    }
    const raw = { positions: q, indices: new Uint32Array(g.triVerts) };
    this.kept.push({ name: 'Planter', color: p.colorA, raw });
    const b = m.boundingBox();
    const size: [number, number, number] = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    if (size[0] > p.bedSize || size[1] > p.bedSize) warnings.push(`The planter is ${Math.round(size[0])} × ${Math.round(size[1])} mm, bigger than your ${p.bedSize} mm bed. Make it smaller.`);
    return { parts: [{ name: 'Planter', color: p.colorA, ...raw }], warnings, size, letters: [] };
  }

  /** Tile mold: star and cross tiles (silicone master, hard tray or clay cutters), laid out flat. */
  private tiles(p: Params, warnings: string[]): BuildResult {
    const pieces = buildTiles(this.wasm, (o) => this.k(o), p, warnings);
    this.kept = [];
    const out: Part[] = [];
    let x = 0;
    for (const pc of pieces) {
      const b = pc.m.boundingBox();
      const m = this.k(pc.m.translate([x - b.min[0], -(b.min[1] + b.max[1]) / 2, -b.min[2]]));
      x += b.max[0] - b.min[0] + 10;
      const g = m.getMesh();
      const q = new Float32Array((g.vertProperties.length / g.numProp) * 3);
      for (let i = 0, j = 0; i < g.vertProperties.length; i += g.numProp, j += 3) {
        q[j] = g.vertProperties[i];
        q[j + 1] = g.vertProperties[i + 1];
        q[j + 2] = g.vertProperties[i + 2];
      }
      const raw = { positions: q, indices: new Uint32Array(g.triVerts) };
      const color = pc.role === 'tile' ? p.colorB : p.colorA;
      this.kept.push({ name: pc.name, color, raw });
      out.push({ name: pc.name, color, ...raw });
    }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const o of out)
      for (let i = 0; i < o.positions.length; i += 3)
        for (let a = 0; a < 3; a++) {
          lo[a] = Math.min(lo[a], o.positions[i + a]);
          hi[a] = Math.max(hi[a], o.positions[i + a]);
        }
    const size: [number, number, number] = out.length ? [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] : [0, 0, 0];
    return { parts: out, warnings, size, letters: [] };
  }

  /** Candle & mold: pieces shown pulled apart (or as printed); files always use the print layout. */
  private mold(p: Params, warnings: string[]): BuildResult {
    const { pieces, volume } = buildMold(this.wasm, (o) => this.k(o), p, warnings);
    this.kept = [];
    const out: Part[] = [];
    const toMesh = (m: Manifold) => {
      const g = m.getMesh();
      const q = new Float32Array((g.vertProperties.length / g.numProp) * 3);
      for (let i = 0, j = 0; i < g.vertProperties.length; i += g.numProp, j += 3) {
        q[j] = g.vertProperties[i];
        q[j + 1] = g.vertProperties[i + 1];
        q[j + 2] = g.vertProperties[i + 2];
      }
      return { positions: q, indices: new Uint32Array(g.triVerts) };
    };
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    let x = 0;
    for (const pc of pieces) {
      const b = pc.print.boundingBox();
      const w = b.max[0] - b.min[0];
      const d = b.max[1] - b.min[1];
      if (w > p.bedSize || d > p.bedSize || b.max[2] - b.min[2] > p.bedSize) warnings.push(`${pc.name} is ${Math.round(w)} × ${Math.round(d)} × ${Math.round(b.max[2] - b.min[2])} mm, larger than your ${p.bedSize} mm bed.`);
      const printMesh = toMesh(this.k(pc.print.translate([x - b.min[0], -(b.min[1] + b.max[1]) / 2, -b.min[2]])));
      x += w + 10;
      const color = pc.role === 'shape' ? p.colorB : p.colorA;
      this.kept.push({ name: pc.name, color, raw: printMesh });
      const view = p.moldView === 'print' ? printMesh : toMesh(pc.view);
      for (let i = 0; i < view.positions.length; i += 3)
        for (let a = 0; a < 3; a++) {
          const v = view.positions[i + a];
          if (v < lo[a]) lo[a] = v;
          if (v > hi[a]) hi[a] = v;
        }
      const part: Part = { name: pc.name, color, positions: view.positions, indices: view.indices };
      if (p.moldView !== 'print') part.printMesh = printMesh;
      out.push(part);
    }
    if (pieces.some((pc) => pc.role === 'shape') || p.moldShow !== 'mold') {
      const g = Math.round(volume * 0.9);
      warnings.push(`Wax needed: about ${g} g (${Math.round(volume)} ml).`);
    }
    const size: [number, number, number] = out.length ? [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] : [0, 0, 0];
    return { parts: out, warnings, size, letters: [] };
  }

  private lamp(p: Params, warnings: string[]): BuildResult {
    const { pieces, shadeZ } = buildLamp(this.wasm, (o) => this.k(o), p, warnings);
    this.kept = [];
    const out: Part[] = [];
    let x = 0;
    const assembled = p.lampView === 'assembled' && pieces.length > 1;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    // A piece can be several separate closed meshes (the woven bands): they are listed one after
    // another in the same part, never merged (merging them takes the library tens of seconds).
    const meshOf = (ms: Manifold[], f: (m: Manifold) => Manifold) =>
      concatMeshes(
        ms.map((m) => {
          const mm = this.k(f(m));
          const g = mm.getMesh();
          const q = new Float32Array((g.vertProperties.length / g.numProp) * 3);
          for (let i = 0, j = 0; i < g.vertProperties.length; i += g.numProp, j += 3) {
            q[j] = g.vertProperties[i];
            q[j + 1] = g.vertProperties[i + 1];
            q[j + 2] = g.vertProperties[i + 2];
          }
          return { positions: q, indices: new Uint32Array(g.triVerts) };
        }),
      );
    for (const pc of pieces) {
      const all = [pc.m, ...(pc.extra ?? [])];
      const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const m of all) {
        const bb = m.boundingBox();
        for (let a = 0; a < 3; a++) {
          b.min[a] = Math.min(b.min[a], bb.min[a]);
          b.max[a] = Math.max(b.max[a], bb.max[a]);
        }
      }
      const w = b.max[0] - b.min[0];
      const d = b.max[1] - b.min[1];
      if (w > p.bedSize || d > p.bedSize) warnings.push(`The ${pc.name.toLowerCase()} is ${Math.round(w)} × ${Math.round(d)} mm, larger than your ${p.bedSize} mm bed.`);
      if (b.max[2] - b.min[2] > p.bedSize) warnings.push(`The ${pc.name.toLowerCase()} is taller than your printer may allow (${Math.round(b.max[2] - b.min[2])} mm).`);
      // print layout: side by side, flat on the bed
      const pt: [number, number, number] = [x - b.min[0], 0, -b.min[2]];
      x += w + 15;
      const color = pc.role === 'shade' ? p.colorA : p.colorB;
      const printMesh = meshOf(all, (m) => m.translate(pt));
      this.kept.push({ name: pc.name, color, raw: printMesh });
      // preview: assembled (shade on the base, turned to its locked position) or the print layout
      const view = !assembled
        ? printMesh
        : pc.role === 'shade'
          ? meshOf(all, (m) => m.rotate([0, 0, -LAMP_TURN]).translate([0, 0, shadeZ]))
          : meshOf(all, (m) => m.translate([0, 0, 0]));
      for (let i = 0; i < view.positions.length; i += 3) {
        for (let a = 0; a < 3; a++) {
          const v = view.positions[i + a];
          if (v < lo[a]) lo[a] = v;
          if (v > hi[a]) hi[a] = v;
        }
      }
      const part: Part = { name: pc.name, color, positions: view.positions, indices: view.indices };
      if (assembled) part.printMesh = printMesh;
      out.push(part);
    }
    const size: [number, number, number] = out.length ? [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] : [0, 0, 0];
    return { parts: out, warnings, size, letters: [] };
  }

  // ---------- helpers ----------

  private rect(x0: number, y0: number, x1: number, y1: number): CrossSection {
    return this.k(this.wasm.CrossSection.square([x1 - x0, y1 - y0]).translate([x0, y0]));
  }

  private extrude(cs: CrossSection, h: number, z = 0): Manifold {
    const m = this.k(cs.extrude(h));
    return z ? this.k(m.translate([0, 0, z])) : m;
  }

  // ---------- styles ----------

  private sign(cs: CrossSection, baseline: number, p: Params, warnings: string[]): WorkPart[] {
    const b = cs.bounds();
    let minX = b.min[0];
    let maxX = b.max[0];
    const top = b.max[1];
    const textBottom = Math.min(b.min[1], baseline);
    const bottom = p.base === 'bar' ? textBottom - p.baseHeight : textBottom;
    const parts: WorkPart[] = [];

    // QR tile
    let qrTile: CrossSection | null = null;
    let qrModules: CrossSection | null = null;
    if (p.qrText.trim()) {
      const qr = QRCode.create(p.qrText.trim(), { errorCorrectionLevel: 'M' });
      const n = qr.modules.size;
      const S = top - bottom;
      const gap = p.capHeight * 0.18;
      const x0 = maxX + gap;
      const quiet = 1.5;
      const mod = S / (n + quiet * 2);
      if (mod < 1.2) {
        warnings.push(
          `QR modules are ${mod.toFixed(2)} mm. Aim for at least 1.2 mm (make the letters taller or shorten the link).`,
        );
      }
      const rects: CrossSection[] = [];
      for (let r = 0; r < n; r++) {
        let c = 0;
        while (c < n) {
          if (qr.modules.get(r, c)) {
            const start = c;
            while (c < n && qr.modules.get(r, c)) c++;
            const xa = x0 + (quiet + start) * mod;
            const xb = x0 + (quiet + c) * mod;
            const yb = top - (quiet + r + 1) * mod;
            rects.push(this.rect(xa, yb, xb, yb + mod * 1.0005));
          } else c++;
        }
      }
      qrModules = this.k(this.wasm.CrossSection.union(rects));
      qrTile = this.rect(x0, bottom, x0 + S, top);
      maxX = x0 + S;
    }

    if (p.base === 'plate') {
      const pad = p.platePadding;
      let plate = this.rect(minX - pad, bottom - pad, maxX + pad, top + pad);
      const r = Math.min(pad, p.capHeight * 0.25);
      plate = this.k(this.k(plate.offset(-r, 'Round')).offset(r, 'Round'));
      parts.push({ name: 'Plate', color: p.colorB, m: this.extrude(plate, p.baseHeight) });
      parts.push({ name: 'Letters', color: p.colorA, m: this.extrude(cs, p.letterRelief, p.baseHeight) });
      if (qrModules) {
        parts.push({ name: 'QR code', color: p.colorA, m: this.extrude(qrModules, p.letterRelief, p.baseHeight) });
      }
      return parts;
    }

    let body = cs;
    if (p.base === 'bar') {
      const bar = this.rect(minX, bottom, maxX, baseline + Math.min(0.8, p.capHeight * 0.03));
      body = this.k(this.wasm.CrossSection.union([cs, bar]));
    }
    if (qrTile) body = this.k(this.wasm.CrossSection.union([body, qrTile]));
    parts.push({ name: 'Sign', color: p.colorA, m: this.extrude(body, p.depth) });
    if (qrModules) {
      parts.push({ name: 'QR code', color: p.colorB, m: this.extrude(qrModules, p.qrRelief, p.depth) });
    }
    if (p.base === 'none') {
      const comps = cs.decompose();
      comps.forEach((c) => this.k(c));
      if (comps.length > 1 && !qrTile) {
        warnings.push('Without a base bar the letters print as separate pieces.');
      }
    }
    return parts;
  }

  private planter(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const inner = this.k(cs.offset(-p.wall, 'Round'));
    const shell = this.k(cs.subtract(inner));
    const walls = this.extrude(shell, p.wallHeight);
    const floor = this.extrude(cs, p.floor);
    const body = this.k(walls.add(floor));
    const comps = body.decompose();
    comps.forEach((c) => this.k(c));
    if (p.wall < 1.2) warnings.push('Walls thinner than 1.2 mm can be fragile.');
    // order left to right
    comps.sort((a, b) => a.boundingBox().min[0] - b.boundingBox().min[0]);
    const out: WorkPart[] = comps.map((m, i) => ({ name: `Letter ${i + 1}`, color: p.colorA, m }));
    const moss = this.k(inner.offset(-0.01));
    if (!moss.isEmpty()) {
      out.push({ name: 'Moss (preview only)', color: '#6f9a3a', m: this.extrude(moss, p.wallHeight * 0.82 - p.floor, p.floor), previewOnly: true });
    }
    return out;
  }

  private topo(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const N = Math.max(2, Math.round(p.layers));
    const noise = makeNoise(p.seed);
    const scale = Math.max(4, p.capHeight * 0.2);
    const spacing = Math.max(0.6, p.capHeight / 90);

    const wobbled = (src: CrossSection, amp: number): CrossSection => {
      if (amp <= 0.001 || src.isEmpty()) return src;
      const polys = src.toPolygons().map((ring) => {
        const res = resample(ring as Vec2[], spacing);
        return res.map(([x, y]) => [
          x + amp * noise(x / scale, y / scale),
          y + amp * noise(x / scale + 37.1, y / scale - 11.7),
        ]) as MVec2[];
      });
      return this.k(new this.wasm.CrossSection(polys, 'Positive'));
    };

    const shapes: CrossSection[] = [];
    if (p.topoMode === 'bowl') {
      // holes[k]: hole cut from layer k; bottom layer has smallest hole.
      const holes: (CrossSection | null)[] = new Array(N).fill(null);
      for (let k = N - 1; k >= 0; k--) {
        const depthIdx = N - 1 - k; // 0 at top
        if (k === 0 && !p.openCenter) {
          holes[k] = null;
          continue;
        }
        const d = p.rim + depthIdx * p.step;
        let h = this.k(cs.offset(-d, 'Round'));
        h = wobbled(h, (p.wobble * depthIdx) / Math.max(1, N - 1));
        const above = k < N - 1 ? holes[k + 1] : null;
        if (above) h = this.k(h.intersect(above));
        holes[k] = h;
      }
      for (let k = 0; k < N; k++) {
        const h = holes[k];
        shapes.push(h && !h.isEmpty() ? this.k(cs.subtract(h)) : cs);
      }
    } else {
      let prev: CrossSection | null = null;
      for (let k = 0; k < N; k++) {
        let s = k === 0 ? cs : this.k(cs.offset(-k * p.step, 'Round'));
        s = wobbled(s, (p.wobble * k) / Math.max(1, N - 1));
        if (prev) s = this.k(s.intersect(prev));
        if (s.isEmpty()) {
          warnings.push(`Only ${k} layers fit — the letters get too thin. Lower the step or layer count.`);
          break;
        }
        shapes.push(s);
        prev = s;
      }
    }

    return shapes.map((s, k) => ({
      name: `Layer ${k + 1}`,
      color: mixColor(p.colorB, p.colorA, shapes.length > 1 ? k / (shapes.length - 1) : 0),
      m: this.extrude(s, p.layerThickness, k * p.layerThickness),
    }));
  }

  private facet(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const slope = Math.tan((Math.min(75, Math.max(15, p.angle)) * Math.PI) / 180);
    const simplified = this.k(cs.simplify(Math.max(0.02, p.capHeight / 2000)));
    const comps = simplified.decompose();
    comps.forEach((c) => this.k(c));
    comps.sort((a, b) => a.bounds().min[0] - b.bounds().min[0]);
    const parts: WorkPart[] = [];
    let failed = 0;
    comps.forEach((comp, i) => {
      const rings = comp.toPolygons() as Vec2[][];
      // outer ring = largest positive area
      const withArea = rings.map((r) => ({ r, a: signedArea(r) }));
      const outer = withArea.filter((x) => x.a > 0).sort((a, b) => b.a - a.a)[0];
      if (!outer) return;
      const holes = withArea.filter((x) => x.a < 0).map((x) => x.r);
      const roof = roofMesh(this.wasm, [outer.r, ...holes], p.facetWall, slope);
      const name = `Letter ${i + 1}`;
      if (!roof) {
        failed++;
        parts.push({ name, color: p.colorA, m: this.extrude(comp, p.facetWall + p.capHeight * 0.1) });
        return;
      }
      let m: Manifold | null = null;
      try {
        m = this.k(new this.wasm.Manifold(new this.wasm.Mesh({ numProp: 3, vertProperties: roof.positions, triVerts: roof.indices })));
        if (m.status() !== 'NoError' || m.isEmpty()) m = null;
      } catch {
        m = null;
      }
      if (m) {
        if (p.cap > 0) {
          const bb = m.boundingBox();
          const box = this.k(
            this.wasm.Manifold.cube([bb.max[0] - bb.min[0] + 2, bb.max[1] - bb.min[1] + 2, p.facetWall + p.cap + 1]).translate([
              bb.min[0] - 1,
              bb.min[1] - 1,
              -1,
            ]),
          );
          m = this.k(m.intersect(box));
        }
        parts.push({ name, color: p.colorA, m });
      } else {
        parts.push({ name, color: p.colorA, raw: roof });
      }
    });
    if (failed) warnings.push(`${failed} shape(s) could not be faceted and were extruded flat instead.`);
    return parts;
  }


  /**
   * Made-up weight for single letters (letterMove[i].bold, mm; fonts without a weight axis): grow
   * the letter's outline, or for a thinner letter cut it out and put back a shrunk copy. Applied to
   * the whole shape (`cs`) and to the letter's line (used by bold stack and ramp).
   */
  private letterBold(cs: CrossSection | undefined, layout: { glyphs: Vec2[][][]; glyphLetter: number[]; glyphLine: number[]; lines: Vec2[][][] }, p: Params): CrossSection {
    const lm = p.letterMove ?? {};
    const g0 = clampN(p.textBold ?? 0, -3, 6) / 2;
    const todo = layout.glyphs
      .map((_, k) => ({ k, d: clampN((lm as any)[layout.glyphLetter[k]]?.bold ?? 0, -3, 6) / 2 }))
      .filter((x) => layout.glyphLetter[x.k] >= 0 && Math.abs(x.d) > 0.005);
    if (!todo.length) return cs as CrossSection;
    const lines = layout.lines.map((lc) => this.cs(lc));
    for (const { k, d } of todo) {
      const g = this.cs(layout.glyphs[k]);
      const now = Math.abs(g0) > 0.005 ? this.k(g.offset(g0, 'Round', 2, 32)) : g;
      const next = this.k(g.offset(g0 + d, 'Round', 2, 32));
      const apply = (x: CrossSection) => (d > 0 ? this.k(x.add(next)) : this.k(this.k(x.subtract(now)).add(next)));
      if (cs) cs = apply(cs);
      const li = layout.glyphLine[k];
      if (lines[li]) lines[li] = apply(lines[li]);
    }
    layout.lines = lines.map((c) => c.toPolygons() as Vec2[][]);
    return cs as CrossSection;
  }

  /** Made-up weight on per-line outlines (see Params.textBold). */
  private boldLines(lines: Vec2[][][], p: Params): Vec2[][][] {
    const bold = clampN(p.textBold ?? 0, -3, 6) / 2;
    if (Math.abs(bold) <= 0.005) return lines;
    return lines.map((lc) => this.k(this.k(this.cs(lc)).offset(bold, 'Round', 2, 32)).toPolygons() as Vec2[][]);
  }

  private cs(contours: Vec2[][]): CrossSection {
    return this.k(new this.wasm.CrossSection(contours as MVec2[][], 'NonZero'));
  }

  private circle(x: number, y: number, r: number): CrossSection {
    return this.k(this.wasm.CrossSection.circle(r, 48).translate([x, y]));
  }

  /** Letter flower: every letter stands with its foot toward the centre and its top pointing out. */
  /**
   * Letter flower: every letter is bent into a pie slice (its width follows the angle, its height
   * goes outward from the centre), so the letters meet in the middle and their sides touch their
   * neighbours, filling the whole circle like petals.
   */
  private flower(glyphs: Vec2[][][], glyphLetter: number[], p: Params, warnings: string[]): WorkPart[] {
    const gs = glyphs.filter((g, i) => glyphLetter[i] >= 0 && g.length);
    if (!gs.length) return [];
    const n = Math.max(gs.length, Math.min(60, Math.round(p.flCount ?? 0)));
    // every letter is stretched to the same petal length (own ink top and bottom), so short
    // lowercase letters (o, a) don't end early and tall ones (l, h) don't poke out as spikes
    const bx = gs.map((g) => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of g) for (const [x, y] of c) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return [x0, x1, y0, y1];
    });
    // Conformal (angle-keeping) mapping, like a map projection: x → angle, y → radius growing
    // exponentially (r = rFoot·e^(k·y), θ = −k·x). Every small piece of a letter keeps its true
    // shape, so letters stay readable; they only get smaller toward the centre. Each letter is
    // first scaled to the same height, so every petal reaches the edge.
    const len = 100; // working height; the flower is scaled to flSize afterwards
    const sc = bx.map(([, , y0, y1]) => len / Math.max(1e-6, y1 - y0));
    const ws: number[] = [];
    for (let i = 0; i < n; i++) ws.push(Math.max(1e-3, (bx[i % gs.length][1] - bx[i % gs.length][0]) * sc[i % gs.length]));
    // letters are made narrower (or wider) so the middle comes out at the chosen size:
    // feet at rFoot = R·m means k·len = ln(1/m) (narrow letters like the photo, few or many)
    const m = clampN(p.flMiddle ?? 25, 5, 80) / 100;
    const raw = ws.reduce((a, b) => a + b, 0);
    const cN = clampN((2 * Math.PI * len) / (raw * Math.log(1 / m)), 0.2, 3);
    for (let i = 0; i < n; i++) ws[i] *= cN;
    const sumW = raw * cN;
    const k = (2 * Math.PI) / sumW;
    const R = clampN(p.flSize ?? 180, 30, 1000) / 2;
    const rFoot = R * Math.exp(-k * len);
    const fuse = 0.004;
    const step = 0.5;
    const items: CrossSection[] = [];
    let at = Math.PI / 2 + (Math.PI * ws[0]) / sumW; // first letter centred at the top, then clockwise
    for (let i = 0; i < n; i++) {
      const g = gs[i % gs.length];
      const [x0, , gy0] = bx[i % gs.length];
      const s0 = sc[i % gs.length];
      const slice = ws[i] * k;
      const a0 = at;
      at -= slice;
      const map = (x: number, y: number): MVec2 => {
        const a = a0 + fuse - (((x - x0) * s0 * cN) / ws[i]) * (slice + 2 * fuse);
        const r = rFoot * Math.exp(k * (y - gy0) * s0);
        return [r * Math.cos(a), r * Math.sin(a)];
      };
      const polys: MVec2[][] = g.map((c) => {
        const out: MVec2[] = [];
        for (let j = 0; j < c.length; j++) {
          const [ax, ay] = c[j];
          const [bx2, by] = c[(j + 1) % c.length];
          const q2 = Math.max(1, Math.ceil((Math.hypot(bx2 - ax, by - ay) * s0) / step));
          for (let q = 0; q < q2; q++) out.push(map(ax + ((bx2 - ax) * q) / q2, ay + ((by - ay) * q) / q2));
        }
        return out;
      });
      items.push(this.k(new this.wasm.CrossSection(polys, 'NonZero')));
    }
    // a small middle joins the feet
    items.push(this.circle(0, 0, rFoot * 1.12 + clampN(p.flRadius ?? 0, 0, 200)));
    if (cN <= 0.2 || cN >= 3) warnings.push(cN <= 0.2 ? 'The letters are squeezed very thin. Use fewer petals or a bigger middle.' : 'The letters are stretched wide. Add petals or make the middle smaller.');
    const all = this.k(this.wasm.CrossSection.union(items));
    const pieces = all.decompose();
    pieces.forEach((c) => this.k(c));
    if (pieces.length > 1) warnings.push('Some letter parts float free (like the dot of an i). Use capital letters or glue them on.');
    return [{ name: 'Flower', color: p.colorA, m: this.extrude(all, clampN(p.flDepth ?? 50, 2, 300)) }];
  }

  /**
   * Letter flower wall art (user: "3 different words next to each other"): every word (split at
   * spaces and line breaks) becomes its own flower, all the same size, in a row with `flGap`
   * between them. Each flower is its own part, so a long row spreads over plates without cuts.
   */
  private flowerRow(glyphs: Vec2[][][], glyphLetter: number[], p: Params, warnings: string[]): WorkPart[] {
    // word number of every letter (letters are counted without spaces, like letterMove keys)
    const wordOf: number[] = [];
    let w = -1, inWord = false;
    for (const ch of p.text) {
      if (/\s/.test(ch)) { inWord = false; continue; }
      if (!inWord) { w++; inWord = true; }
      wordOf.push(w);
    }
    const words = w + 1;
    if (words <= 1) return this.flower(glyphs, glyphLetter, p, warnings);
    const D = clampN(p.flSize ?? 180, 30, 1000);
    const gap = clampN(p.flGap ?? 20, 0, 500);
    const out: WorkPart[] = [];
    const notes = new Set<string>();
    for (let k = 0; k < words; k++) {
      const gl = glyphLetter.map((l) => (l >= 0 && wordOf[l] === k ? l : -1));
      if (!gl.some((l) => l >= 0)) continue;
      const ws: string[] = [];
      const parts = this.flower(glyphs, gl, p, ws);
      ws.forEach((x) => notes.add(x));
      const dx = (k - (words - 1) / 2) * (D + gap);
      parts.forEach((pt) => out.push({ ...pt, name: `Flower ${k + 1}`, m: pt.m && this.k(pt.m.translate([dx, 0, 0])) }));
    }
    notes.forEach((x) => warnings.push(x));
    return out;
  }

  /** Arrow sign: a shaped board, a block "shadow" of the letters, and the letters on top. */
  private arrowSign(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const W = this.wasm;
    const b = cs.bounds();
    const m = clampN(p.arMargin ?? 14, 0, 200);
    const x0 = b.min[0] - m, x1 = b.max[0] + m, y0 = b.min[1] - m, y1 = b.max[1] + m;
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rr = clampN(p.arRound ?? 6, 0, Math.min(w, h) / 2 - 0.1);
    const rounded = (ax: number, ay: number, bx: number, by: number, r: number) =>
      r > 0.05 ? this.k(this.rect(ax + r, ay + r, bx - r, by - r).offset(r, 'Round', 2, 48)) : this.rect(ax, ay, bx, by);
    const tri = (pts: [number, number][]) => this.k(new W.CrossSection([pts as MVec2[]], 'Positive'));
    const dir = p.arDir ?? 'right';
    let board: CrossSection;
    switch (p.arShape ?? 'turn') {
      case 'rect':
        board = rounded(x0, y0, x1, y1, rr);
        break;
      case 'circle':
        board = this.circle(cx, cy, Math.hypot(w, h) / 2);
        break;
      case 'arrow': {
        const body = rounded(x0, y0, x1, y1, rr);
        let head: CrossSection;
        if (dir === 'right' || dir === 'left') {
          const s = dir === 'right' ? 1 : -1;
          const xe = dir === 'right' ? x1 : x0;
          head = tri([[xe - s * 0.5, cy - h * 0.8], [xe + s * h * 0.8, cy], [xe - s * 0.5, cy + h * 0.8]]);
        } else {
          const s = dir === 'up' ? 1 : -1;
          const ye = dir === 'up' ? y1 : y0;
          head = tri([[cx - w * 0.8, ye - s * 0.5], [cx, ye + s * w * 0.8], [cx + w * 0.8, ye - s * 0.5]]);
        }
        board = this.k(body.add(head));
        break;
      }
      default: {
        // a bar down past the text that turns into an arm with an arrow head
        const aw = Math.max(w * 0.7, 10);
        const yb = y0 - aw;
        const armL = w * 0.9;
        const xa = x1 + armL;
        const R = w;
        const bar = this.rect(x0, yb + R, x1, y1);
        const arm = this.rect(x0 + R, yb, xa, yb + aw);
        const corner = this.k(this.circle(x0 + R, yb + R, R).intersect(this.rect(x0, yb, x0 + R, yb + R)));
        let body = this.k(W.CrossSection.union([bar, arm, corner]));
        const f = aw * 0.3; // soften the inner corner
        body = this.k(this.k(body.offset(f, 'Round', 2, 48)).offset(-f, 'Round', 2, 48));
        if (rr > 0.05) body = this.k(this.k(body.offset(-rr, 'Round', 2, 48)).offset(rr, 'Round', 2, 48));
        const yc = yb + aw / 2;
        const head = tri([[xa - 0.5, yc - aw * 0.95], [xa + aw, yc], [xa - 0.5, yc + aw * 0.95]]);
        board = this.k(body.add(head));
        if (dir === 'left') board = this.k(this.k(board.translate([-cx, 0])).scale([-1, 1]).translate([cx, 0]));
        if (dir === 'up' || dir === 'down') warnings.push('The turning arrow points left or right. Use the straight arrow for up or down.');
      }
    }
    const tB = clampN(p.arBoard ?? 4, 0.8, 30);
    const tS = clampN(p.arShadowT ?? 4, 0, 40);
    const tL = clampN(p.arLetterT ?? 3, 0.4, 40);
    const len = clampN(p.arShadowLen ?? 5, 0, 60);
    const a = ((p.arShadowAng ?? 225) * Math.PI) / 180;
    const parts: WorkPart[] = [{ name: 'Board', color: p.colorA, m: this.extrude(board, tB) }];
    let z = tB;
    if (tS > 0.05) {
      // the letters swept toward the shadow direction: the side of a block letter
      const steps = Math.max(1, Math.ceil(len / 0.4));
      const copies: CrossSection[] = [];
      for (let i = 0; i <= steps; i++) copies.push(this.k(cs.translate([(Math.cos(a) * len * i) / steps, (Math.sin(a) * len * i) / steps])));
      let sh = this.k(W.CrossSection.union(copies));
      sh = this.k(sh.intersect(board));
      parts.push({ name: 'Shadow', color: p.colorB, m: this.extrude(sh, tS, z - OVERLAP) });
      z += tS;
    }
    parts.push({ name: 'Letters', color: p.colorC ?? '#f6efe4', m: this.extrude(cs, tL, z - OVERLAP) });
    return parts;
  }

  /**
   * Pin art: round pins on a grid, standing on a plate (two colours), heights from a pattern:
   * letters (tall inside the text, easing down across `pinSoft` mm), waves or ripples.
   */
  private pins(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const W = this.wasm;
    const pitch = clampN(p.pinPitch ?? 8, 2, 60);
    const d = clampN(p.pinD ?? 6, 1, pitch * 1.5);
    const hMin = clampN(p.pinMin ?? 2, 0.2, 300);
    const hMax = Math.max(hMin, clampN(p.pinMax ?? 30, 0.2, 300));
    const sep = !!p.pinSeparate;
    const sock = sep ? clampN(p.pinSocket ?? 3, 1, 20) : 0; // how deep each pin sits in the base
    const fit = clampN(p.pinFit ?? 0.15, 0, 1); // extra room around each pin in its hole
    // the base must be thick enough for the holes plus a 1.2 mm floor
    const plateT = Math.max(clampN(p.pinPlate ?? 3, 0.8, 30), sock + 1.2);
    const mode = p.pinMode ?? 'wave';
    let x0: number, y0: number, x1: number, y1: number;
    let polys = cs.toPolygons() as [number, number][][];
    const textOn = mode === 'letters' || (p.pinText ?? 'none') !== 'none';
    if (mode !== 'letters' && textOn) {
      // the text sits in the middle of the plate
      const b = cs.bounds();
      const ox = (b.min[0] + b.max[0]) / 2, oy = (b.min[1] + b.max[1]) / 2;
      polys = polys.map((c) => c.map(([x, y]) => [x - ox, y - oy] as [number, number]));
      const w = clampN(p.pinW ?? 200, 20, 1000), h = clampN(p.pinH ?? 200, 20, 1000);
      if (b.max[0] - b.min[0] > w || b.max[1] - b.min[1] > h) warnings.push('The text is bigger than the pin area. Make the letters smaller or the area bigger.');
    }
    if (mode === 'letters') {
      const b = cs.bounds();
      const pad = clampN(p.pinPad ?? 12, 0, 300);
      x0 = b.min[0] - pad; y0 = b.min[1] - pad; x1 = b.max[0] + pad; y1 = b.max[1] + pad;
    } else {
      const w = clampN(p.pinW ?? 200, 20, 1000), h = clampN(p.pinH ?? 200, 20, 1000);
      x0 = -w / 2; y0 = -h / 2; x1 = w / 2; y1 = h / 2;
    }
    const cols = Math.max(1, Math.floor((x1 - x0) / pitch));
    const rows = Math.max(1, Math.floor((y1 - y0) / pitch));
    // centre the grid on the plate
    const gx0 = (x0 + x1) / 2 - ((cols - 1) * pitch) / 2;
    const gy0 = (y0 + y1) / 2 - ((rows - 1) * pitch) / 2;
    // where the pins stand: a square grid, or circles around the middle
    const spots: [number, number][] = [];
    const ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2;
    const Rmax = Math.min(x1 - x0, y1 - y0) / 2 - pitch / 2;
    const holeR = clampN(p.pinHole ?? 0, 0, 1000);
    if ((p.pinLayout ?? 'grid') === 'rings') {
      if (holeR < pitch / 2) spots.push([ccx, ccy]);
      for (let k = 1; k * pitch <= Rmax; k++) {
        const r = k * pitch;
        if (r < holeR) continue;
        const n = Math.max(3, Math.round((2 * Math.PI * r) / pitch));
        const off = (k % 2) * (Math.PI / n); // every other circle turned half a step
        for (let i = 0; i < n; i++) spots.push([ccx + r * Math.cos(off + (2 * Math.PI * i) / n), ccy + r * Math.sin(off + (2 * Math.PI * i) / n)]);
      }
    } else {
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const x = gx0 + i * pitch, y = gy0 + j * pitch;
          if (holeR > 0 && Math.hypot(x - ccx, y - ccy) < holeR) continue;
          spots.push([x, y]);
        }
    }
    const soft = clampN(p.pinSoft ?? 8, 0.1, 200);
    const waves = clampN(p.pinWaves ?? 1.5, 0.1, 50);
    const ang = ((p.pinAngle ?? 30) * Math.PI) / 180;
    const span = Math.hypot(x1 - x0, y1 - y0);
    const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2;
    // signed distance to the text outline (positive inside), non-zero fill
    const sdf = (x: number, y: number) => {
      let wind = 0, best = Infinity;
      for (const c of polys)
        for (let i = 0; i < c.length; i++) {
          const [ax, ay] = c[i];
          const [bx, by] = c[(i + 1) % c.length];
          if (ay <= y) { if (by > y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) > 0) wind++; }
          else if (by <= y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) < 0) wind--;
          const ex = bx - ax, ey = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)));
          best = Math.min(best, Math.hypot(x - ax - t * ex, y - ay - t * ey));
        }
      return wind !== 0 ? best : -best;
    };
    const level = (x: number, y: number): number => {
      if (mode === 'letters') {
        const t = Math.max(0, Math.min(1, (sdf(x, y) + soft) / (2 * soft)));
        return t * t * (3 - 2 * t);
      }
      let f: number;
      if (mode === 'halo') {
        // a tall ring just outside the hole, fading out toward the edge (steeper on the inside)
        const r = Math.hypot(x - cxm, y - cym);
        const peak = holeR + pitch * 1.2;
        const wOut = Math.max(pitch, (Rmax - peak) * 0.45), wIn = Math.max(pitch * 0.6, peak * 0.35);
        const t = (r - peak) / (r >= peak ? wOut : wIn);
        f = Math.exp(-t * t);
      } else if (mode === 'ripple') f = 0.5 + 0.5 * Math.cos((2 * Math.PI * waves * Math.hypot(x - cxm, y - cym)) / (span / 2));
      else {
        const u = (x - cxm) * Math.cos(ang) + (y - cym) * Math.sin(ang);
        f = 0.5 + 0.5 * Math.sin((2 * Math.PI * waves * u) / span);
      }
      if (textOn) {
        // inside the letters the pins go all the way up (or down), easing over the softness
        let t = Math.max(0, Math.min(1, (sdf(x, y) + soft) / (2 * soft)));
        t = t * t * (3 - 2 * t);
        const target = p.pinText === 'down' ? 0 : 1;
        // the waves only use part of the height, so the letters stand out from them
        f = (p.pinText === 'down' ? 0.55 + 0.45 * f : 0.45 * f) * (1 - t) + target * t;
      }
      return f;
    };
    const pins: Manifold[] = [];
    const holes: Manifold[] = [];
    const segs = d > 8 ? 40 : 28;
    const tip = p.pinTip ?? 'flat';
    // one pin, length L from z0: flat top, round top, or a tube (hole from the top)
    const pinAt = (x: number, y: number, z0: number, L: number, r: number, floor: number): Manifold => {
      if (tip === 'flat') return this.k(W.Manifold.cylinder(L, r, r, segs).translate([x, y, z0]));
      const pts: [number, number][] = [];
      if (tip === 'round' && L > r) {
        pts.push([0, 0], [r, 0], [r, L - r]);
        for (let a = 1; a < 8; a++) pts.push([r * Math.cos((a * Math.PI) / 16), L - r + r * Math.sin((a * Math.PI) / 16)]);
        pts.push([0, L]);
      } else {
        const ri = r * 0.45;
        const fl = Math.min(floor, L - 0.6);
        pts.push([0, 0], [r, 0], [r, L], [ri, L], [ri, fl], [0, fl]);
      }
      return this.k(this.k(W.Manifold.revolve([pts as MVec2[]], segs)).translate([x, y, z0]));
    };
    for (const [x, y] of spots) {
        const f = level(x, y);
        const h = hMin + (hMax - hMin) * f;
        const r = (p.pinGrow ? d * (0.55 + 0.45 * f) : d) / 2;
        if (sep) {
          // the pin reaches down into its hole (0.2 mm short of the bottom), the hole is a bit wider
          const z0 = plateT - sock + 0.2;
          pins.push(pinAt(x, y, z0, h + plateT - z0, r, plateT - z0 + 1));
          holes.push(this.k(W.Manifold.cylinder(sock + 1, r + fit, r + fit, segs).translate([x, y, plateT - sock])));
        } else pins.push(pinAt(x, y, plateT - 0.02, h + 0.02, r, 1.2));
    }
    const parts: WorkPart[] = [];
    let plate = this.rect(x0, y0, x1, y1);
    let base = this.extrude(plate, plateT);
    if (sep) base = this.k(base.subtract(this.k(W.Manifold.compose(holes))));
    parts.push({ name: sep ? 'Base' : 'Plate', color: p.colorB, m: base });
    const pinsM = this.k(W.Manifold.compose(pins));
    // printed separately: every pin stands on the bed at its own spot (same layout as the base)
    // printed separately: the pins stand on the bed in the same pattern, next to the base
    const besideX = x1 - x0 + 20 + (p.pinFrame ? 6 : 0);
    parts.push({ name: 'Pins', color: p.colorA, m: pinsM, print: sep ? this.k(pinsM.translate([besideX, 0, -(plateT - sock + 0.2)])) : undefined });
    if (sep && sock > hMin + 1) warnings.push('Some pins are shorter than their holes are deep, so they will sit low. Make the shortest pin taller.');
    if (p.pinFrame) {
      const t = 3;
      plate = this.k(this.rect(x0 - t, y0 - t, x1 + t, y1 + t).subtract(this.rect(x0, y0, x1, y1)));
      const frame = this.extrude(plate, plateT + hMax + 4);
      // printed apart, the frame is part of the base (one piece in one colour)
      if (sep) parts[0].m = this.k(parts[0].m!.add(frame));
      else parts.push({ name: 'Frame', color: p.colorB, m: frame });
    }
    if (pins.length > 2500) warnings.push(`${pins.length} pins: the file will be big. Make the spacing larger.`);
    if (d >= pitch) warnings.push('The pins touch each other. Make them thinner or the spacing larger.');
    return parts;
  }

  /**
   * Concrete letters. master: the letters standing on a floor inside a box wall, slightly narrower
   * at the top (draft); pour silicone over it to get a soft mold. mold: a printed tray with a pocket
   * per letter, the letter's FRONT at the bottom of the pocket, so the pockets are mirrored and the
   * cast letters read the right way; pockets widen toward the top (draft) so the concrete releases.
   * Optional pins leave a hanging hole through each letter.
   */
  private concrete(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const W = this.wasm;
    const D = clampN(p.ccDepth ?? 20, 3, 150);
    const wall = clampN(p.ccWall ?? 4, 1.2, 30);
    const floor = clampN(p.ccFloor ?? 3, 1.2, 20);
    const grow = D * Math.tan((clampN(p.ccDraft ?? 2, 0, 10) * Math.PI) / 180);
    const holeR = clampN(p.ccHoleD ?? 6, 2, 20) / 2;
    // a tapered extrusion: thin slabs, each offset a little more (grow < 0 narrows upward)
    const taper = (shape: CrossSection, h: number, z0: number, g: number): Manifold => {
      if (Math.abs(g) < 0.01) return this.extrude(shape, h, z0);
      const steps = Math.max(1, Math.ceil(h / 1));
      const slabs: Manifold[] = [];
      for (let i = 0; i < steps; i++) {
        const sh = this.k(shape.offset((g * (i + 0.5)) / steps, 'Round', 2, 32));
        if (sh.isEmpty()) break;
        slabs.push(this.extrude(sh, h / steps + OVERLAP, z0 + (i * h) / steps));
      }
      return this.k(W.Manifold.union(slabs));
    };
    // a hanging-hole spot per letter piece: the highest point that leaves 3 mm of concrete around it
    const spots = (shape: CrossSection): [number, number][] => {
      const out: [number, number][] = [];
      const comps = shape.decompose();
      comps.forEach((c) => this.k(c));
      for (const c of comps) {
        const room = this.k(c.offset(-(holeR + 3 + Math.max(0, grow)), 'Round', 2, 32));
        if (room.isEmpty()) continue;
        let best: [number, number] | null = null;
        for (const poly of room.toPolygons() as [number, number][][]) for (const v of poly) if (!best || v[1] > best[1]) best = v;
        if (best) out.push(best);
      }
      return out;
    };
    const parts: WorkPart[] = [];
    const master = (p.ccMake ?? 'master') === 'master';
    // one mold (or master box) per letter, so every piece fits the bed and can be poured on its own
    const letters = cs.decompose();
    letters.forEach((c) => this.k(c));
    letters.sort((a, c) => a.bounds().min[0] - c.bounds().min[0]);
    let totalMl = 0;
    letters.forEach((L, n) => {
      const b = L.bounds();
      const cx = (b.min[0] + b.max[0]) / 2;
      if (master) {
        const base = 2.4, boxWall = 2.4, margin = 8;
        let pos = taper(L, D, base - OVERLAP, -grow);
        if (p.ccHoles) for (const [x, y] of spots(L)) pos = this.k(pos.subtract(this.k(W.Manifold.cylinder(D + 2, holeR, holeR, 32).translate([x, y, base]))));
        const inner = this.rect(b.min[0] - margin, b.min[1] - margin, b.max[0] + margin, b.max[1] + margin);
        const outer = this.k(inner.offset(boxWall, 'Round', 2, 24));
        const box = this.k(this.extrude(outer, base).add(this.extrude(this.k(outer.subtract(inner)), D + 8)));
        parts.push({ name: `Master ${n + 1}`, color: p.colorA, m: this.k(box.add(pos)) });
        totalMl += ((b.max[0] - b.min[0] + 2 * margin) * (b.max[1] - b.min[1] + 2 * margin) * (D + 6) - L.area() * D) / 1000;
      } else {
        // mirrored, so the face at the bottom of the pocket reads right on the cast letter
        const m = this.k(this.k(this.k(L.translate([-cx, 0])).scale([-1, 1])).translate([cx, 0]));
        const trayCS = (p.ccShape ?? 'outline') === 'block'
          ? this.rect(b.min[0] - wall - grow, b.min[1] - wall - grow, b.max[0] + wall + grow, b.max[1] + wall + grow)
          : this.k(m.offset(wall + grow, 'Round', 2, 32));
        let tray = this.extrude(trayCS, floor + D);
        tray = this.k(tray.subtract(taper(m, D + 1, floor, grow)));
        if (p.ccHoles) for (const [x, y] of spots(m)) tray = this.k(tray.add(this.k(W.Manifold.cylinder(D + 0.5, holeR, holeR * 0.92, 32).translate([x, y, floor - OVERLAP]))));
        parts.push({ name: `Mold ${n + 1}`, color: p.colorA, m: tray });
      }
    });
    if (master) warnings.push(`Silicone needed: about ${Math.round(totalMl)} ml in all (6 mm over the letters). Then cast concrete in the silicone molds.`);
    else warnings.push('Oil the molds, fill them in two goes and tap the sides to let bubbles out. Wait 1–2 days before taking the letters out.');
    if (p.ccHoles) warnings.push('Each letter gets a hole for a screw or nail to hang it.');
    return parts;
  }

  /**
   * Line letters: one square tile per letter. Inside the letter, thin fins follow its outline in
   * rings (each ring `lnPitch` further in); around it, straight fins in a direction picked per tile
   * (or squares around the tile). Letter fins colour A, background fins and base colour B.
   */
  private lineLetters(font: Font, p: Params, warnings: string[]): WorkPart[] {
    const W = this.wasm;
    const T = clampN(p.lnTile ?? 60, 15, 300);
    const pitch = clampN(p.lnPitch ?? 3, 0.8, 20);
    const fin = clampN(p.lnFin ?? 0.9, 0.4, pitch - 0.3);
    const H = clampN(p.lnHeight ?? 12, 1, 100);
    const Hb = H * clampN(p.lnBack ?? 70, 10, 150) / 100;
    const base = clampN(p.lnBase ?? 2, 0.6, 20);
    let seed = (Math.round(p.lnSeed ?? 1) * 2654435761) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // tiles: one row per line of text, wrapped every lnCols letters
    const cols = Math.round(p.lnCols ?? 0);
    const rows: string[][] = [];
    for (const line of (p.text || ' ').split('\n')) {
      const chars = Array.from(line);
      if (cols > 0) for (let i = 0; i < chars.length; i += cols) rows.push(chars.slice(i, i + cols));
      else rows.push(chars);
    }
    const parts: WorkPart[] = [];
    let n = 0;
    const margin = T * 0.12;
    // per-letter keys count non-space characters across the whole text (same as everywhere else)
    let li = 0;
    rows.forEach((row, r) =>
      row.forEach((ch, c) => {
        const cx = c * T + T / 2, cy = -r * T - T / 2;
        const key = ch.trim() ? li++ : -1;
        if (key >= 0) this.spots.push({ i: key, x: cx, y: cy });
        const tile = this.rect(cx - T / 2, cy - T / 2, cx + T / 2, cy + T / 2);
        const letterParts: CrossSection[] = [];
        n++;
        let letter: CrossSection | null = null;
        if (ch.trim()) {
          // the letter's own settings (weight, width, italic of a variable font; turn) apply here too
          const mv = p.letterMove?.[String(key)];
          const lay = layoutText(font, ch, { ...textStyle(p), capHeight: 100, tracking: 0, lineSpacing: 1, moves: mv ? { '0': { ...mv, dx: 0, dy: 0 } } : undefined, widths: p.letterW?.[String(key)] ? { '0': p.letterW[String(key)] } : undefined });
          let cs = this.k(new W.CrossSection(lay.contours as MVec2[][], 'NonZero'));
          if (!cs.isEmpty()) {
            const b = cs.bounds();
            const sc = (T - 2 * margin) / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
            cs = this.k(this.k(cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2])).scale([sc, sc]));
            letter = this.k(cs.translate([cx, cy]));
          }
        }
        // inside the letter: rings that follow its outline
        if (letter) {
          for (let k = 0; k < 200; k++) {
            const outer = this.k(letter.offset(-k * pitch, 'Round', 2, 32));
            if (outer.isEmpty()) break;
            letterParts.push(this.k(outer.subtract(this.k(outer.offset(-fin, 'Round', 2, 32)))));
          }
        }
        // around it: straight fins (4 directions) or squares, chosen per tile
        const room = letter ? this.k(tile.subtract(this.k(letter.offset(pitch - fin, 'Round', 2, 32)))) : tile;
        const kind = Math.floor(rnd() * 5);
        let pattern: CrossSection;
        if (kind === 4) {
          const rings: CrossSection[] = [];
          for (let k = 0; k * pitch < T / 2; k++) {
            const o = T / 2 - k * pitch - fin / 2;
            if (o <= fin) break;
            rings.push(this.k(this.rect(cx - o, cy - o, cx + o, cy + o).subtract(this.rect(cx - o + fin, cy - o + fin, cx + o - fin, cy + o - fin))));
          }
          pattern = this.k(W.CrossSection.union(rings));
        } else {
          const bars: CrossSection[] = [];
          const L = T * 1.5;
          for (let k = -Math.ceil(L / pitch); k <= Math.ceil(L / pitch); k++) bars.push(this.rect(-L, k * pitch - fin / 2, L, k * pitch + fin / 2));
          pattern = this.k(this.k(this.k(W.CrossSection.union(bars)).rotate(kind * 45)).translate([cx, cy]));
        }
        // each tile is its own piece (tiles touching side by side), so big alphabets spread over plates
        const back = this.extrude(this.k(pattern.intersect(room)), Hb, base - OVERLAP);
        parts.push({ name: `Tile ${n}`, color: p.colorB, m: this.k(this.extrude(tile, base).add(back)) });
        if (letterParts.length) parts.push({ name: `Letter ${n}`, color: p.colorA, m: this.extrude(this.k(W.CrossSection.union(letterParts)), H, base - OVERLAP) });
      }),
    );
    const wTot = Math.max(...rows.map((r) => r.length)) * T, hTot = rows.length * T;
    if (wTot > p.bedSize || hTot > p.bedSize) warnings.push(`${Math.round(wTot)} × ${Math.round(hTot)} mm: bigger than your bed. The 3MF puts the tiles on several plates; glue them on a board.`);
    if (fin < 0.8) warnings.push('Lines thinner than 0.8 mm may not print well. Make them thicker.');
    return parts;
  }

  /**
   * Word stand (user photo of a "THANK YOU FOR BEING YOU" desk piece; own design): the lines of
   * text are joined into one rounded outline that hugs the letters (grown by `sdMargin`, gaps
   * between letters and lines bridged, inner holes dropped). That outline is a flat back
   * (`sdThick`), with the letter outlines and the edge raised on the front as thin lines
   * (`sdLine` wide, `sdRaise` high, colour B). A foot strip under the words slots into a printed
   * stand (`sdStand`). Preview: standing in the stand; files (`print`): both lying flat.
   */
  private standee(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const W = this.wasm;
    if (cs.isEmpty()) return [];
    const T = clampN(p.sdThick ?? 4, 1.2, 20);
    const lw = clampN(p.sdLine ?? 1.2, 0.4, 6);
    const raise = clampN(p.sdRaise ?? 1.5, 0, 10);
    const margin = clampN(p.sdMargin ?? 2.5, 0.8, 30);
    const fit = clampN(p.sdFit ?? 0.2, 0, 1);
    // one outline around everything: grow, bridge gaps between letters and lines, drop inner holes
    const bridge = Math.max(2, p.capHeight * 0.25);
    let blob = this.k(this.k(cs.offset(margin + bridge, 'Round', 2, 48)).offset(-bridge, 'Round', 2, 48));
    blob = this.k(new W.CrossSection((blob.toPolygons() as [number, number][][]).filter((q) => polyArea(q) > 0), 'Positive'));
    const pieces = blob.decompose();
    pieces.forEach((c) => this.k(c));
    if (pieces.length > 1) warnings.push('The lines do not touch: they will print as separate pieces. Make the letters bigger or the line spacing smaller.');
    const b = blob.bounds();
    const cx = (b.min[0] + b.max[0]) / 2;
    const wid = b.max[0] - b.min[0];
    // foot strip under the words that goes into the stand's slot
    const slotD = Math.max(3, Math.min(6, T * 1.2));
    const tabW = wid * 0.6;
    const hasStand = p.sdStand !== 'none';
    const tab = hasStand ? this.rect(cx - tabW / 2, b.min[1] - slotD, cx + tabW / 2, b.min[1] + Math.min(4, p.capHeight * 0.3)) : null;
    const backCs = tab ? this.k(blob.add(tab)) : blob;
    const back = this.extrude(backCs, T);
    // raised lines: every letter's outline, plus the edge of the outline (both inside the back)
    const ring = (c: CrossSection) => this.k(this.k(c.offset(lw / 2, 'Round', 2, 32)).subtract(this.k(c.offset(-lw / 2, 'Round', 2, 32))));
    const edge = this.k(blob.subtract(this.k(blob.offset(-lw, 'Round', 2, 32))));
    const linesCs = p.sdLetters === 'solid'
      ? this.k(cs.intersect(blob))
      : this.k(this.k(this.k(ring(cs)).add(edge)).intersect(blob));
    const lines = raise > 0 ? this.extrude(linesCs, raise + OVERLAP, T - OVERLAP) : null;
    // standing: flat piece turned up (its y → z), back face at y = +T/2, lines toward the front (−y)
    const up = (m: Manifold, z0: number) => this.k(this.k(m.rotate([90, 0, 0])).translate([-cx, T / 2, z0]));
    const H = 8;
    const z0 = hasStand ? H - slotD - (b.min[1] - slotD) : -b.min[1];
    const parts: WorkPart[] = [];
    const flatAt = (m: Manifold) => this.k(m.translate([-cx, 0, 0]));
    parts.push({ name: 'Word', color: p.colorA, m: up(back, z0), print: flatAt(back) });
    if (lines) parts.push({ name: p.sdLetters === 'solid' ? 'Letters' : 'Letter lines', color: p.colorB, m: up(lines, z0), print: flatAt(lines) });
    if (hasStand) {
      const D = clampN(p.sdStandD ?? 24, T + 8, 120);
      const SW = Math.max(tabW + 16, wid * 0.85);
      const r = Math.min(5, D / 2 - 0.5);
      let foot = this.rect(-SW / 2, -D / 2, SW / 2, D / 2);
      foot = this.k(this.k(foot.offset(-r, 'Round', 2, 32)).offset(r, 'Round', 2, 32));
      const slot = this.extrude(this.rect(-tabW / 2 - fit, -T / 2 - fit, tabW / 2 + fit, T / 2 + fit), slotD + 1, H - slotD);
      const stand = this.k(this.extrude(foot, H).subtract(slot));
      // printed beside the word, in front of it on the bed
      parts.push({ name: 'Stand', color: p.colorC ?? '#c8a27a', m: stand, print: this.k(stand.translate([0, b.min[1] - slotD - 10 - D / 2, 0])) });
    }
    return parts;
  }

  /**
   * Trophy (user photos of award trophies; own designs). Top piece, printed lying flat:
   *  - 'stack': every line turned to read upward, all the same height, side by side (a long word
   *    becomes a thin column, a year a fat one); small gaps bridged (`tpJoin`) so it is one piece.
   *  - 'badge': a plaque (circle / rounded / shield / bulb, `tpSize`) with the text raised on the
   *    front in colour B.
   * A foot strip under it slots into the base. Base 'wood' (DEFAULT; user: "we will use thick wood"):
   * one solid block; its front is laser-engraved with title / subtitle / a line / year. The laser
   * file (black = engrave, blue = block edges + the slot to cut on the top face) comes back as
   * `backing`. 'printed': a 3D printed block with the text cut in.
   */
  private trophy(cs: CrossSection, lines: Vec2[][][], font: Font, p: Params, warnings: string[]): WorkPart[] {
    const W = this.wasm;
    if (cs.isEmpty()) return [];
    const T = clampN(p.tpDepth ?? 12, 2, 40);
    const fit = clampN(p.sdFit ?? 0.2, 0, 1);
    const base = p.tpBase === 'layers' || !p.tpBase ? 'wood' : p.tpBase;
    const csOf = (loops: Vec2[][]) => this.k(new W.CrossSection(loops as MVec2[][], 'NonZero'));
    let top: CrossSection;
    let raised: CrossSection | null = null;
    if ((p.tpShape ?? 'stack') === 'stack') {
      // every line turned to read upward, all stretched to the same height, side by side touching
      // (a long word becomes a thin column, a short one like a year a fat one)
      const ls = lines.filter((l) => l.length).map(csOf).filter((c) => !c.isEmpty());
      const box = (c: CrossSection) => c.bounds();
      const L = Math.max(...ls.map((c) => box(c).max[0] - box(c).min[0]));
      const items: CrossSection[] = [];
      let x = 0;
      for (const c of ls) {
        const b = box(c);
        const sc = L / Math.max(1e-6, b.max[0] - b.min[0]);
        const h = (b.max[1] - b.min[1]) * sc;
        // rotate +90°: (x, y) → (−y, x); after it the column spans x −h..0, y 0..L
        const col = this.k(this.k(this.k(c.translate([-b.min[0], -b.min[1]])).scale([sc, sc])).rotate(90));
        items.push(this.k(col.translate([x + h, 0])));
        x += h - Math.min(1, h * 0.03);
      }
      const all = this.k(W.CrossSection.union(items));
      const j = clampN(p.tpJoin ?? 1.5, 0, 10);
      top = j > 0 ? this.k(this.k(all.offset(j, 'Round', 2, 32)).offset(-j, 'Round', 2, 32)) : all;
      const n = top.decompose();
      n.forEach((c) => this.k(c));
      if (n.length > 1) warnings.push('Some letters do not touch: the top would print in pieces. Use tighter letter spacing or a bigger "Join gaps".');
    } else {
      const D = clampN(p.tpSize ?? 90, 30, 240);
      const R = D / 2;
      switch (p.tpBadge ?? 'circle') {
        case 'rounded': {
          const r = R * 0.22;
          top = this.k(this.k(this.rect(-R, -R, R, R).offset(-r, 'Round', 2, 48)).offset(r, 'Round', 2, 48));
          break;
        }
        case 'shield': {
          const q: MVec2[] = [[-R, R], [R, R], [R, R * 0.1], [0, -R * 1.15], [-R, R * 0.1]];
          top = this.k(this.k(new W.CrossSection([q], 'Positive').offset(-R * 0.12, 'Round', 2, 48)).offset(R * 0.12, 'Round', 2, 48));
          break;
        }
        case 'bulb': {
          // round glass + a neck that narrows to the foot
          const neck: MVec2[] = [[-R * 0.6, -R * 0.55], [R * 0.6, -R * 0.55], [R * 0.32, -R * 1.25], [-R * 0.32, -R * 1.25]];
          top = this.k(this.k(this.k(this.circle(0, 0, R).add(new W.CrossSection([neck], 'Positive'))).offset(R * 0.08, 'Round', 2, 48)).offset(-R * 0.08, 'Round', 2, 48));
          break;
        }
        default:
          top = this.circle(0, 0, R);
      }
      // text centred in the round part, scaled to fit inside with a margin
      const tb = cs.bounds();
      const tw = tb.max[0] - tb.min[0], th = tb.max[1] - tb.min[1];
      const sc = Math.min(1, (R * 1.3) / Math.max(1e-6, tw), (R * 1.15) / Math.max(1e-6, th));
      if (sc < 1) warnings.push('The text was made smaller to fit on the badge.');
      raised = this.k(this.k(this.k(cs.translate([-(tb.min[0] + tb.max[0]) / 2, -(tb.min[1] + tb.max[1]) / 2])).scale([sc, sc])).intersect(this.k(top.offset(-2, 'Round', 2, 32))));
    }
    const b = top.bounds();
    const cx = (b.min[0] + b.max[0]) / 2;
    const wid = b.max[0] - b.min[0];
    // foot: 60 % of the width (at most the base), as thick as the slot minus play, flush with the back
    const H = clampN(p.tpBaseH ?? 40, 10, 200);
    const BW = (p.tpBaseW ?? 0) > 0 ? clampN(p.tpBaseW!, 20, 400) : Math.round(Math.max(wid * 1.05, 60));
    const slotD = Math.min(12, H * 0.4);
    // the foot is the full thickness of the top; the slot is that plus play on each side
    const tabT = T;
    const slotT = T + 2 * fit;
    const tabW = Math.min(wid * 0.6, BW - 16);
    const hasBase = base !== 'none';
    const tab = hasBase ? this.extrude(this.rect(cx - tabW / 2, b.min[1] - slotD, cx + tabW / 2, b.min[1] + 6), tabT) : null;
    let piece = this.extrude(top, T);
    if (tab) piece = this.k(piece.add(tab));
    const rz = p.tpShape === 'badge' ? clampN(p.tpRaise ?? 2, 0, 10) : 0;
    const lift = raised && rz > 0 ? this.extrude(raised, rz + OVERLAP, T - OVERLAP) : null;
    // standing: flat y → z, back face toward +y; foot centred in the slot
    const z0 = hasBase ? H - b.min[1] : -b.min[1];
    const up = (m: Manifold) => this.k(this.k(m.rotate([90, 0, 0])).translate([-cx, tabT / 2, z0]));
    const flat = (m: Manifold) => this.k(m.translate([-cx, 0, 0]));
    const parts: WorkPart[] = [{ name: 'Trophy', color: p.colorA, m: up(piece), print: flat(piece) }];
    if (lift) parts.push({ name: 'Raised text', color: p.colorB, m: up(lift), print: flat(lift) });
    if (!hasBase) return parts;

    // ----- base -----
    const D = Math.max(clampN(p.tpBaseD ?? 40, 10, 200), slotT + 8);
    // engraving on the front, laid out in face coordinates (x 0..BW, y 0..H)
    const engr: CrossSection[] = [];
    const m = Math.max(4, Math.min(8, H * 0.14));
    const txt = (s: string, cap: number, x: number, yTop: number, maxW: number): number => {
      if (!s.trim()) return 0;
      const lay = layoutText(font, s, { capHeight: cap, tracking: 0.02, lineSpacing: 1.15 });
      if (!lay.contours.length) return 0;
      let c = csOf(lay.contours);
      const bb = c.bounds();
      const sc = Math.min(1, maxW / Math.max(1e-6, bb.max[0] - bb.min[0]));
      c = this.k(this.k(c.translate([-bb.min[0], -bb.max[1]])).scale([sc, sc]).translate([x, yTop]));
      engr.push(c);
      return (bb.max[1] - bb.min[1]) * sc;
    };
    const cap = Math.max(2.5, Math.min(6, H * 0.11));
    let yy = H - m;
    const h1 = txt(p.tpTitle ?? '', cap, m, yy, BW - 2 * m);
    if (h1) yy -= h1 + cap * 0.55;
    const h2 = txt(p.tpSub ?? '', cap, m, yy, BW - 2 * m);
    if (h2) yy -= h2 + cap * 0.55;
    const yearCap = Math.max(cap * 1.4, Math.min(H * 0.2, 9));
    const yBottom = m + yearCap * 1.25;
    if (h1 || h2) engr.push(this.rect(m, Math.max(yBottom + 1.5, yy - 1) - 0.25, BW - m, Math.max(yBottom + 1.5, yy - 1) + 0.25));
    txt(p.tpYear ?? '', yearCap, m, yBottom, BW - 2 * m);
    const engrave = engr.length ? this.k(W.CrossSection.union(engr)) : null;
    if (engrave && engrave.bounds().min[1] < 1) warnings.push('The base text is crowded. Make the base taller or the text shorter.');
    // block with the slot, text cut 0.6 mm into the front (front = −y, toward you)
    let block = this.k(this.extrude(this.rect(-BW / 2, -D / 2, BW / 2, D / 2), H));
    block = this.k(block.subtract(this.extrude(this.rect(-tabW / 2 - fit, -slotT / 2, tabW / 2 + fit, slotT / 2), slotD + 1, H - slotD)));
    if (engrave) {
      const cut = this.k(this.k(this.k(engrave.translate([-BW / 2, 0])).extrude(0.6 + OVERLAP)).rotate([90, 0, 0]));
      block = this.k(block.subtract(this.k(cut.translate([0, -D / 2 + 0.6, 0]))));
    }
    if (base === 'printed') {
      // printed with the engraved front facing up
      const pr = this.k(this.k(block.rotate([-90, 0, 0])).translate([0, b.min[1] - slotD - 12 - H / 2, D / 2]));
      parts.push({ name: 'Base', color: p.colorC ?? '#2b2b2e', m: block, print: pr });
    } else {
      parts.push({ name: 'Wooden base', color: '#c8a27a', previewOnly: true, m: block });
      // laser file for a solid block: the front face engraving (black) inside the face outline
      // (blue, to line it up on the block), and below it the top face with the slot to cut (blue)
      const sw = tabW + 2 * fit;
      const oy = -(D + 8);
      const guide: [number, number][][] = [
        [[0, 0], [BW, 0], [BW, H], [0, H]],
        [[0, oy], [BW, oy], [BW, oy + D], [0, oy + D]],
        [[BW / 2 - sw / 2, oy + D / 2 - slotT / 2], [BW / 2 + sw / 2, oy + D / 2 - slotT / 2], [BW / 2 + sw / 2, oy + D / 2 + slotT / 2], [BW / 2 - sw / 2, oy + D / 2 + slotT / 2]],
      ];
      const eng = engrave ? (engrave.toPolygons() as [number, number][][]) : [];
      this.laser = { cut: [], guide, engrave: eng, size: [BW, H], pieces: 1, what: `wood block ${fmtN(BW)} × ${fmtN(D)} × ${fmtN(H)} mm`, slot: [sw, slotT, slotD] };
    }
    return parts;
  }

  /** Pyramid-tile letters: the letter cut into squares, each a pyramid or a slope, on a base. */
  private pyramid(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const W = this.wasm;
    const cell = clampN(p.pyCell ?? 12, 3, 80);
    const h = clampN(p.pyHeight ?? 6, 0.4, 60);
    const base = clampN(p.pyBase ?? 3, 0.8, 30);
    const mix = clampN(p.pyMix ?? 40, 0, 100) / 100;
    let seed = (Math.round(p.pySeed ?? 3) * 2654435761) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rot = p.pyRotate ? 45 : 0;
    const g = rot ? this.k(cs.rotate(-rot)) : cs;
    const b = g.bounds();
    const cells: Manifold[] = [];
    const z0 = base - 0.01;
    const z1 = base + h;
    for (let gx = Math.floor(b.min[0] / cell); gx * cell < b.max[0]; gx++)
      for (let gy = Math.floor(b.min[1] / cell); gy * cell < b.max[1]; gy++) {
        const x = gx * cell, y = gy * cell;
        const r = rnd(), d = Math.floor(rnd() * 4);
        const sq = this.rect(x, y, x + cell, y + cell);
        if (this.k(g.intersect(sq)).area() < cell * cell * 0.005) continue;
        const c: [number, number][] = [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]];
        const pts: [number, number, number][] = c.map(([u, v]) => [u, v, z0]);
        if (r < mix) pts.push([x + cell / 2, y + cell / 2, z1]);
        else {
          // a slope: one side up high, the opposite side down at the base
          const hi = [c[d], c[(d + 1) % 4]];
          for (const [u, v] of hi) pts.push([u, v, z1]);
        }
        cells.push(this.k(W.Manifold.hull(pts)));
      }
    if (!cells.length) return [];
    let tops = this.k(W.Manifold.union(cells));
    if (rot) tops = this.k(tops.rotate([0, 0, rot]));
    tops = this.k(tops.intersect(this.extrude(cs, z1 + 1)));
    const body = this.k(this.extrude(cs, base).add(tops));
    void warnings; // every slope faces up, so nothing needs supports
    return [{ name: 'Letters', color: p.colorA, m: body }];
  }

  private keychain(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const o = p.kcOutline;
    let base = this.k(cs.offset(o, 'Round'));
    const bb = base.bounds();
    const midY = (bb.min[1] + bb.max[1]) / 2;
    const ringR = p.ringHole / 2 + p.ringWall;
    const cx = bb.min[0] + ringR * 0.25;
    const ring = this.circle(cx, midY, ringR);
    const bridge = this.rect(cx, midY - ringR * 0.75, cx + ringR + o * 2.5, midY + ringR * 0.75);
    base = this.k(this.wasm.CrossSection.union([base, ring, bridge]));
    // close small notches for a smooth silhouette
    const close = Math.max(0.5, o * 0.6);
    base = this.k(this.k(base.offset(close, 'Round')).offset(-close, 'Round'));
    const hole = this.circle(cx, midY, p.ringHole / 2);
    base = this.k(base.subtract(hole));
    const parts: WorkPart[] = [{ name: 'Base', color: p.colorA, m: this.extrude(base, p.kcBase) }];
    let z = p.kcBase;
    if (p.kcTier > 0) {
      const tier = this.k(this.k(cs.offset(o * 0.45, 'Round')).subtract(hole));
      parts.push({ name: 'Outline step', color: p.colorA, m: this.extrude(tier, p.kcTier, z) });
      z += p.kcTier;
    }
    parts.push({ name: 'Name', color: p.colorB, m: this.extrude(cs, p.kcText, z) });
    if (p.ringWall < 1.5) warnings.push('A ring wall under 1.5 mm may snap. Make it thicker.');
    const comps = base.decompose();
    comps.forEach((c) => this.k(c));
    if (comps.length > 1) warnings.push('The outline is in several pieces. Increase the outline width or tighten letter spacing.');
    return parts;
  }

  private duo(cs: CrossSection, baseline: number, p: Params, warnings: string[], topFont: Font): WorkPart[] {
    const D = p.vDepth;
    const t = Math.min(p.topThickness, D * 0.6);
    let body = cs;
    const bb = cs.bounds();
    if (p.vBar) {
      const bar = this.rect(bb.min[0], Math.min(bb.min[1], baseline), bb.max[0], Math.min(bb.min[1], baseline) + Math.max(2, p.capHeight * 0.08));
      body = this.k(this.wasm.CrossSection.union([cs, bar]));
    }
    const top = bb.max[1];
    // stem holes
    const r = p.holeD / 2;
    const w = p.holeWall;
    const half = r + w;
    const holes: { x: number; top: number }[] = [];
    if (!p.vHoles) {
      // no stem holes
    } else if (D < t + 2 * half) {
      warnings.push(`Make the depth at least ${(t + 2 * half).toFixed(1)} mm to fit stem holes behind the accent text.`);
    } else {
      const comps = cs.decompose();
      comps.forEach((c) => this.k(c));
      for (const c of comps) {
        const cb = c.bounds();
        const cands: { x: number; top: number; score: number }[] = [];
        for (let x = cb.min[0] + half; x <= cb.max[0] - half; x += Math.max(0.5, r / 2)) {
          const strip = this.rect(x - half, cb.min[1] - 1, x + half, cb.max[1] + 1);
          const col = this.k(c.intersect(strip));
          if (col.isEmpty()) continue;
          const pieces = col.decompose();
          pieces.forEach((pc) => this.k(pc));
          pieces.sort((a, b) => b.bounds().max[1] - a.bounds().max[1]);
          const tp = pieces[0];
          const ptop = tp.bounds().max[1];
          const need = Math.min(p.holeDepth, ptop - cb.min[1] - w);
          if (need < p.holeDepth * 0.6) continue;
          const box = this.rect(x - half, ptop - need, x + half, ptop);
          const fill = this.k(tp.intersect(box)).area() / (2 * half * need);
          if (fill > 0.9) cands.push({ x, top: ptop, score: fill - Math.abs(x - (cb.min[0] + cb.max[0]) / 2) / 1000 });
        }
        cands.sort((a, b) => b.score - a.score);
        const chosen: typeof cands = [];
        for (const cand of cands) {
          if (chosen.length >= 2) break;
          if (chosen.every((h) => Math.abs(h.x - cand.x) > half * 2 + w * 2)) chosen.push(cand);
        }
        holes.push(...chosen);
      }
      if (!holes.length) warnings.push('No letter is wide enough for a stem hole. Use a bolder font or smaller holes.');
    }

    // top word, sitting into the top of the bold word
    let topCs: CrossSection | null = null;
    if (p.topText.trim()) {
      const lay = layoutText(topFont, p.topText, { capHeight: p.topCap, tracking: 0, lineSpacing: 1.2 });
      if (lay.contours.length) {
        const sink = p.topCap * 0.28;
        topCs = this.k(this.cs(lay.contours).translate([(bb.min[0] + bb.max[0]) / 2, top - sink]));
        const tb = topCs.bounds();
        topCs = this.k(topCs.translate([-(tb.min[0] + tb.max[0]) / 2 + (bb.min[0] + bb.max[0]) / 2 + p.topDx, p.topDy]));
      }
    }

    // build in print orientation: letter plane = XZ, depth along -Y
    const toStand = (m: Manifold) => this.k(m.rotate([90, 0, 0]));
    let main = toStand(this.extrude(body, D));
    for (const h of holes) {
      const cyl = this.k(
        this.wasm.Manifold.cylinder(p.holeDepth + 50, r, r, 32).translate([h.x, -(t + D) / 2, h.top - p.holeDepth]),
      );
      main = this.k(main.subtract(cyl));
    }
    const parts: WorkPart[] = [{ name: 'Main text', color: p.colorA, m: main, drag: { key: 'main', axes: [0, 2] } }];
    if (topCs) {
      // keep the accent attached: it must overlap the main text or the base strip
      const touching = !this.k(topCs.intersect(body)).isEmpty();
      if (!touching) warnings.push('The accent text is not touching the main text, so it will print as a loose piece. Drag it back onto the main text.');
      parts.push({ name: 'Accent text', color: p.colorB, m: toStand(this.extrude(topCs, t)), drag: { key: 'top', axes: [0, 2] } });
    }
    const zmin = Math.min(...parts.map((x) => x.m!.boundingBox().min[2]));
    for (const x of parts) x.m = this.k(x.m!.translate([0, 0, -zmin]));
    if (holes.length) warnings.push(`${holes.length} stem holes, ${p.holeD} mm wide and ${p.holeDepth} mm deep.`);
    return parts;
  }

  private rounded(cs: CrossSection, depth: number, R: number): Manifold {
    const r = Math.min(R, depth * 0.9);
    if (r < 0.2) return this.extrude(cs, depth);
    const n = Math.max(3, Math.min(5, Math.round(r * 1.2)));
    const slabs: Manifold[] = [this.extrude(cs, depth - r)];
    for (let i = 0; i < n; i++) {
      const z0 = depth - r + (r * i) / n;
      const zTop = depth - r + (r * (i + 1)) / n;
      const h = zTop - (depth - r);
      const inset = r - Math.sqrt(Math.max(0, r * r - h * h));
      const s = this.k(cs.offset(-inset, 'Round', 2, 24));
      if (s.isEmpty()) break;
      slabs.push(this.extrude(s, zTop - z0 + OVERLAP, z0 - OVERLAP));
    }
    return this.k(this.wasm.Manifold.union(slabs));
  }

  private stack(lines: Vec2[][][], p: Params, warnings: string[]): WorkPart[] {
    const ms: Manifold[] = [];
    lines.forEach((lc, i) => {
      const extra = p.stMode === 'cascade' ? i * p.stStep : (i % 2) * p.stStep;
      const d = Math.max(1, p.stDepth + extra);
      // one solid per line; letters on a line are fused by a slight outward offset
      const line = this.k(this.k(this.k(this.cs(lc).offset(0.6, 'Round')).offset(-0.3, 'Round')).simplify(0.05));
      ms.push(this.rounded(line, d, p.stRound));
    });
    if (!ms.length) return [];
    const flat = this.cs(lines.flat());
    if (flat.decompose().map((c) => this.k(c)).length > 1) {
      // Fuse loose letters with a thin backing cut from the closed silhouette.
      const g = p.capHeight * 0.12;
      const backer = this.k(this.k(flat.offset(g, 'Round')).offset(-g * 0.85, 'Round'));
      ms.push(this.extrude(backer, Math.min(2, p.stDepth * 0.5)));
      warnings.push('Added a 2 mm backing so the separate letters print as one piece.');
    }
    const body = this.k(this.wasm.Manifold.union(ms));
    return [{ name: 'Block', color: p.colorA, m: body }];
  }

  private stepped(cs: CrossSection, centers: { i: number; x: number; y: number }[], p: Params, warnings: string[]): WorkPart[] {
    const N = Math.max(1, Math.round(p.spSteps));
    const z0 = p.spBase ? p.spBaseT : 0;
    const slabs: Manifold[] = [];
    for (let k = 0; k < N; k++) {
      const grow = (N - 1 - k) * p.spInset;
      const s = grow > 0 ? this.k(cs.offset(grow, p.spJoin, 4)) : cs;
      // with a base, the first tier sinks a hair into it so they fuse in a single-body STL
      const sink = k || p.spBase ? OVERLAP : 0;
      slabs.push(this.extrude(s, p.spHeight + sink, z0 + k * p.spHeight - sink));
    }
    if (p.spInset * (N - 1) > p.capHeight * 0.25) warnings.push('Wide steps start to merge the letters together.');
    const all = this.k(this.wasm.Manifold.union(slabs));
    // One part per letter, so each can be dragged on its own in the viewer.
    const pieces = all.decompose();
    pieces.forEach((m) => this.k(m));
    const parts: WorkPart[] = [];
    pieces
      .map((m) => {
        const b = m.boundingBox();
        const mx = (b.min[0] + b.max[0]) / 2;
        const my = (b.min[1] + b.max[1]) / 2;
        // the letter whose centre lies inside this piece (nearest if several)
        let best = -1;
        let bestD = Infinity;
        for (const c of centers) {
          const inside = c.x >= b.min[0] - 0.01 && c.x <= b.max[0] + 0.01 && c.y >= b.min[1] - 0.01 && c.y <= b.max[1] + 0.01;
          const d = Math.hypot(c.x - mx, c.y - my) - (inside ? 1e6 : 0);
          if (d < bestD) {
            bestD = d;
            best = c.i;
          }
        }
        return { m, best, x: b.min[0] };
      })
      .sort((a, b) => a.x - b.x)
      .forEach(({ m, best }, n) =>
        parts.push({
          name: `Letter ${n + 1}`,
          color: p.colorA,
          m,
          drag: best >= 0 ? { key: `letter:${best}`, axes: [0, 1] } : undefined,
        }),
      );
    if (p.spBase) {
      const outer = this.k(cs.offset((N - 1) * p.spInset, p.spJoin, 4));
      let base: CrossSection;
      if (p.spBaseShape === 'outline') {
        const r = Math.max(1, p.spBasePad);
        base = this.k(this.k(this.k(outer.offset(r * 2, 'Round')).offset(-r, 'Round')).simplify(0.02));
      } else {
        const b = outer.bounds();
        const pad = p.spBasePad;
        base = this.rect(b.min[0] - pad, b.min[1] - pad, b.max[0] + pad, b.max[1] + pad);
        const r = Math.min(pad, 4);
        if (r > 0.3) base = this.k(this.k(base.offset(-r, 'Round')).offset(r, 'Round'));
      }
      parts.unshift({ name: 'Base', color: p.colorB, m: this.extrude(base, p.spBaseT) });
    } else if (pieces.length > 1) {
      warnings.push('The letters print as separate pieces. Turn on "Base" to join them.');
    }
    return parts;
  }

  /**
   * Some fonts (pixel and blocky fonts especially) build a letter from pieces that only
   * touch at a corner or sit a hair apart, so the letter would print as loose parts.
   * For each such letter, close the tiny gaps (grow, then shrink back by the same amount
   * with square corners). Letters that are already one piece are left exactly as they are,
   * and a letter is only changed when that actually joins some of its pieces.
   */
  private joinLetterPieces(all: CrossSection, glyphs: Vec2[][][], p: Params, warnings: string[]): CrossSection {
    // planter: the bridge must be wide enough to hold a channel between two walls
    const r = p.style === 'planter' ? Math.max(1.2, p.wall * 2) : Math.max(0.6, Math.min(2, p.capHeight * 0.012));
    let joined = 0;
    const out: CrossSection[] = [];
    for (const g of glyphs) {
      const c = this.cs(g);
      if (c.isEmpty()) continue;
      const parts = c.decompose();
      parts.forEach((x) => this.k(x));
      if (parts.length < 2) {
        out.push(c);
        continue;
      }
      // Bridge every pair of pieces that touch or nearly touch: the area within r of both
      // pieces, kept inside the pair's bounding box. Pieces further apart (the dot of an i
      // or j) are left alone.
      const bridges: CrossSection[] = [];
      for (let a = 0; a < parts.length; a++) {
        const grownA = this.k(parts[a].offset(r, 'Miter', 2));
        const nearA = this.k(parts[a].offset(0.3, 'Miter', 2));
        for (let b = a + 1; b < parts.length; b++) {
          if (this.k(nearA.intersect(parts[b])).isEmpty()) continue;
          const ba = parts[a].bounds();
          const bb = parts[b].bounds();
          const box = this.rect(
            Math.min(ba.min[0], bb.min[0]),
            Math.min(ba.min[1], bb.min[1]),
            Math.max(ba.max[0], bb.max[0]),
            Math.max(ba.max[1], bb.max[1]),
          );
          bridges.push(this.k(this.k(grownA.intersect(this.k(parts[b].offset(r, 'Miter', 2)))).intersect(box)));
        }
      }
      if (!bridges.length) {
        out.push(c);
        continue;
      }
      const merged = this.k(this.wasm.CrossSection.union([c, ...bridges]));
      const after = merged.decompose();
      after.forEach((x) => this.k(x));
      if (after.length < parts.length) {
        out.push(merged);
        joined++;
      } else out.push(c);
    }
    if (!joined) return all;
    warnings.push(`Joined the touching pieces of ${joined} letter${joined > 1 ? 's' : ''} so ${joined > 1 ? 'they print' : 'it prints'} as one part.`);
    return this.k(this.wasm.CrossSection.union(out));
  }

  /** Thin outline of the letters (the "line" look). Leaves the shape alone when off. */
  private outline(c: CrossSection, p: Params): CrossSection {
    if (!p.lineMode || c.isEmpty()) return c;
    const inner = this.k(c.offset(-Math.max(0.3, p.lineW), 'Miter', 3));
    return this.k(c.subtract(inner));
  }

  /** Letters extruded into wedges that rise across each letter or each line. */
  /**
   * @param shapes optional solid letter shapes per line (before "line letters" outlining):
   *   every outline piece then ramps across its whole letter, so the inner and outer line
   *   of an O share one slope.
   */
  private rampSolids(lineSections: CrossSection[], p: Params, z0: number, leanDeg = 0, shapes?: CrossSection[]): Manifold[] {
    const lean = Math.tan((Math.min(75, Math.max(0, leanDeg)) * Math.PI) / 180);
    const lo = Math.max(0.4, p.rMin);
    const hi = Math.max(lo, p.rMax);
    const pieces: { c: CrossSection; x0: number; x1: number; idx: number }[] = [];
    let idx = 0;
    lineSections.forEach((lcs, li) => {
      if (lcs.isEmpty()) return;
      const lb = (shapes?.[li] ?? lcs).bounds();
      const comps = lcs.decompose();
      comps.forEach((c) => this.k(c));
      comps.sort((a, b) => a.bounds().min[0] - b.bounds().min[0]);
      // solid letters of this line: the ramp span (and rise direction) each piece belongs to
      const owners = shapes?.[li] && !shapes[li].isEmpty() ? shapes[li].decompose() : null;
      owners?.forEach((o) => this.k(o));
      owners?.sort((a, b) => a.bounds().min[0] - b.bounds().min[0]);
      const ownerBoxes = owners?.map((o) => o.bounds());
      const base = idx;
      for (const c of comps) {
        const b = c.bounds();
        let x0 = b.min[0];
        let x1 = b.max[0];
        let n = idx;
        if (ownerBoxes) {
          const cx = (b.min[0] + b.max[0]) / 2;
          const cy = (b.min[1] + b.max[1]) / 2;
          const k = ownerBoxes.findIndex((o) => cx >= o.min[0] && cx <= o.max[0] && cy >= o.min[1] && cy <= o.max[1]);
          if (k >= 0) {
            x0 = ownerBoxes[k].min[0];
            x1 = ownerBoxes[k].max[0];
            n = base + k;
          }
        }
        if (p.rSpan === 'line') pieces.push({ c, x0: lb.min[0], x1: lb.max[0], idx: n });
        else pieces.push({ c, x0, x1, idx: n });
        if (!ownerBoxes) idx++;
      }
      if (ownerBoxes) idx = base + ownerBoxes.length;
    });
    return pieces.map((pc) => {
      const rising = p.rDir === 'right' || (p.rDir === 'alternate' && pc.idx % 2 === 0);
      const span = Math.max(1e-3, pc.x1 - pc.x0);
      return this.k(
        this.k(pc.c.extrude(1)).warp((v) => {
          let t = (v[0] - pc.x0) / span;
          t = Math.min(1, Math.max(0, t));
          if (!rising) t = 1 - t;
          const h = v[2] * (lo + (hi - lo) * t);
          // lean: the shape slides sideways (toward the high end) as it rises off the surface
          v[0] += h * lean * (rising ? 1 : -1);
          v[2] = h + z0;
        }),
      );
    });
  }

  private ramp(cs: CrossSection, lines: Vec2[][][], p: Params, warnings: string[]): WorkPart[] {
    const z0 = p.rPlate ? p.rPlateT : 0;
    const parts: WorkPart[] = [];
    const solid = lines.map((lc) => this.cs(lc));
    const ms = this.rampSolids(solid.map((c) => this.outline(c, p)), p, z0, p.rLean, p.lineMode ? solid : undefined);
    if (ms.length) parts.push({ name: 'Letters', color: p.colorB, m: this.k(this.wasm.Manifold.union(ms)) });
    if (p.rPlate) {
      const b = cs.bounds();
      const pad = p.rPad;
      let plate = this.rect(b.min[0] - pad, b.min[1] - pad, b.max[0] + pad, b.max[1] + pad);
      plate = this.k(this.k(plate.offset(-2, 'Round')).offset(2, 'Round'));
      parts.unshift({ name: 'Plate', color: p.colorA, m: this.extrude(plate, p.rPlateT) });
    }
    if (p.rMax - p.rMin > 20 && p.rSpan === 'letter') warnings.push('Very steep ramps may need supports.');
    return parts;
  }

  /** A slipcase for a book: open on the spine side, letters on the front. */
  private book(font: Font, p: Params, warnings: string[]): WorkPart[] {
    const cl = p.bookClear;
    const wall = p.bookWall;
    const cover = Math.min(1, Math.max(0.2, p.bookCover / 100));
    const innerW = cover * (p.bookW + cl);
    const innerH = p.bookH + 2 * cl;
    const innerT = p.bookT + 2 * cl;
    const outW = innerW + wall;
    const outH = innerH + 2 * wall;
    const outT = innerT + 2 * wall;
    const outer = this.k(this.wasm.Manifold.cube([outW, outH, outT]));
    const cavity = this.k(this.wasm.Manifold.cube([innerW + 1, innerH, innerT]).translate([-1, wall, wall]));
    const shell = this.k(outer.subtract(cavity));

    // Text: wrapped to the front (minus margins), optionally sized to fill it,
    // centred on the face plus the user's drag offset, clipped to the face.
    const margin = Math.max(0, p.bookMargin);
    const maxW = Math.max(10, outW - 2 * margin);
    const maxH = Math.max(10, outH - 2 * margin);
    const lay = (cap: number) =>
      layoutText(font, p.text || ' ', {
        ...textStyle(p),
        capHeight: cap,
        tracking: p.tracking,
        lineSpacing: p.lineSpacing,
        maxWidth: maxW,
        align: p.bookAlign,
        widths: p.letterW,
        moves: p.letterMove,
      });
    const blockH = (l: ReturnType<typeof lay>) => (l.lineCount - 1) * l.capHeight * p.lineSpacing + l.capHeight * 1.3;
    let layout = lay(p.capHeight);
    if (p.bookFit) {
      let lo = 2;
      let hi = Math.max(4, Math.min(maxH, maxW));
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        const l = lay(mid);
        // also make sure no single word is wider than the face
        const tooWide = this.cs(l.contours).bounds();
        if (blockH(l) <= maxH && tooWide.max[0] - tooWide.min[0] <= maxW + 0.5) lo = mid;
        else hi = mid;
      }
      layout = lay(lo);
      warnings.push(`Text sized to fit the front: ${lo.toFixed(1)} mm letters, ${layout.lineCount} line${layout.lineCount > 1 ? 's' : ''}.`);
    }
    if (p.bookStretch) {
      // Fill the page: keep the line breaks, stretch every line to the full width and,
      // when fitting, size the lines so the block fills the height too.
      // With "fit" on, pick the line breaks so the stretched lines fill the page evenly.
      const smart = p.bookFit
        ? smartLines(font, p.text || ' ', { tracking: p.tracking, lineSpacing: p.lineSpacing }, maxW, maxH)
        : null;
      const lineTexts = smart ? smart.lines : layout.lineTexts;
      const cap = smart ? smart.cap : layout.capHeight;
      layout = layoutText(font, lineTexts.join('\n'), {
        ...textStyle(p),
        capHeight: cap,
        tracking: p.tracking,
        lineSpacing: p.lineSpacing,
        stretchTo: maxW,
        widths: p.letterW,
        moves: p.letterMove,
      });
      const [lo, hi] = layout.stretch;
      // Lines that could not be condensed further: stretch the block taller to fill the height.
      const tall = smart ? smart.capFill / smart.cap : 1;
      if (tall > 1.001) {
        for (const line of layout.lines) for (const c of line) for (const pt of c) pt[1] *= tall;
        for (const c of layout.letterCenters) c.y *= tall;
      }
      if (p.bookFit) warnings.pop(); // replace the plain "sized to fit" note
      warnings.push(
        `Text fills the front: ${lineTexts.length} line${lineTexts.length > 1 ? 's' : ''}, ${(cap * tall).toFixed(1)} mm tall letters.`,
      );
      if (hi / tall > 3) warnings.push('Some short lines are stretched a lot. Join short words onto one line for a more even look.');
    }
    layout.lines = this.boldLines(layout.lines, p);
    this.letterBold(undefined, layout, p);
    const lines = layout.lines;
    const face = this.rect(0, 0, outW, outH);
    const all = this.cs(lines.flat());
    let letters: Manifold | null = null;
    if (!all.isEmpty()) {
      const b = all.bounds();
      const dx = outW / 2 - (b.min[0] + b.max[0]) / 2 + p.textDx;
      const dy = outH / 2 - (b.min[1] + b.max[1]) / 2 + p.textDy;
      const placed = lines.map((lc) => this.k(this.k(this.cs(lc).translate([dx, dy])).intersect(face)));
      this.spots = layout.letterCenters.map((c) => ({ i: c.i, x: c.x + dx, y: c.y + dy }));
      const clipped = placed.some((c, i) => Math.abs(c.area() - this.cs(lines[i]).area()) > 1);
      if (clipped) warnings.push('Part of the text runs off the front and is cut at the edge. Drag it, make it smaller, or turn on "Fit text to the front".');
      const solidPlaced = [...placed];
      for (let i = 0; i < placed.length; i++) placed[i] = this.outline(placed[i], p);
      if (p.lineMode && p.lineW < 0.8) warnings.push('Lines thinner than 0.8 mm may not print well with a 0.4 mm nozzle.');
      if (p.bookEffect === 'ramp' || p.bookEffect === 'sweep') {
        const ms = this.rampSolids(placed, p, outT - OVERLAP, p.bookEffect === 'sweep' ? p.rLean : 0, p.lineMode ? solidPlaced : undefined);
        if (ms.length) {
          // keep swept tips inside the outline of the case
          const keep = this.k(this.wasm.Manifold.cube([outW, outH, outT + p.rMax + 5]));
          letters = this.k(this.k(this.wasm.Manifold.union(ms)).intersect(keep));
        }
      } else {
        const u = this.k(this.wasm.CrossSection.union(placed));
        if (!u.isEmpty()) letters = this.extrude(u, p.bookRelief + OVERLAP, outT - OVERLAP);
      }
    }
    const parts: WorkPart[] = [{ name: 'Case', color: p.colorA, m: shell }];
    if (letters && !letters.isEmpty()) parts.push({ name: 'Letters', color: p.colorB, m: letters, drag: { key: 'text', axes: [0, 1] } });

    if (p.bookOrient === 'standing') {
      warnings.push('Shown with the front up so you can place the text. The download is turned to stand on its open end, which needs no supports inside.');
    } else {
      warnings.push('Prints lying on its back: the front bridges over the inside, so turn on supports (or choose "Standing").');
    }
    if (wall < 1.2) warnings.push('Walls under 1.2 mm will be flimsy.');
    return parts;
  }


  /**
   * Laser-cut wooden backing: the footprint of everything printed (seen from above), grown by a
   * margin. "outline" follows the letters (inner holes of letters filled, nearby letters bridged);
   * "rect" is the bounding box with rounded corners. Hanging holes are kept clear of the letters so
   * a screw or nail can reach them. The 3D preview shows the board under the model; the SVG holds
   * the board outline + holes (cut) and the letter outlines (guide, to engrave or score).
   */
  private backing(p: Params, warnings: string[]) {
    const W = this.wasm;
    const prints = this.kept.map((x) => x.m).filter(Boolean) as Manifold[];
    if (!prints.length) return undefined;
    const foot = this.k(W.CrossSection.union(prints.map((m) => this.k(m.project()))));
    if (foot.isEmpty()) return undefined;
    const margin = clampN(p.backMargin ?? 10, 0, 200);
    const round = clampN(p.backRound ?? 8, 0, 200);
    const fb = foot.bounds();
    let board: CrossSection;
    if (p.backShape === 'rect') {
      board = this.rect(fb.min[0] - margin, fb.min[1] - margin, fb.max[0] + margin, fb.max[1] + margin);
      const r = Math.min(round, (fb.max[0] - fb.min[0]) / 2 + margin - 0.5, (fb.max[1] - fb.min[1]) / 2 + margin - 0.5);
      if (r > 0.3) board = this.k(this.k(board.offset(-r, 'Round', 2, 64)).offset(r, 'Round', 2, 64));
    } else {
      // grow, bridge gaps between letters and lines (close), then keep only outer edges
      const bridge = Math.max(round, p.capHeight * 0.35);
      let g = this.k(this.k(foot.offset(margin + bridge, 'Round', 2, 64)).offset(-bridge, 'Round', 2, 64));
      const outer = (g.toPolygons() as [number, number][][]).filter((q) => polyArea(q) > 0);
      g = this.k(new W.CrossSection(outer, 'Positive'));
      board = round > 0.3 ? this.k(this.k(g.offset(-round * 0.5, 'Round', 2, 64)).offset(round * 0.5, 'Round', 2, 64)) : g;
    }
    // hanging holes: start at the wanted spot and slide inward until clear of the edge and the letters
    const d = clampN(p.backHoleD ?? 5, 2, 20);
    const holes: CrossSection[] = [];
    if (p.backHoles === 'two' || p.backHoles === 'four') {
      // where a hole centre may go: 3 mm of wood all round it, and 2 mm clear of the letters
      const ok = this.k(this.k(board.offset(-(d / 2 + 3), 'Round', 2, 48)).subtract(this.k(foot.offset(d / 2 + 2, 'Round', 2, 48))));
      const loops = ok.toPolygons() as [number, number][][];
      const bb = board.bounds();
      const inset = d / 2 + Math.max(4, margin / 2);
      const xs = [0.15, 0.85].map((f) => bb.min[0] + f * (bb.max[0] - bb.min[0]));
      const ys = p.backHoles === 'four' ? [bb.max[1] - inset, bb.min[1] + inset] : [bb.max[1] - inset];
      let missed = 0;
      for (const y of ys) {
        for (const x of xs) {
          const c = nearestInside(loops, [x, y]);
          // don't let a hole wander more than a third of the board away from where it belongs
          if (!c || Math.hypot(c[0] - x, c[1] - y) > Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]) / 3) {
            missed++;
            continue;
          }
          holes.push(this.k(W.CrossSection.circle(d / 2, 48).translate(c)));
        }
      }
      if (missed) warnings.push(`${missed} hanging hole${missed > 1 ? 's' : ''} did not fit beside the letters. Make the backing margin bigger.`);
    }
    const pieces = board.decompose().length;
    if (pieces > 1) warnings.push(`The wooden backing is in ${pieces} pieces. Make its margin bigger, or use the rectangle shape.`);
    const cutCs = holes.length ? this.k(board.subtract(this.k(W.CrossSection.union(holes)))) : board;
    // kerf: the laser burns away about its line width, so cut half of it outside the real edge
    // (the board grows, the holes shrink); the 3D preview keeps the true size
    const kerf = clampN(p.backKerf ?? 0, 0, 2);
    const cutPath = kerf > 0.001 ? this.k(cutCs.offset(kerf / 2, 'Round', 2, 64)) : cutCs;
    const b = cutCs.bounds();
    return {
      board: cutCs,
      svg: {
        cut: cutPath.toPolygons() as [number, number][][],
        guide: p.backGuide === false ? [] : (foot.toPolygons() as [number, number][][]),
        size: [b.max[0] - b.min[0], b.max[1] - b.min[1]] as [number, number],
        pieces,
      },
    };
  }

  /** The artwork, sized and placed beside (or over) the text; undefined when there is none. */
  private artwork(p: Params, text: CrossSection): CrossSection | undefined {
    const a = p.art;
    if (!a?.contours?.length) return undefined;
    const h = clampN(p.artSize ?? 40, 2, 2000);
    let shape = this.k(new this.wasm.CrossSection(a.contours as MVec2[][], 'NonZero'));
    shape = this.k(shape.scale([h, h]));
    if (p.artRot) shape = this.k(shape.rotate(p.artRot));
    const sb = shape.bounds();
    const w = sb.max[0] - sb.min[0];
    const hh = sb.max[1] - sb.min[1];
    let cx = 0;
    let cy = 0;
    if (!text.isEmpty()) {
      const tb = text.bounds();
      const tx = (tb.min[0] + tb.max[0]) / 2;
      const ty = (tb.min[1] + tb.max[1]) / 2;
      const g = p.artGap ?? 6;
      switch (p.artPlace ?? 'left') {
        case 'left': cx = tb.min[0] - g - w / 2; cy = ty; break;
        case 'right': cx = tb.max[0] + g + w / 2; cy = ty; break;
        case 'above': cx = tx; cy = tb.max[1] + g + hh / 2; break;
        case 'below': cx = tx; cy = tb.min[1] - g - hh / 2; break;
        default: cx = tx; cy = ty;
      }
    }
    const ox = (sb.min[0] + sb.max[0]) / 2;
    const oy = (sb.min[1] + sb.max[1]) / 2;
    return this.k(shape.translate([cx - ox + (p.artX ?? 0), cy - oy + (p.artY ?? 0)]));
  }

  private splitToBed(parts: WorkPart[], bed: number, warnings: string[]): WorkPart[] {
    const out: WorkPart[] = [];
    const usable = Math.max(20, bed - 10);
    const fits = (m: Manifold) => {
      const b = m.boundingBox();
      return b.max[0] - b.min[0] <= usable && b.max[1] - b.min[1] <= usable;
    };
    let cutLetters = 0;
    let separated = 0;
    for (const part of parts) {
      if (!part.m || part.previewOnly || fits(part.m)) {
        out.push(part);
        continue;
      }
      // First try to keep whole letters: separate the part into its loose pieces.
      const comps = part.m.decompose();
      comps.forEach((c) => this.k(c));
      comps.sort((a, b) => a.boundingBox().min[0] - b.boundingBox().min[0]);
      if (comps.length > 1) separated++;
      let idx = 0;
      for (const comp of comps) {
        if (fits(comp)) {
          idx++;
          out.push({ ...part, name: comps.length > 1 ? `${part.name} · ${idx}` : part.name, m: comp });
          continue;
        }
        // A single piece is still too big: cut it on a grid.
        cutLetters++;
        const bb = comp.boundingBox();
        const w = bb.max[0] - bb.min[0];
        const h = bb.max[1] - bb.min[1];
        const nx = Math.ceil(w / usable);
        const ny = Math.ceil(h / usable);
        const cw = w / nx;
        const ch = h / ny;
        for (let ix = 0; ix < nx; ix++) {
          for (let iy = 0; iy < ny; iy++) {
            // Cells meet exactly at the cut lines; only the outer edges get 1 mm of slack.
            const x0 = ix === 0 ? bb.min[0] - 1 : bb.min[0] + ix * cw;
            const x1 = ix === nx - 1 ? bb.max[0] + 1 : bb.min[0] + (ix + 1) * cw;
            const y0 = iy === 0 ? bb.min[1] - 1 : bb.min[1] + iy * ch;
            const y1 = iy === ny - 1 ? bb.max[1] + 1 : bb.min[1] + (iy + 1) * ch;
            const box = this.k(this.wasm.Manifold.cube([x1 - x0, y1 - y0, bb.max[2] - bb.min[2] + 2]).translate([x0, y0, bb.min[2] - 1]));
            const piece = this.k(comp.intersect(box));
            if (piece.isEmpty()) continue;
            for (const sub of piece.decompose()) {
              this.k(sub);
              idx++;
              out.push({ ...part, name: `${part.name} · piece ${idx}`, m: sub });
            }
          }
        }
      }
    }
    if (cutLetters) {
      warnings.push(`${cutLetters} piece(s) were bigger than your ${bed} mm bed and were cut. Glue them after printing.`);
    } else if (separated) {
      warnings.push(`Too big for a ${bed} mm bed in one go, so the letters are exported as separate pieces.`);
    }
    return out;
  }

}

// ---------- faceted roof ----------

function signedArea(r: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function roofMesh(
  wasm: ManifoldToplevel,
  rings: Vec2[][],
  wallH: number,
  slope: number,
): { positions: Float32Array; indices: Uint32Array } | null {
  let sk;
  try {
    sk = SkeletonBuilder.buildFromPolygon(rings.map((r) => [...r, r[0]].map(([x, y]) => [x, y])));
  } catch {
    return null;
  }
  if (!sk || !sk.polygons.length) return null;

  const verts: number[] = [];
  const tris: number[] = [];
  const map = new Map<string, number>();
  const vid = (x: number, y: number, z: number) => {
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    let i = map.get(key);
    if (i === undefined) {
      i = verts.length / 3;
      verts.push(x, y, z);
      map.set(key, i);
    }
    return i;
  };

  // roof faces
  for (const poly of sk.polygons) {
    let pts = poly.map((i) => sk!.vertices[i]);
    if (pts.length < 3) continue;
    if (signedArea(pts.map((v) => [v[0], v[1]] as Vec2)) < 0) pts = pts.slice().reverse();
    const ids = pts.map(([x, y, t]) => vid(x, y, t < 1e-9 ? wallH : wallH + t * slope));
    let tri: [number, number, number][];
    try {
      tri = wasm.triangulate([pts.map((v) => [v[0], v[1]] as MVec2)], -1, true) as [number, number, number][];
    } catch {
      return null;
    }
    for (const [a, b, c] of tri) tris.push(ids[a], ids[b], ids[c]);
  }

  // walls + bottom
  const flat: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      const a0 = vid(ax, ay, 0);
      const b0 = vid(bx, by, 0);
      const a1 = vid(ax, ay, wallH);
      const b1 = vid(bx, by, wallH);
      if (wallH > 1e-6) tris.push(a0, b0, b1, a0, b1, a1);
      flat.push(a0);
    }
  }
  let bottom: [number, number, number][];
  try {
    bottom = wasm.triangulate(rings as MVec2[][], -1, true) as [number, number, number][];
  } catch {
    return null;
  }
  for (const [a, b, c] of bottom) tris.push(flat[a], flat[c], flat[b]);

  return { positions: new Float32Array(verts), indices: new Uint32Array(tris) };
}

// ---------- utils ----------

function resample(ring: Vec2[], spacing: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(len / spacing));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  }
  return out;
}

function makeNoise(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return ((h >>> 0) / 4294967295) * 2 - 1;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const n2 = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return (x: number, y: number) => n2(x, y) * 0.7 + n2(x * 2.1 + 5.3, y * 2.1 - 3.7) * 0.3;
}

function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

export function concatMeshes(chunks: { positions: Float32Array; indices: Uint32Array }[]) {
  let nv = 0;
  let ni = 0;
  for (const c of chunks) {
    nv += c.positions.length;
    ni += c.indices.length;
  }
  const positions = new Float32Array(nv);
  const indices = new Uint32Array(ni);
  let vo = 0;
  let io = 0;
  for (const c of chunks) {
    positions.set(c.positions, vo);
    const base = vo / 3;
    for (let i = 0; i < c.indices.length; i++) indices[io + i] = c.indices[i] + base;
    vo += c.positions.length;
    io += c.indices.length;
  }
  return { positions, indices };
}

/** Signed area of a polygon (positive = counter-clockwise = an outer edge). */
function polyArea(q: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const [x1, y1] = q[i];
    const [x2, y2] = q[(i + 1) % q.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function clampN(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
}

/** The point inside the polygons (even-odd) nearest to `t`: `t` itself if inside, else the nearest edge point. */
function nearestInside(loops: [number, number][][], t: [number, number]): [number, number] | undefined {
  if (!loops.length) return undefined;
  let inside = false;
  for (const q of loops) {
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const [xi, yi] = q[i];
      const [xj, yj] = q[j];
      if (yi > t[1] !== yj > t[1] && t[0] < ((xj - xi) * (t[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  if (inside) return t;
  let best: [number, number] | undefined;
  let bd = Infinity;
  for (const q of loops) {
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const [ax, ay] = q[j];
      const [bx, by] = q[i];
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy || 1;
      const u = Math.min(1, Math.max(0, ((t[0] - ax) * dx + (t[1] - ay) * dy) / l2));
      const px = ax + u * dx;
      const py = ay + u * dy;
      const dd = Math.hypot(px - t[0], py - t[1]);
      if (dd < bd) {
        bd = dd;
        best = [px, py];
      }
    }
  }
  return best;
}

/** Made-up slant and width for the text layout (see Params.textWidth / textSlant). */
function textStyle(p: Params): { slant?: number; xScale?: number } {
  const w = clampN(p.textWidth ?? 100, 30, 300) / 100;
  const sl = clampN(p.textSlant ?? 0, -30, 30);
  return { ...(sl ? { slant: sl } : {}), ...(w !== 1 ? { xScale: w } : {}) };
}
