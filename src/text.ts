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
  /** The text of each laid-out line (after wrapping). */
  lineTexts: string[];
  /** Smallest and largest horizontal stretch applied (1 = none). */
  stretch: [number, number];
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
  let stretchLo = Infinity;
  let stretchHi = -Infinity;
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
