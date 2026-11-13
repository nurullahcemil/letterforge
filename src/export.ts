import { zipSync, strToU8 } from 'fflate';

export interface MeshData {
  name: string;
  color: string;
  positions: Float32Array;
  indices: Uint32Array;
}

export function toSTL(mesh: { positions: Float32Array; indices: Uint32Array }): Blob {
  return new Blob([stlBytes(mesh)], { type: 'model/stl' });
}

function stlBytes(mesh: { positions: Float32Array; indices: Uint32Array }): ArrayBuffer {
  const { positions: p, indices: ix } = mesh;
  const nTri = ix.length / 3;
  const buf = new ArrayBuffer(84 + nTri * 50);
  const dv = new DataView(buf);
  const header = 'Letterforge STL';
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, nTri, true);
  let o = 84;
  for (let t = 0; t < nTri; t++) {
    const a = ix[t * 3] * 3;
    const b = ix[t * 3 + 1] * 3;
    const c = ix[t * 3 + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const vals = [nx, ny, nz, p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]];
    for (const v of vals) {
      dv.setFloat32(o, v, true);
      o += 4;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}

/** One STL per colour, zipped. Select them all in the slicer and load them as one object with several parts. */
export function toSTLZip(meshes: { color: string; positions: Float32Array; indices: Uint32Array }[], base: string): Blob {
  const files: Record<string, Uint8Array> = {};
  meshes.forEach((m, i) => {
    files[`${base}-colour${i + 1}-${m.color.replace('#', '')}.stl`] = new Uint8Array(stlBytes(m));
  });
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' });
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/**
 * 3MF with one mesh object per part, grouped into a single assembly object so
 * slicers (PrusaSlicer, Bambu Studio, Orca, Cura) load it as one model made of
 * parts that each can get their own filament.
 */
/** Bambu/Prusa triangle-paint code for a whole triangle in one filament (1-based). */
function paintCode(filament: number): string {
  if (filament < 3) return (filament << 2).toString(16).toUpperCase();
  return (filament - 3).toString(16).toUpperCase() + 'C';
}

/**
 * `separate`: every part is its own object (e.g. lamp shade and base, printed one at a time),
 * instead of parts of one assembled model. `layout` instead groups parts into objects and puts each
 * object on a build plate (designs bigger than the bed, split into pieces): `groups[k]` lists part
 * indices of object k and `plates[k]` its plate (0-based). Bambu Studio reads the plates from
 * model_settings.config.
 */
export function to3MF(parts: MeshData[], title: string, separate = false, layout?: { groups: number[][]; plates: number[] }): Blob {
  const n = (v: number) => (Math.round(v * 1e4) / 1e4).toString();
  // One colour (and one filament slot) per distinct colour, in order of first use.
  // Written as an m:colorgroup: Bambu Studio 2.x reads only that, not basematerials.
  const palette: string[] = [];
  for (const p of parts) if (!palette.includes(p.color.toLowerCase())) palette.push(p.color.toLowerCase());
  const slot = (p: MeshData) => palette.indexOf(p.color.toLowerCase());
  // which parts make up each printed object
  const groups: number[][] = layout ? layout.groups : separate ? parts.map((_, i) => [i]) : [parts.map((_, i) => i)];
  let objects = '';
  const matId = parts.length + groups.length + 1;
  parts.forEach((part, i) => {
    const id = i + 1;
    const vs: string[] = [];
    for (let j = 0; j < part.positions.length; j += 3) {
      vs.push(`<vertex x="${n(part.positions[j])}" y="${n(part.positions[j + 1])}" z="${n(part.positions[j + 2])}"/>`);
    }
    // Bambu Studio / Orca ignore part settings from other apps but always read their own
    // per-triangle "paint" data, and add the filaments it needs. So every triangle is painted
    // with its part's filament number.
    const paint = paintCode(slot(part) + 1);
    const ts: string[] = [];
    for (let j = 0; j < part.indices.length; j += 3) {
      ts.push(`<triangle v1="${part.indices[j]}" v2="${part.indices[j + 1]}" v3="${part.indices[j + 2]}" paint_color="${paint}"/>`);
    }
    objects += `<object id="${id}" name="${esc(part.name)}" type="model" pid="${matId}" pindex="${slot(part)}"><mesh><vertices>${vs.join('')}</vertices><triangles>${ts.join('')}</triangles></mesh></object>\n`;
  });
  // an object of one part is that part's mesh; an object of several parts is a component object
  const objId = (k: number) => (groups[k].length === 1 ? groups[k][0] + 1 : parts.length + k + 1);
  const groupName = (k: number) => (groups.length === 1 && groups[k].length > 1 ? title : parts[groups[k][0]].name);
  groups.forEach((g, k) => {
    if (g.length > 1) objects += `<object id="${objId(k)}" name="${esc(groupName(k))}" type="model"><components>${g.map((i) => `<component objectid="${i + 1}"/>`).join('')}</components></object>\n`;
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Application">Letterforge</metadata>
<resources>
<m:colorgroup id="${matId}">${palette.map((c) => `<m:color color="${c.toUpperCase()}"/>`).join('')}</m:colorgroup>
${objects}</resources>
<build>${groups.map((_, k) => `<item objectid="${objId(k)}"/>`).join('')}</build>
</model>`;
  // Bambu Studio / Orca Slicer read this file even from other apps: it names every part
  // and gives it a filament slot, so a two-colour model opens with two filaments set.
  const objSettings = groups
    .map(
      (g, k) => `  <object id="${objId(k)}">
    <metadata key="name" value="${esc(groupName(k))}"/>
    <metadata key="extruder" value="${slot(parts[g[0]]) + 1}"/>
${g
  .map(
    (i) => `    <part id="${i + 1}" subtype="normal_part">
      <metadata key="name" value="${esc(parts[i].name)}"/>
      <metadata key="extruder" value="${slot(parts[i]) + 1}"/>
    </part>`,
  )
  .join('\n')}
  </object>`,
    )
    .join('\n');
  const plateSettings = layout
    ? [...new Set(layout.plates)]
        .sort((x, y) => x - y)
        .map(
          (pl) => `  <plate>
    <metadata key="plater_id" value="${pl + 1}"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
${groups
  .map((_, k) => k)
  .filter((k) => layout.plates[k] === pl)
  .map(
    (k) => `    <model_instance>
      <metadata key="object_id" value="${objId(k)}"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>`,
  )
  .join('\n')}
  </plate>`,
        )
        .join('\n')
    : '';
  const settings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
${objSettings}
${plateSettings}
</config>
`;
  const files = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
    ),
    '3D/3dmodel.model': strToU8(model),
    'Metadata/model_settings.config': strToU8(settings),
  };
  return new Blob([zipSync(files, { level: 6 })], { type: 'model/3mf' });
}

/**
 * Rotate meshes so the model's -X end rests on the bed (x,y,z) -> (-z, y, x),
 * then shift everything so it sits at the origin. Used for the book sleeve,
 * which is edited lying down but printed standing on its open end.
 */
export function standOnOpenEnd<T extends { positions: Float32Array }>(meshes: T[]): T[] {
  let minX = Infinity;
  let minZ = Infinity;
  const out = meshes.map((m) => {
    const p = new Float32Array(m.positions.length);
    for (let i = 0; i < p.length; i += 3) {
      p[i] = -m.positions[i + 2];
      p[i + 1] = m.positions[i + 1];
      p[i + 2] = m.positions[i];
      if (p[i] < minX) minX = p[i];
      if (p[i + 2] < minZ) minZ = p[i + 2];
    }
    return { ...m, positions: p };
  });
  for (const m of out) {
    for (let i = 0; i < m.positions.length; i += 3) {
      m.positions[i] -= minX;
      m.positions[i + 2] -= minZ;
    }
  }
  return out;
}

/**
 * Laser-cutter SVG in real millimetres (opens at true size in LightBurn, xTool, Glowforge, Inkscape).
 * Red hairline = cut (board outline and holes); blue hairline = guide (where the letters go, to
 * engrave or score). Y is flipped so the board reads the same way as the model seen from above.
 */
export function toBackingSVG(b: { cut: [number, number][][]; guide: [number, number][][] }, title: string): Blob {
  const all = [...b.cut, ...b.guide].flat();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of b.cut.flat().length ? b.cut.flat() : all) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const pad = 2;
  const w = x1 - x0 + 2 * pad;
  const h = y1 - y0 + 2 * pad;
  const path = (loops: [number, number][][]) =>
    loops.map((q) => 'M' + q.map(([x, y]) => `${(x - x0 + pad).toFixed(3)},${(y1 - y + pad).toFixed(3)}`).join('L') + 'Z').join('');
  const esc = title.replace(/[<>&"]/g, '');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" viewBox="0 0 ${w.toFixed(3)} ${h.toFixed(3)}">
  <title>${esc} – wooden backing</title>
  <g id="guide-engrave" fill="none" stroke="#0000ff" stroke-width="0.1">${b.guide.length ? `<path d="${path(b.guide)}"/>` : ''}</g>
  <g id="cut" fill="none" stroke="#ff0000" stroke-width="0.1"><path d="${path(b.cut)}"/></g>
</svg>
`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

/**
 * Laser-cutter DXF (millimetres) with two layers: CUT (red) = board outline and holes,
 * GUIDE (blue) = where the letters go. Each outline is one closed polyline. Maker.js is loaded only
 * when this is used.
 */
export async function toBackingDXF(b: { cut: [number, number][][]; guide: [number, number][][] }): Promise<Blob> {
  const mod: any = await import('makerjs');
  const mk = mod.default ?? mod;
  const group = (loops: [number, number][][], layer: string) => {
    const models: Record<string, any> = {};
    loops.forEach((q, i) => {
      const m = new mk.models.ConnectTheDots(true, q.map(([x, y]) => [x, y]));
      m.layer = layer;
      models[layer + i] = m;
    });
    return { models, layer };
  };
  const model = {
    units: mk.unitType.Millimeter,
    models: { cut: group(b.cut, 'CUT'), ...(b.guide.length ? { guide: group(b.guide, 'GUIDE') } : {}) },
  };
  const dxf: string = mk.exporter.toDXF(model, {
    units: mk.unitType.Millimeter,
    usePOLYLINE: true,
    layerOptions: { CUT: { color: mk.exporter.colors.red }, GUIDE: { color: mk.exporter.colors.blue } },
  });
  return new Blob([dxf], { type: 'application/dxf' });
}

/**
 * Lay out pieces of a design that is bigger than the bed: parts that overlap in plan stay together
 * (e.g. a QR plate on its sign piece), and each group is packed onto plates of `bed` mm in rows
 * (5 mm from the edges, 6 mm apart). Plates are placed like Bambu Studio lays them out (a grid,
 * 1/5 of a bed apart), so each piece lands on its own plate.
 */
/** `colorPlates`: every colour starts its own plate (e.g. pin art base on plate 1, pins on plate 2). */
export function layoutOnPlates<T extends MeshData>(parts: T[], bed: number, colorPlates = false): { parts: T[]; groups: number[][]; plates: number[] } {
  const box = (p: MeshData) => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.positions.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        b[a] = Math.min(b[a], p.positions[i + a]);
        b[a + 3] = Math.max(b[a + 3], p.positions[i + a]);
      }
    }
    return b;
  };
  const boxes = parts.map(box);
  // group parts whose footprints overlap (union-find)
  const root = parts.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const A = boxes[i], B = boxes[j];
      // only a different-colour part sitting on a piece goes with it (pieces of one colour are
      // separate on purpose: that is how the design was split to fit)
      if (parts[i].color.toLowerCase() === parts[j].color.toLowerCase()) continue;
      const overlap = Math.min(A[3], B[3]) - Math.max(A[0], B[0]) > 0.5 && Math.min(A[4], B[4]) - Math.max(A[1], B[1]) > 0.5;
      if (!overlap) continue;
      const ri = find(i), rj = find(j);
      const m = [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[3], B[3]), Math.max(A[4], B[4])];
      if (ri !== rj && m[2] - m[0] <= bed - 10 && m[3] - m[1] <= bed - 10) root[ri] = rj;
    }
  const byRoot = new Map<number, number[]>();
  parts.forEach((_, i) => byRoot.set(find(i), [...(byRoot.get(find(i)) ?? []), i]));
  const groups = [...byRoot.values()];
  const gbox = groups.map((g) => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const i of g) for (let a = 0; a < 3; a++) {
      b[a] = Math.min(b[a], boxes[i][a]);
      b[a + 3] = Math.max(b[a + 3], boxes[i][a + 3]);
    }
    return b;
  });
  // shelf packing, tallest (in Y) first
  const margin = 5, gap = 6, usable = bed - 2 * margin;
  const gcol = groups.map((g) => (colorPlates ? parts[g[0]].color.toLowerCase() : ''));
  const colors = [...new Set(gcol)];
  const order = groups.map((_, k) => k).sort((a, b) => colors.indexOf(gcol[a]) - colors.indexOf(gcol[b]) || gbox[b][4] - gbox[b][1] - (gbox[a][4] - gbox[a][1]));
  const plates = new Array<number>(groups.length).fill(0);
  const at: [number, number][] = new Array(groups.length);
  let plate = 0, x = 0, y = 0, rowH = 0;
  let lastCol = gcol[order[0]];
  for (const k of order) {
    const w = gbox[k][3] - gbox[k][0], h = gbox[k][4] - gbox[k][1];
    if (gcol[k] !== lastCol) { plate++; x = 0; y = 0; rowH = 0; lastCol = gcol[k]; }
    if (x > 0 && x + w > usable) { x = 0; y += rowH + gap; rowH = 0; }
    if (y > 0 && y + h > usable) { plate++; x = 0; y = 0; rowH = 0; }
    plates[k] = plate;
    at[k] = [x, y];
    x += w + gap;
    rowH = Math.max(rowH, h);
  }
  // plate grid like Bambu Studio: columns = rounded-up square root, 1/5 of a bed between plates
  const count = plate + 1;
  const sq = Math.sqrt(count);
  const cols = sq > Math.round(sq) ? Math.round(sq) + 1 : Math.round(sq);
  const stride = bed * 1.2;
  const out = parts.slice();
  groups.forEach((g, k) => {
    const pl = plates[k];
    const ox = (pl % cols) * stride + margin + at[k][0] - gbox[k][0];
    // rows of pieces go down the plate from its back edge, plates go down in rows too
    const oy = -Math.floor(pl / cols) * stride + (bed - margin) - at[k][1] - gbox[k][4];
    const oz = -gbox[k][2];
    for (const i of g) {
      const src = parts[i].positions;
      const q = new Float32Array(src.length);
      for (let j = 0; j < src.length; j += 3) {
        q[j] = src[j] + ox;
        q[j + 1] = src[j + 1] + oy;
        q[j + 2] = src[j + 2] + oz;
      }
      out[i] = { ...parts[i], positions: q };
    }
  });
  return { parts: out, groups, plates };
}
