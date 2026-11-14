/**
 * Ribbon letters (user photo of a calligraphy sculpture made of thin, deep ribbons; own design):
 * find the centre line of every stroke of the text, then the builder turns each line into a thin
 * standing wall whose depth sways along the stroke.
 *
 * Centre lines: the letters are drawn onto a fine grid, thinned to one-pixel-wide lines
 * (Zhang–Suen), and the lines are traced into a graph. Short side spurs (corner whiskers) are cut,
 * and at every crossing the branches are paired by the straightest way through, so a stroke that
 * crosses another keeps going as one long line (that is what makes the over/under weave read).
 */
export type P = [number, number];

/** Fill the outlines (non-zero rule) onto a grid of `res` mm cells. */
function rasterize(contours: P[][], res: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of contours) for (const [x, y] of c) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const pad = 2;
  const W = Math.ceil((x1 - x0) / res) + 2 * pad;
  const H = Math.ceil((y1 - y0) / res) + 2 * pad;
  const ox = x0 - pad * res, oy = y0 - pad * res;
  const g = new Uint8Array(W * H);
  const edges: [number, number, number, number][] = [];
  for (const c of contours) for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    if (a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1]]);
  }
  const xs: [number, number][] = [];
  for (let j = 0; j < H; j++) {
    const y = oy + (j + 0.5) * res;
    xs.length = 0;
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push([ax + ((y - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1]);
    }
    xs.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k][1];
      if (wind === 0) continue;
      const i0 = Math.max(0, Math.ceil((xs[k][0] - ox) / res - 0.5));
      const i1 = Math.min(W - 1, Math.floor((xs[k + 1][0] - ox) / res - 0.5));
      for (let i = i0; i <= i1; i++) g[j * W + i] = 1;
    }
  }
  return { g, W, H, ox, oy };
}

/** Zhang–Suen thinning (in place). */
function thin(g: Uint8Array, W: number, H: number) {
  const del: number[] = [];
  let changed = true;
  const at = (i: number, j: number) => g[j * W + i];
  while (changed) {
    changed = false;
    for (const pass of [0, 1]) {
      del.length = 0;
      for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
        if (!at(i, j)) continue;
        const p2 = at(i, j + 1), p3 = at(i + 1, j + 1), p4 = at(i + 1, j), p5 = at(i + 1, j - 1);
        const p6 = at(i, j - 1), p7 = at(i - 1, j - 1), p8 = at(i - 1, j), p9 = at(i - 1, j + 1);
        const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (n < 2 || n > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let a = 0;
        for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) a++;
        if (a !== 1) continue;
        if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(j * W + i);
      }
      for (const k of del) g[k] = 0;
      if (del.length) changed = true;
    }
  }
}

const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/**
 * Thinned lines still have staircase corners (a pixel with a neighbour above AND to the side),
 * which look like crossings to the tracer. Remove the corner pixel when the line stays connected
 * through the diagonal.
 */
function unstair(g: Uint8Array, W: number, H: number) {
  const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < W && j < H ? g[j * W + i] : 0);
  // [a, b] = the two orthogonal neighbours of the corner; c = the three pixels opposite that must be empty
  const pats: [number[], number[], number[][]][] = [
    [[0, 1], [1, 0], [[0, -1], [-1, 0], [-1, -1]]],
    [[1, 0], [0, -1], [[-1, 0], [0, 1], [-1, 1]]],
    [[0, -1], [-1, 0], [[0, 1], [1, 0], [1, 1]]],
    [[-1, 0], [0, 1], [[1, 0], [0, -1], [1, -1]]],
  ];
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    if (!g[j * W + i]) continue;
    for (const [a, b, c] of pats) {
      if (at(i + a[0], j + a[1]) && at(i + b[0], j + b[1]) && c.every(([dx, dy]) => !at(i + dx, j + dy))) {
        g[j * W + i] = 0;
        break;
      }
    }
  }
}

/**
 * Centre lines of the filled outlines, in mm. `res` = grid cell (mm), `prune` = side spurs
 * shorter than this (mm) are cut.
 */
export function centerlines(contours: P[][], res: number, prune: number): P[][] {
  if (!contours.length) return [];
  const { g, W, H, ox, oy } = rasterize(contours, res);
  thin(g, W, H);
  unstair(g, W, H);
  const nb = (k: number) => {
    const i = k % W, j = (k - i) / W;
    const out: number[] = [];
    for (const [dx, dy] of N8) {
      const q = (j + dy) * W + (i + dx);
      if (i + dx >= 0 && i + dx < W && j + dy >= 0 && j + dy < H && g[q]) out.push(q);
    }
    return out;
  };
  // graph: nodes = pixels that are not plain line pixels (ends, crossings)
  const deg = new Map<number, number>();
  for (let k = 0; k < g.length; k++) if (g[k]) deg.set(k, nb(k).length);
  const isNode = (k: number) => deg.get(k) !== 2;
  type Edge = { a: number; b: number; px: number[]; dead?: boolean };
  const edges: Edge[] = [];
  const used = new Set<string>();
  const key = (p: number, q: number) => (p < q ? `${p}_${q}` : `${q}_${p}`);
  const walk = (start: number, next: number) => {
    const px = [start, next];
    used.add(key(start, next));
    let prev = start, cur = next;
    while (!isNode(cur) && cur !== start) {
      const n = nb(cur).filter((q) => q !== prev && !used.has(key(cur, q)));
      if (!n.length) break;
      used.add(key(cur, n[0]));
      prev = cur;
      cur = n[0];
      px.push(cur);
    }
    edges.push({ a: start, b: cur, px });
  };
  for (const [k] of deg) if (isNode(k)) for (const q of nb(k)) if (!used.has(key(k, q))) walk(k, q);
  // closed loops with no node at all (an O, a ring)
  for (const [k] of deg) {
    const n = nb(k);
    if (n.length === 2 && !used.has(key(k, n[0]))) walk(k, n[0]);
  }
  const P = (k: number): P => [ox + ((k % W) + 0.5) * res, oy + (Math.floor(k / W) + 0.5) * res];
  const len = (e: Edge) => e.px.length * res;
  // merge nodes that sit next to each other (staircase crossings) — treat edges between two nodes
  // of a few pixels as part of the crossing
  // prune short spurs, repeatedly (removing one can make another a spur)
  for (let pass = 0; pass < 4; pass++) {
    const d = new Map<number, number>();
    for (const e of edges) if (!e.dead) { d.set(e.a, (d.get(e.a) ?? 0) + 1); d.set(e.b, (d.get(e.b) ?? 0) + 1); }
    let cut = false;
    for (const e of edges) {
      if (e.dead || e.a === e.b) continue;
      const da = d.get(e.a)!, db = d.get(e.b)!;
      if ((da === 1 && db > 2) || (db === 1 && da > 2)) {
        if (len(e) < prune) { e.dead = true; cut = true; }
      }
    }
    if (!cut) break;
  }
  const live = edges.filter((e) => !e.dead && e.px.length > 1);
  // at every node, pair the edges by the straightest way through, then chain pairs into strokes
  const at = new Map<number, { e: Edge; end: 'a' | 'b' }[]>();
  for (const e of live) {
    for (const end of ['a', 'b'] as const) {
      const n = e[end];
      if (!at.has(n)) at.set(n, []);
      at.get(n)!.push({ e, end });
    }
  }
  const dirOut = (e: Edge, end: 'a' | 'b'): P => {
    const px = end === 'a' ? e.px : [...e.px].reverse();
    const k = Math.min(px.length - 1, Math.max(2, Math.round(prune / res)));
    const p0 = P(px[0]), p1 = P(px[k]);
    const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    return [(p1[0] - p0[0]) / l, (p1[1] - p0[1]) / l];
  };
  const link = new Map<string, { e: Edge; end: 'a' | 'b' }>();
  const id = (e: Edge, end: string) => `${live.indexOf(e)}${end}`;
  for (const [, list] of at) {
    if (list.length < 2) continue;
    const free = [...list];
    while (free.length >= 2) {
      let best = -Infinity, bi = 0, bj = 1;
      for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
        if (free[i].e === free[j].e) continue;
        const u = dirOut(free[i].e, free[i].end), v = dirOut(free[j].e, free[j].end);
        const s = -(u[0] * v[0] + u[1] * v[1]); // most opposite = straight through
        if (s > best) { best = s; bi = i; bj = j; }
      }
      if (best < -0.2) break; // a sharp turn: don't join, let the strokes end here
      link.set(id(free[bi].e, free[bi].end), free[bj]);
      link.set(id(free[bj].e, free[bj].end), free[bi]);
      free.splice(bj, 1);
      free.splice(bi, 1);
    }
  }
  const done = new Set<Edge>();
  const lines: P[][] = [];
  const follow = (e: Edge, from: 'a' | 'b') => {
    const pts: number[] = [];
    let cur: { e: Edge; end: 'a' | 'b' } | undefined = { e, end: from };
    while (cur && !done.has(cur.e)) {
      done.add(cur.e);
      const px: number[] = cur.end === 'a' ? cur.e.px : [...cur.e.px].reverse();
      pts.push(...(pts.length ? px.slice(1) : px));
      const other: 'a' | 'b' = cur.end === 'a' ? 'b' : 'a';
      cur = link.get(id(cur.e, other));
    }
    return pts;
  };
  // start from free ends first, then whatever is left (loops)
  for (const e of live) for (const end of ['a', 'b'] as const) if (!done.has(e) && !link.has(id(e, end))) {
    const px = follow(e, end);
    if (px.length > 1) lines.push(px.map(P));
  }
  for (const e of live) if (!done.has(e)) lines.push(follow(e, 'a').map(P));
  return lines.map((l) => smooth(l, 3)).filter((l) => l.length > 2);
}

/** Moving-average smoothing that keeps the ends; closed lines (end at start) stay closed. */
function smooth(l: P[], passes: number): P[] {
  let a = l;
  const closed = l.length > 3 && Math.hypot(l[0][0] - l[l.length - 1][0], l[0][1] - l[l.length - 1][1]) < 1e-6;
  for (let p = 0; p < passes; p++) {
    const b: P[] = a.map((q) => [q[0], q[1]]);
    for (let i = 0; i < a.length; i++) {
      if (!closed && (i < 2 || i > a.length - 3)) continue;
      let sx = 0, sy = 0, n = 0;
      for (let d = -2; d <= 2; d++) {
        const k = closed ? (i + d + a.length - 1) % (a.length - 1) : i + d;
        sx += a[k][0]; sy += a[k][1]; n++;
      }
      b[i] = [sx / n, sy / n];
    }
    if (closed) b[b.length - 1] = b[0];
    a = b;
  }
  return a;
}

/** Points every `step` mm along a line, with their distance from the start. */
export function resample(l: P[], step: number): { p: P[]; s: number[] } {
  const p: P[] = [l[0]];
  const s: number[] = [0];
  let acc = 0, since = 0;
  for (let i = 1; i < l.length; i++) {
    const d = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
    acc += d;
    since += d;
    if (since >= step || i === l.length - 1) {
      p.push(l[i]);
      s.push(acc);
      since = 0;
    }
  }
  return { p, s };
}
