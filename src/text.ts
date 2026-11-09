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
}

export interface LayoutOptions {
  capHeight: number; // mm
  tracking: number; // fraction of em
  /** Extra space between letters, in mm. */
  gap?: number;
  lineSpacing: number; // multiple of cap height
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

export function layoutText(font: Font, text: string, opts: LayoutOptions): TextLayout {
  const cu = capUnits(font);
  const fontSize = (opts.capHeight * font.unitsPerEm) / cu;
  const scale = fontSize / font.unitsPerEm;
  const lineHeight = opts.capHeight * opts.lineSpacing;
  const lines = text.replace(/\r/g, '').split('\n');
  const contours: Vec2[][] = [];
  const lineGroups: Vec2[][][] = [];
  let lastBaseline = 0;
  const tol = Math.max(0.25, opts.capHeight / 120);

  lines.forEach((line, li) => {
    let glyphs: ReturnType<Font['stringToGlyphs']>;
    try {
      glyphs = font.stringToGlyphs(line);
    } catch {
      // Some fonts use OpenType features opentype.js can't apply; fall back to plain mapping.
      glyphs = Array.from(line).map((ch) => font.charToGlyph(ch));
    }
    const baseY = li * lineHeight; // opentype y-down
    const placed: { g: (typeof glyphs)[number]; x: number }[] = [];
    let x = 0;
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      placed.push({ g, x });
      x += (g.advanceWidth ?? 0) * scale;
      if (i < glyphs.length - 1) {
        x += font.getKerningValue(g, glyphs[i + 1]) * scale;
        x += opts.tracking * fontSize + (opts.gap ?? 0);
      }
    }
    const shift = -x / 2;
    const lineContours: Vec2[][] = [];
    for (const p of placed) {
      const path = p.g.getPath(p.x + shift, baseY, fontSize);
      lineContours.push(...flatten(path.commands, tol));
    }
    contours.push(...lineContours);
    if (lineContours.length) lineGroups.push(lineContours);
    if (line.trim().length) lastBaseline = -baseY;
  });

  return { contours, lines: lineGroups, lastBaseline, capHeight: opts.capHeight };
}
