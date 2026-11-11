import * as ot from 'opentype.js';
import type { Font, PathCommand } from 'opentype.js';
import { unzlibSync } from 'fflate';

const otAny = ot as any;
const parse: (b: ArrayBuffer) => Font = otAny.parse ?? otAny.default?.parse;

export type Vec2 = [number, number];

export interface TextLayout {
  /** All closed contours of every glyph, in mm, y up. Fill rule: NonZero. */
  contours: Vec2[][];
  /** Contours grouped per text line (empty lines omitted). */
  lines: Vec2[][][];
  /** Baseline y (mm) of the last line. */
  lastBaseline: number;
  /** Cap height actually used, in mm. */
  capHeight: number;
  /** Number of laid-out lines (after wrapping). */
  lineCount: number;
  /** The text of each laid-out line (after wrapping). */
  lineTexts: string[];
  /** Smallest and largest horizontal stretch applied (1 = none). */
  stretch: [number, number];
  /** Centre of each letter (key = index among non-space characters), y up, mm. */
  letterCenters: { i: number; x: number; y: number }[];
  /** Contours of each glyph on its own (same point arrays as `contours`, so already stretched/moved). */
  glyphs: Vec2[][][];
  /** For each entry of `glyphs`: its letter index (-1 = not a letter) and its index in `lines`. */
  glyphLetter: number[];
  glyphLine: number[];
}

export interface LayoutOptions {
  capHeight: number; // mm
  tracking: number; // fraction of em
  /** Extra space between letters, in mm. */
  gap?: number;
  lineSpacing: number; // multiple of cap height
  /** Wrap lines to this width in mm. */
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  /** Stretch or squeeze every line horizontally so its ink spans exactly this width (mm). */
  stretchTo?: number;
  /**
   * Width factor per letter, keyed by the letter's index among all non-space
   * characters of the text (so keys survive re-wrapping). 1 = normal.
   */
  widths?: Record<string, number>;
  /** Move (mm) and rotate (degrees) single letters; same keys as widths. */
  moves?: Record<string, LetterMove>;
  /** Lean letters to the right by this many degrees (made-up italic when a font has none). */
  slant?: number;
  /** Stretch everything horizontally (made-up width when a font has no width setting). 1 = none. */
  xScale?: number;
}

export interface LetterMove {
  dx?: number;
  dy?: number;
  rot?: number;
  /** This letter's own axis values on a variable font: weight, slant (negative = right), italic 0/1. */
  wght?: number;
  slnt?: number;
  ital?: number;
  /** Made-up extra thickness for this letter, mm (fonts without a weight axis; done in geometry). */
  bold?: number;
  /** Lean this letter right by this many degrees (around the baseline). */
  slant?: number;
}

export function parseFont(buffer: ArrayBuffer): Font {
  const f = parse(buffer);
  // HarfBuzz reads only plain TTF/OTF: keep WOFF fonts unpacked for it
  try {
    (f as any).__bytes = isWoff1(buffer) ? woff1ToSfnt(buffer) : buffer;
  } catch {
    /* shaping falls back to opentype.js */
  }
  return f;
}

function isWoff1(b: ArrayBuffer): boolean {
  const u = new Uint8Array(b, 0, Math.min(4, b.byteLength));
  return u[0] === 0x77 && u[1] === 0x4f && u[2] === 0x46 && u[3] === 0x46; // 'wOFF'
}

/** WOFF 1.0 → TTF/OTF: inflate each table and write a normal table directory. */
function woff1ToSfnt(buf: ArrayBuffer): ArrayBuffer {
  const dv = new DataView(buf);
  const flavor = dv.getUint32(4);
  const n = dv.getUint16(12);
  const tables: { tag: number; checksum: number; data: Uint8Array }[] = [];
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const off = dv.getUint32(o + 4);
    const comp = dv.getUint32(o + 8);
    const orig = dv.getUint32(o + 12);
    const raw = new Uint8Array(buf, off, comp);
    tables.push({ tag: dv.getUint32(o), checksum: dv.getUint32(o + 16), data: comp < orig ? unzlibSync(raw) : raw });
  }
  let size = 12 + 16 * n;
  for (const t of tables) size += (t.data.length + 3) & ~3;
  const out = new Uint8Array(size);
  const ov = new DataView(out.buffer);
  let es = 0;
  while (1 << (es + 1) <= n) es++;
  ov.setUint32(0, flavor);
  ov.setUint16(4, n);
  ov.setUint16(6, (1 << es) * 16);
  ov.setUint16(8, es);
  ov.setUint16(10, n * 16 - (1 << es) * 16);
  let at = 12 + 16 * n;
  tables.forEach((t, i) => {
    const o = 12 + i * 16;
    ov.setUint32(o, t.tag);
    ov.setUint32(o + 4, t.checksum);
    ov.setUint32(o + 8, at);
    ov.setUint32(o + 12, t.data.length);
    out.set(t.data, at);
    at += (t.data.length + 3) & ~3;
  });
  return out.buffer;
}

/** True for WOFF2 data (needs decoding before parseFont). */
export function isWoff2(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x32; // 'wOF2'
}

export interface FontAxis {
  tag: string;
  min: number;
  max: number;
  def: number;
}

/** Variation axes of a variable font (empty for a normal font). */
export function fontAxes(font: Font): FontAxis[] {
  const fvar = (font.tables as any).fvar;
  if (!fvar?.axes) return [];
  return fvar.axes.map((a: any) => ({ tag: a.tag, min: a.minValue, max: a.maxValue, def: a.defaultValue }));
}

/**
 * Set a variable font's axes (e.g. { wght: 650, wdth: 90 }); missing axes go back to their default,
 * values are clamped to the font's range. Outlines and letter widths follow (opentype.js gvar/HVAR).
 */
export function setFontVariation(font: Font, coords: Record<string, number> | undefined) {
  const axes = fontAxes(font);
  const v = (font as any).variation;
  if (!axes.length || !v) return;
  const c: Record<string, number> = {};
  for (const a of axes) {
    const want = coords?.[a.tag];
    c[a.tag] = Number.isFinite(want) ? Math.min(a.max, Math.max(a.min, want as number)) : a.def;
  }
  v.set(c);
  (font as any).__coords = c;
}

/** Advance width of a glyph with the font's current variation applied. */
function advance(f: Font, glyph: ReturnType<Font['charToGlyph']>): number {
  const hf = (f as any).__coords ? hbFont(f) : undefined;
  if (hf && glyph.index !== undefined) {
    try {
      return hf.glyphHAdvance(glyph.index);
    } catch {
      /* fall through */
    }
  }
  const v = (f as any).variation;
  if (v && (f as any).__coords && (f.tables as any).hvar) return v.getTransform(glyph).advanceWidth ?? glyph.advanceWidth ?? 0;
  return glyph.advanceWidth ?? 0;
}

function capUnits(font: Font): number {
  const os2 = (font.tables as any).os2;
  if (os2 && os2.sCapHeight > 0) return os2.sCapHeight;
  const g = font.charToGlyph('H');
  const bb = g.getBoundingBox();
  if (bb.y2 > 0) return bb.y2;
  return font.unitsPerEm * 0.7;
}

/** Flatten an opentype path into closed polylines (y flipped to y-up). */
function flatten(commands: PathCommand[], tol: number): Vec2[][] {
  const out: Vec2[][] = [];
  let cur: Vec2[] = [];
  let px = 0;
  let py = 0;
  const push = (x: number, y: number) => {
    const last = cur[cur.length - 1];
    if (last && Math.abs(last[0] - x) < 1e-6 && Math.abs(last[1] + y) < 1e-6) return;
    cur.push([x, -y]);
  };
  const close = () => {
    if (cur.length > 2) {
      const a = cur[0];
      const b = cur[cur.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) cur.pop();
      if (cur.length > 2) out.push(cur);
    }
    cur = [];
  };
  for (const c of commands) {
    switch (c.type) {
      case 'M':
        close();
        push(c.x, c.y);
        px = c.x;
        py = c.y;
        break;
      case 'L':
        push(c.x, c.y);
        px = c.x;
        py = c.y;
        break;
      case 'Q': {
        const len = Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x - c.x1, c.y - c.y1);
        const n = Math.max(2, Math.min(32, Math.ceil(len / tol)));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const mt = 1 - t;
          push(mt * mt * px + 2 * mt * t * c.x1 + t * t * c.x, mt * mt * py + 2 * mt * t * c.y1 + t * t * c.y);
        }
        px = c.x;
        py = c.y;
        break;
      }
      case 'C': {
        const len =
          Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2);
        const n = Math.max(2, Math.min(40, Math.ceil(len / tol)));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const mt = 1 - t;
          const a = mt * mt * mt;
          const b = 3 * mt * mt * t;
          const d = 3 * mt * t * t;
          const e = t * t * t;
          push(a * px + b * c.x1 + d * c.x2 + e * c.x, a * py + b * c.y1 + d * c.y2 + e * c.y);
        }
        px = c.x;
        py = c.y;
        break;
      }
      case 'Z':
        close();
        break;
    }
  }
  close();
  return out;
}

/** Extra fonts (e.g. the latin-ext half of a split webfont) used for characters the main font lacks. */
export function setFallbacks(font: Font, fallbacks: Font[]) {
  (font as any).__fallbacks = fallbacks;
}

interface Placed {
  glyph: ReturnType<Font['charToGlyph']>;
  font: Font;
  x: number;
  /** Vertical offset (mm, up), e.g. accents placed by the shaper. */
  dy?: number;
  /** The text this glyph stands for (several letters for a ligature like "fi"). */
  text?: string;
}

// ---------- HarfBuzz shaping (set up by the worker; layout falls back to opentype.js without it) ----------
let HB: any;
/** Give the layout a HarfBuzz module (`import('harfbuzzjs')`). */
export function setShaper(hb: any) {
  HB = hb;
}
/** Whether HarfBuzz shaping is available. */
export function hasShaper(): boolean {
  return !!HB;
}
const hbFonts = new WeakMap<Font, { font: any; coords: string }>();
function hbFont(f: Font): any | undefined {
  if (!HB) return undefined;
  const bytes: ArrayBuffer | undefined = (f as any).__bytes;
  if (!bytes) return undefined;
  let e = hbFonts.get(f);
  if (!e) {
    try {
      const face = new HB.Face(new HB.Blob(bytes));
      e = { font: new HB.Font(face), coords: '' };
      hbFonts.set(f, e);
    } catch {
      return undefined;
    }
  }
  // keep HarfBuzz on the same weight/width as the outlines
  const c = (f as any).__coords as Record<string, number> | undefined;
  const key = c ? JSON.stringify(c) : '';
  if (key !== e.coords) {
    e.font.setVariations(c ? Object.entries(c).map(([t, v]) => new HB.Variation(t, v)) : []);
    e.coords = key;
  }
  return e.font;
}

/** Shape a line with HarfBuzz: kerning, ligatures, accents and complex scripts (Arabic, Hindi…). */
function hbShape(f: Font, hf: any, line: string, opts: LayoutOptions, fontSize: number): { items: Placed[]; width: number } | undefined {
  const buf = new HB.Buffer();
  try {
    buf.addText(line);
    buf.guessSegmentProperties();
    HB.shape(hf, buf);
    const infos = buf.getGlyphInfos();
    const pos = buf.getGlyphPositions();
    const scale = fontSize / f.unitsPerEm;
    // cluster = UTF-16 index where this glyph's text starts; its text runs to the next cluster
    const starts = [...new Set(infos.map((g: any) => g.cluster as number))].sort((a: any, b: any) => a - b) as number[];
    const textOf = (c: number) => line.slice(c, starts[starts.indexOf(c) + 1] ?? line.length);
    const items: Placed[] = [];
    let x = 0;
    let lastCluster = -1;
    for (let i = 0; i < infos.length; i++) {
      const g = f.glyphs.get(infos[i].codepoint);
      if (!g) return undefined;
      // a missing-glyph box where opentype.js finds a real letter means HarfBuzz misread the font
      if (infos[i].codepoint === 0) {
        const ch = String.fromCodePoint(line.codePointAt(infos[i].cluster) ?? 32);
        if (ch.trim() && f.charToGlyphIndex(ch) > 0) return undefined;
      }
      const p = pos[i];
      const first = infos[i].cluster !== lastCluster; // marks/extra glyphs of a cluster carry no letter
      lastCluster = infos[i].cluster;
      items.push({ glyph: g, font: f, x: x + p.xOffset * scale, dy: p.yOffset * scale, text: first ? textOf(infos[i].cluster) : '' });
      x += p.xAdvance * scale;
      if (i < infos.length - 1 && infos[i + 1].cluster !== infos[i].cluster) x += opts.tracking * fontSize + (opts.gap ?? 0);
    }
    return { items, width: x };
  } catch {
    return undefined;
  } finally {
    try {
      buf.destroy?.();
    } catch {
      /* ignore */
    }
  }
}

/** Lay out one line of text: glyphs with x positions (mm) and total width. */
function shapeLine(font: Font, line: string, opts: LayoutOptions, fontSize: number): { items: Placed[]; width: number } {
  const fallbacks: Font[] = (font as any).__fallbacks ?? [];
  const chars = Array.from(line);
  const has = (f: Font, ch: string) => ch.trim() === '' || f.charToGlyphIndex(ch) > 0;
  const allInMain = chars.every((ch) => has(font, ch));

  // HarfBuzz when we can (whole line in one font, no per-letter edits that need one glyph per letter)
  const edits = (o?: object) => !!o && Object.keys(o).length > 0;
  const hf = allInMain && !edits(opts.widths) && !edits(opts.moves) ? hbFont(font) : undefined;
  if (hf) {
    const r = hbShape(font, hf, line, opts, fontSize);
    if (r) return r;
  }

  // Each run is a glyph plus the font it comes from.
  let run: { glyph: ReturnType<Font['charToGlyph']>; font: Font }[];
  if (allInMain && !opts.widths && !opts.moves) {
    let glyphs: ReturnType<Font['stringToGlyphs']>;
    try {
      glyphs = font.stringToGlyphs(line);
    } catch {
      // Some fonts use OpenType features opentype.js can't apply; fall back to plain mapping.
      glyphs = chars.map((ch) => font.charToGlyph(ch));
    }
    run = glyphs.map((glyph) => ({ glyph, font }));
  } else {
    run = chars.map((ch) => {
      const f = has(font, ch) ? font : (fallbacks.find((fb) => has(fb, ch)) ?? font);
      return { glyph: f.charToGlyph(ch), font: f };
    });
  }

  const items: Placed[] = [];
  let x = 0;
  for (let i = 0; i < run.length; i++) {
    const { glyph, font: f } = run[i];
    const scale = fontSize / f.unitsPerEm;
    items.push({ glyph, font: f, x });
    x += advance(f, glyph) * scale;
    if (i < run.length - 1) {
      if (run[i + 1].font === f) x += f.getKerningValue(glyph, run[i + 1].glyph) * scale;
      x += opts.tracking * fontSize + (opts.gap ?? 0);
    }
  }
  return { items, width: x };
}

/** Split a paragraph into lines no wider than maxWidth (greedy, on spaces). */
function wrapParagraph(font: Font, para: string, opts: LayoutOptions, fontSize: number, maxWidth: number): string[] {
  const words = para.split(/ +/).filter((w) => w.length);
  if (!words.length) return [''];
  const out: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = cur + ' ' + words[i];
    if (shapeLine(font, next, opts, fontSize).width <= maxWidth) cur = next;
    else {
      out.push(cur);
      cur = words[i];
    }
  }
  out.push(cur);
  return out;
}

export function layoutText(font: Font, text: string, opts: LayoutOptions): TextLayout {
  const cu = capUnits(font);
  const fontSize = (opts.capHeight * font.unitsPerEm) / cu;
  const lineHeight = opts.capHeight * opts.lineSpacing;
  const paragraphs = text.replace(/\r/g, '').split('\n');
  const xs = opts.xScale && opts.xScale > 0 ? opts.xScale : 1;
  const lines = opts.maxWidth
    ? paragraphs.flatMap((p) => wrapParagraph(font, p, opts, fontSize, opts.maxWidth! / xs))
    : paragraphs;
  const wAxis = fontAxes(font).find((a) => a.tag === 'wdth');
  const axisTags = new Set(fontAxes(font).map((a) => a.tag));
  const contours: Vec2[][] = [];
  const lineGroups: Vec2[][][] = [];
  let lastBaseline = 0;
  let widest = 0;
  const tol = Math.max(0.25, opts.capHeight / 120);
  const shaped = lines.map((line) => shapeLine(font, line, opts, fontSize));
  let stretchLo = Infinity;
  let stretchHi = -Infinity;
  for (const s of shaped) widest = Math.max(widest, s.width);

  const centers: { i: number; x: number; y: number }[] = [];
  const glyphs: Vec2[][][] = [];
  const glyphLetter: number[] = [];
  const glyphLine: number[] = [];
  const useWidths = !!opts.widths && Object.keys(opts.widths).length > 0;
  let letterNo = 0; // running index of non-space characters
  shaped.forEach(({ items, width }, li) => {
    const baseY = li * lineHeight; // opentype y-down
    const align = opts.align ?? 'center';
    const shift = align === 'left' ? -widest / 2 : align === 'right' ? widest / 2 - width : -width / 2;
    const lineContours: Vec2[][] = [];
    const chars = Array.from(lines[li]);
    // Per-letter widths: each glyph's slot is scaled by its factor, later glyphs move along.
    let offset = 0;
    const owned: { i: number; from: number; to: number }[] = [];
    items.forEach((p, k) => {
      const ch = p.text ?? chars[k] ?? '';
      const isLetter = ch.trim() !== '';
      const w = useWidths && isLetter ? Math.max(0.1, opts.widths![String(letterNo)] ?? 1) : 1;
      const myNo = letterNo;
      // a ligature ("fi") stands for several letters: keep the numbering of later letters right
      letterNo += Array.from(ch).filter((c) => c.trim() !== '').length;
      // A variable font with a width axis draws a narrower/wider letter for real (strokes keep their
      // thickness); only what the axis can't reach is made up by stretching.
      // Per-letter weight on a variable font is drawn for real, and the letter's slot follows its new
      // width (a bold letter needs more room).
      let sx = w;
      let extra = 0; // mm the slot grows because of a per-letter weight
      let path: ReturnType<typeof p.glyph.getPath>;
      const useFont = (p.font as any).variation ? p.font : undefined;
      // this letter's own axis values (weight, slant, italic) on a variable font
      const mvL = isLetter && p.font === font ? opts.moves?.[String(myNo)] : undefined;
      const ov: Record<string, number> = {};
      if (mvL) for (const t of ['wght', 'slnt', 'ital'] as const) if (mvL[t] !== undefined && axisTags.has(t)) ov[t] = mvL[t]!;
      const hasOv = Object.keys(ov).length > 0;
      const realW = w !== 1 && !!wAxis && p.font === font;
      if (realW || hasOv) {
        const base = { ...((font as any).__coords ?? {}) } as Record<string, number>;
        const advBase = advance(font, p.glyph);
        const weighted = hasOv ? { ...base, ...ov } : base;
        if (hasOv) setFontVariation(font, weighted);
        const advW = advance(font, p.glyph);
        const drawAt = realW ? { ...weighted, wdth: (base.wdth ?? wAxis!.def) * w } : weighted;
        setFontVariation(font, drawAt);
        path = p.glyph.getPath(p.x + shift, baseY - (p.dy ?? 0), fontSize, undefined, font);
        const advD = advance(font, p.glyph);
        setFontVariation(font, base);
        sx = realW && advD > 0 ? (w * advW) / advD : w;
        extra = ((advW - advBase) * fontSize * w) / font.unitsPerEm;
      } else {
        path = p.glyph.getPath(p.x + shift, baseY - (p.dy ?? 0), fontSize, undefined, useFont);
      }
      const cs = flatten(path.commands, tol);
      const x0 = p.x + shift;
      if (sx !== 1 || offset !== 0) for (const c of cs) for (const pt of c) pt[0] = x0 + offset + (pt[0] - x0) * sx;
      if (cs.length) {
        glyphs.push(cs);
        glyphLetter.push(isLetter ? myNo : -1);
        glyphLine.push(lineGroups.length);
      }
      if (isLetter && cs.length) owned.push({ i: myNo, from: lineContours.length, to: lineContours.length + cs.length });
      lineContours.push(...cs);
      const next = k < items.length - 1 ? items[k + 1].x : width;
      offset += (next - p.x) * (w - 1) + extra;
    });
    if (xs !== 1) for (const c of lineContours) for (const pt of c) pt[0] *= xs;
    if (opts.slant) {
      // lean around the baseline, so letters stay standing on it
      const t = Math.tan((opts.slant * Math.PI) / 180);
      const by = -baseY;
      for (const c of lineContours) for (const pt of c) pt[0] += (pt[1] - by) * t;
    }
    if (opts.stretchTo && lineContours.length) {
      // Like a variable font's width axis: scale the line's outlines horizontally to fill the width.
      let lo = Infinity;
      let hi = -Infinity;
      for (const c of lineContours) for (const [x] of c) {
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
      const sx = opts.stretchTo / Math.max(1e-6, hi - lo);
      const left = -opts.stretchTo / 2;
      for (const c of lineContours) for (const pt of c) pt[0] = left + (pt[0] - lo) * sx;
      stretchLo = Math.min(stretchLo, sx);
      stretchHi = Math.max(stretchHi, sx);
    }
    // Per-letter centre, then the user's move/rotate for that letter (after stretching,
    // so a moved letter keeps its shape). Contours are already y-up here.
    for (const o of owned) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let c = o.from; c < o.to; c++) for (const [x, y] of lineContours[c]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      let cx = (x0 + x1) / 2;
      let cy = (y0 + y1) / 2;
      const mv = opts.moves?.[String(o.i)];
      if (mv?.slant) {
        // lean just this letter around the baseline (before any turn or move)
        const t = Math.tan((mv.slant * Math.PI) / 180);
        const by = -baseY;
        for (let c = o.from; c < o.to; c++) for (const pt of lineContours[c]) pt[0] += (pt[1] - by) * t;
        cx += ((y0 + y1) / 2 - by) * t;
      }
      if (mv && (mv.dx || mv.dy || mv.rot)) {
        const a = ((mv.rot ?? 0) * Math.PI) / 180;
        const cos = Math.cos(a), sin = Math.sin(a);
        const dx = mv.dx ?? 0, dy = mv.dy ?? 0;
        for (let c = o.from; c < o.to; c++)
          for (const pt of lineContours[c]) {
            const rx = pt[0] - cx, ry = pt[1] - cy;
            pt[0] = cx + rx * cos - ry * sin + dx;
            pt[1] = cy + rx * sin + ry * cos + dy;
          }
        cx += dx;
        cy += dy;
      }
      centers.push({ i: o.i, x: cx, y: cy });
    }
    contours.push(...lineContours);
    if (lineContours.length) lineGroups.push(lineContours);
    if (lines[li].trim().length) lastBaseline = -baseY;
  });

  return {
    contours,
    lines: lineGroups,
    lastBaseline,
    capHeight: opts.capHeight,
    lineCount: lines.length,
    lineTexts: lines,
    stretch: [stretchLo === Infinity ? 1 : stretchLo, stretchHi === -Infinity ? 1 : stretchHi],
    letterCenters: centers,
    glyphs,
    glyphLetter,
    glyphLine,
  };
}

/**
 * Choose line breaks so the text fills a box when every line is stretched to the
 * box width (the "fill the page" look). Tries every line count and, for each,
 * the best split of the words (dynamic programming), scoring how far each line
 * has to be stretched or squeezed from its natural width. Typed line breaks are kept.
 */
export function smartLines(
  font: Font,
  text: string,
  opts: { tracking: number; lineSpacing: number },
  boxW: number,
  boxH: number,
): { lines: string[]; cap: number; capFill: number } {
  const words: { w: string; forced: boolean }[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    const ws = para.split(/ +/).filter((x) => x.length);
    ws.forEach((w, i) => words.push({ w, forced: i === ws.length - 1 }));
  }
  const W = words.length;

  // Natural widths at a cap height of 1 mm (widths scale linearly with size).
  const lo: LayoutOptions = { capHeight: 1, tracking: opts.tracking, lineSpacing: opts.lineSpacing };
  const fs = font.unitsPerEm / capUnits(font);
  const wordW = words.map((x) => shapeLine(font, x.w, lo, fs).width);
  const space = shapeLine(font, 'a a', lo, fs).width - 2 * shapeLine(font, 'a', lo, fs).width;
  const prefix = [0];
  for (const w of wordW) prefix.push(prefix[prefix.length - 1] + w);
  const lineW = (i: number, j: number) => prefix[j] - prefix[i] + space * (j - i - 1);
  // a line may not run across a typed line break
  const crosses = (i: number, j: number) => {
    for (let k = i; k < j - 1; k++) if (words[k].forced) return true;
    return false;
  };
  const forcedCount = words.filter((x) => x.forced).length; // minimum number of lines

  const lineCost = (stretch: number) => {
    const l = Math.log(stretch);
    let c = l * l;
    if (stretch > 2.2) c += 3 * (stretch - 2.2) ** 2; // very wide letters look odd
    if (stretch < 0.45) c += 3 * ((0.45 - stretch) * 4) ** 2; // so do very thin ones
    return c;
  };

  const MIN_SQUEEZE = 0.5; // never condense letters below half their width
  let best: { score: number; lines: string[]; cap: number; capFill: number } | null = null;
  const maxLines = Math.max(1, Math.min(W, 40));
  for (let n = Math.max(1, forcedCount); n <= maxLines; n++) {
    const cap = boxH / ((n - 1) * opts.lineSpacing + 1.2);
    // dp[k][j]: best cost putting the first j words on k lines
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(Infinity));
    const from: number[][] = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(-1));
    dp[0][0] = 0;
    for (let k = 1; k <= n; k++) {
      for (let j = k; j <= W; j++) {
        // a typed break must end a line
        for (let i = k - 1; i < j; i++) {
          if (dp[k - 1][i] === Infinity || crosses(i, j)) continue;
          const c = dp[k - 1][i] + lineCost(boxW / (cap * Math.max(1e-6, lineW(i, j))));
          if (c < dp[k][j]) {
            dp[k][j] = c;
            from[k][j] = i;
          }
        }
      }
    }
    if (dp[n][W] === Infinity) continue;
    const breaks: number[] = [];
    for (let k = n, j = W; k > 0; k--) {
      breaks.unshift(j);
      j = from[k][j];
    }
    // If filling the full height would crush the widest line, use smaller letters instead
    // (the block then sits centred on the front with some space around it).
    let widest = 0;
    let st = 0;
    for (const end of breaks) {
      widest = Math.max(widest, lineW(st, end));
      st = end;
    }
    const capUsed = Math.min(cap, boxW / (MIN_SQUEEZE * Math.max(1e-6, widest)));
    const lines: string[] = [];
    let start = 0;
    let worst = 0;
    let total = 0;
    for (const end of breaks) {
      lines.push(words.slice(start, end).map((x) => x.w).join(' '));
      const c = lineCost(boxW / (capUsed * lineW(start, end)));
      worst = Math.max(worst, c);
      total += c;
      start = end;
    }
    // letters get stretched taller to make up the rest of the height; keep that modest
    const tall = cap / capUsed;
    const score = total / n + 0.5 * worst + 0.6 * Math.log(tall) ** 2;
    if (!best || score < best.score) best = { score, lines, cap: capUsed, capFill: cap };
  }
  return best ?? { lines: [text], cap: boxH / 1.2, capFill: boxH / 1.2 };
}
