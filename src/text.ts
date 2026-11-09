import * as ot from 'opentype.js';
import type { Font, PathCommand } from 'opentype.js';

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
}

export function parseFont(buffer: ArrayBuffer): Font {
  return parse(buffer);
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
}

/** Lay out one line of text: glyphs with x positions (mm) and total width. */
function shapeLine(font: Font, line: string, opts: LayoutOptions, fontSize: number): { items: Placed[]; width: number } {
  const fallbacks: Font[] = (font as any).__fallbacks ?? [];
  const chars = Array.from(line);
  const has = (f: Font, ch: string) => ch.trim() === '' || f.charToGlyphIndex(ch) > 0;
  const allInMain = chars.every((ch) => has(font, ch));

  // Each run is a glyph plus the font it comes from.
  let run: { glyph: ReturnType<Font['charToGlyph']>; font: Font }[];
  if (allInMain) {
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
    x += (glyph.advanceWidth ?? 0) * scale;
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
  const lines = opts.maxWidth
    ? paragraphs.flatMap((p) => wrapParagraph(font, p, opts, fontSize, opts.maxWidth!))
    : paragraphs;
  const contours: Vec2[][] = [];
  const lineGroups: Vec2[][][] = [];
  let lastBaseline = 0;
  let widest = 0;
  const tol = Math.max(0.25, opts.capHeight / 120);
  const shaped = lines.map((line) => shapeLine(font, line, opts, fontSize));
  for (const s of shaped) widest = Math.max(widest, s.width);

  shaped.forEach(({ items, width }, li) => {
    const baseY = li * lineHeight; // opentype y-down
    const align = opts.align ?? 'center';
    const shift = align === 'left' ? -widest / 2 : align === 'right' ? widest / 2 - width : -width / 2;
    const lineContours: Vec2[][] = [];
    for (const p of items) {
      const path = p.glyph.getPath(p.x + shift, baseY, fontSize);
      lineContours.push(...flatten(path.commands, tol));
    }
    contours.push(...lineContours);
    if (lineContours.length) lineGroups.push(lineContours);
    if (lines[li].trim().length) lastBaseline = -baseY;
  });

  return { contours, lines: lineGroups, lastBaseline, capHeight: opts.capHeight, lineCount: lines.length };
}
