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

export function to3MF(parts: MeshData[], title: string): Blob {
  const n = (v: number) => (Math.round(v * 1e4) / 1e4).toString();
  // One material (and one filament slot) per distinct colour, in order of first use.
  const palette: string[] = [];
  for (const p of parts) if (!palette.includes(p.color.toLowerCase())) palette.push(p.color.toLowerCase());
  const slot = (p: MeshData) => palette.indexOf(p.color.toLowerCase());
  let objects = '';
  const baseId = parts.length + 1;
  const matId = baseId + 1;
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
  const components = parts.map((_, i) => `<component objectid="${i + 1}"/>`).join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Application">Letterforge</metadata>
<resources>
<basematerials id="${matId}">${palette.map((c, i) => `<base name="Colour ${i + 1}" displaycolor="${c.toUpperCase()}FF"/>`).join('')}</basematerials>
${objects}<object id="${baseId}" name="${esc(title)}" type="model"><components>${components}</components></object>
</resources>
<build><item objectid="${baseId}"/></build>
</model>`;
  // Bambu Studio / Orca Slicer read this file even from other apps: it names every part
  // and gives it a filament slot, so a two-colour model opens with two filaments set.
  const settings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${baseId}">
    <metadata key="name" value="${esc(title)}"/>
    <metadata key="extruder" value="1"/>
${parts
  .map(
    (p, i) => `    <part id="${i + 1}" subtype="normal_part">
      <metadata key="name" value="${esc(p.name)}"/>
      <metadata key="extruder" value="${slot(p) + 1}"/>
    </part>`,
  )
  .join('\n')}
  </object>
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
