import type { ManifoldToplevel, CrossSection, Manifold, Vec2 as MVec2 } from 'manifold-3d';
import * as SS from 'straight-skeleton';
import QRCode from 'qrcode';
import type { Font } from 'opentype.js';
import { layoutText, type Vec2 } from './text';

const SkeletonBuilder: typeof SS.SkeletonBuilder = (SS as any).SkeletonBuilder ?? (SS as any).default.SkeletonBuilder;

export type Style = 'sign' | 'planter' | 'topo' | 'facet' | 'keychain' | 'vase' | 'stack' | 'stepped' | 'ramp';

export interface Params {
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
  // bold stack
  stDepth: number;
  stStep: number;
  stMode: 'cascade' | 'alternate';
  stRound: number;
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
}

export interface Part {
  name: string;
  color: string;
  positions: Float32Array;
  indices: Uint32Array;
  /** Shown in the viewer only (e.g. moss fill); never exported. */
  previewOnly?: boolean;
}

export interface BuildResult {
  parts: Part[];
  warnings: string[];
  size: [number, number, number];
}

interface WorkPart {
  name: string;
  color: string;
  m?: Manifold;
  raw?: { positions: Float32Array; indices: Uint32Array };
  previewOnly?: boolean;
}

type Deletable = { delete(): void };

/** Stacked slabs overlap by this much so unions fuse into one solid. */
const OVERLAP = 0.01;

export class Builder {
  private bin: Deletable[] = [];
  private kept: WorkPart[] = [];
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

  build(font: Font, p: Params, topFont?: Font): BuildResult {
    this.releaseKept();
    const warnings: string[] = [];
    let parts: WorkPart[] = [];
    try {
      const layout = layoutText(font, p.text || ' ', {
        capHeight: p.capHeight,
        tracking: p.tracking,
        lineSpacing: p.lineSpacing,
      });
      const cs = this.k(new this.wasm.CrossSection(layout.contours as MVec2[][], 'NonZero'));
      if (cs.isEmpty()) {
        return { parts: [], warnings: ['Type something to get started.'], size: [0, 0, 0] };
      }
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
        case 'vase':
          parts = this.vase(cs, layout.lastBaseline, p, warnings, topFont ?? font);
          break;
        case 'stack':
          parts = this.stack(layout.lines, p, warnings);
          break;
        case 'stepped':
          parts = this.stepped(cs, p, warnings);
          break;
        case 'ramp':
          parts = this.ramp(cs, layout.lines, p, warnings);
          break;
      }
      if (p.splitBed) parts = this.splitToBed(parts, p.bedSize, warnings);

      // Detach manifolds we keep for export from the garbage bin.
      const keep = new Set(parts.filter((x) => !x.previewOnly).map((x) => x.m).filter(Boolean) as Manifold[]);
      this.bin = this.bin.filter((o) => !keep.has(o as Manifold));
      this.kept = parts.filter((x) => !x.previewOnly);

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
        out.push({ name: wp.name, color: wp.color, positions, indices });
      }
      const size: [number, number, number] = out.length
        ? [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]
        : [0, 0, 0];
      if (!p.splitBed && (size[0] > p.bedSize || size[1] > p.bedSize)) {
        warnings.push(
          `Model is ${Math.round(size[0])}×${Math.round(size[1])} mm, larger than your ${p.bedSize} mm bed. Turn on "Split to fit bed".`,
        );
      }
      return { parts: out, warnings, size };
    } finally {
      this.flush();
    }
  }

  /** Union of all kept parts, for single-body STL export. */
  mergedMesh(): { positions: Float32Array; indices: Uint32Array } {
    const ms = this.kept.filter((p) => p.m).map((p) => p.m!) as Manifold[];
    const raws = this.kept.filter((p) => p.raw).map((p) => p.raw!);
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


  private cs(contours: Vec2[][]): CrossSection {
    return this.k(new this.wasm.CrossSection(contours as MVec2[][], 'NonZero'));
  }

  private circle(x: number, y: number, r: number): CrossSection {
    return this.k(this.wasm.CrossSection.circle(r, 48).translate([x, y]));
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

  private vase(cs: CrossSection, baseline: number, p: Params, warnings: string[], topFont: Font): WorkPart[] {
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
    if (D < t + 2 * half) {
      warnings.push(`Make the depth at least ${(t + 2 * half).toFixed(1)} mm to fit stem holes behind the top word.`);
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
        topCs = this.k(topCs.translate([-(tb.min[0] + tb.max[0]) / 2 + (bb.min[0] + bb.max[0]) / 2, 0]));
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
    const parts: WorkPart[] = [{ name: 'Base word', color: p.colorA, m: main }];
    if (topCs) parts.push({ name: 'Top word', color: p.colorB, m: toStand(this.extrude(topCs, t)) });
    const zmin = Math.min(...parts.map((x) => x.m!.boundingBox().min[2]));
    for (const x of parts) x.m = this.k(x.m!.translate([0, 0, -zmin]));
    if (holes.length) warnings.push(`${holes.length} stem holes, ${p.holeD} mm wide and ${p.holeDepth} mm deep. Print standing up.`);
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

  private stepped(cs: CrossSection, p: Params, warnings: string[]): WorkPart[] {
    const N = Math.max(1, Math.round(p.spSteps));
    const slabs: Manifold[] = [];
    for (let k = 0; k < N; k++) {
      const grow = (N - 1 - k) * p.spInset;
      const s = grow > 0 ? this.k(cs.offset(grow, p.spJoin, 4)) : cs;
      slabs.push(this.extrude(s, p.spHeight + (k ? OVERLAP : 0), k * p.spHeight - (k ? OVERLAP : 0)));
    }
    if (p.spInset * (N - 1) > p.capHeight * 0.25) warnings.push('Wide steps start to merge the letters together.');
    return [{ name: 'Letters', color: p.colorA, m: this.k(this.wasm.Manifold.union(slabs)) }];
  }

  private ramp(cs: CrossSection, lines: Vec2[][][], p: Params, warnings: string[]): WorkPart[] {
    const z0 = p.rPlate ? p.rPlateT : 0;
    const parts: WorkPart[] = [];
    const lo = Math.max(0.4, p.rMin);
    const hi = Math.max(lo, p.rMax);
    const pieces: { c: CrossSection; x0: number; x1: number; idx: number }[] = [];
    let idx = 0;
    for (const lc of lines) {
      const lcs = this.cs(lc);
      const lb = lcs.bounds();
      const comps = lcs.decompose();
      comps.forEach((c) => this.k(c));
      comps.sort((a, b) => a.bounds().min[0] - b.bounds().min[0]);
      for (const c of comps) {
        const b = c.bounds();
        if (p.rSpan === 'line') pieces.push({ c, x0: lb.min[0], x1: lb.max[0], idx: idx++ });
        else pieces.push({ c, x0: b.min[0], x1: b.max[0], idx: idx++ });
      }
    }
    const ms: Manifold[] = [];
    for (const pc of pieces) {
      const rising = p.rDir === 'right' || (p.rDir === 'alternate' && pc.idx % 2 === 0);
      const span = Math.max(1e-3, pc.x1 - pc.x0);
      const m = this.k(
        this.k(pc.c.extrude(1)).warp((v) => {
          let t = (v[0] - pc.x0) / span;
          t = Math.min(1, Math.max(0, t));
          if (!rising) t = 1 - t;
          v[2] = v[2] * (lo + (hi - lo) * t) + z0;
        }),
      );
      ms.push(m);
    }
    if (ms.length) parts.push({ name: 'Letters', color: p.colorB, m: this.k(this.wasm.Manifold.union(ms)) });
    if (p.rPlate) {
      const b = cs.bounds();
      const pad = p.rPad;
      let plate = this.rect(b.min[0] - pad, b.min[1] - pad, b.max[0] + pad, b.max[1] + pad);
      plate = this.k(this.k(plate.offset(-2, 'Round')).offset(2, 'Round'));
      parts.unshift({ name: 'Plate', color: p.colorA, m: this.extrude(plate, p.rPlateT) });
    }
    if (hi - lo > (cs.bounds().max[0] - cs.bounds().min[0]) && p.rSpan === 'letter') {
      warnings.push('Very steep ramps may need supports.');
    }
    return parts;
  }

  private splitToBed(parts: WorkPart[], bed: number, warnings: string[]): WorkPart[] {
    const out: WorkPart[] = [];
    const usable = Math.max(20, bed - 10);
    let splitCount = 0;
    for (const part of parts) {
      if (!part.m || part.previewOnly) {
        out.push(part);
        continue;
      }
      const bb = part.m.boundingBox();
      const w = bb.max[0] - bb.min[0];
      const h = bb.max[1] - bb.min[1];
      if (w <= usable && h <= usable) {
        out.push(part);
        continue;
      }
      const nx = Math.ceil(w / usable);
      const ny = Math.ceil(h / usable);
      const cw = w / nx;
      const ch = h / ny;
      let idx = 0;
      for (let ix = 0; ix < nx; ix++) {
        for (let iy = 0; iy < ny; iy++) {
          const box = this.k(
            this.wasm.Manifold.cube([cw + (ix === nx - 1 ? 2 : 0), ch + (iy === ny - 1 ? 2 : 0), bb.max[2] - bb.min[2] + 2]).translate([
              bb.min[0] + ix * cw - (ix === 0 ? 1 : 0),
              bb.min[1] + iy * ch - (iy === 0 ? 1 : 0),
              bb.min[2] - 1,
            ]),
          );
          const piece = this.k(part.m.intersect(box));
          if (piece.isEmpty()) continue;
          for (const sub of piece.decompose()) {
            this.k(sub);
            idx++;
            out.push({ name: `${part.name} · piece ${idx}`, color: part.color, m: sub });
          }
        }
      }
      splitCount++;
    }
    if (splitCount) warnings.push(`${splitCount} part(s) were split to fit a ${bed} mm bed. Glue the pieces after printing.`);
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
