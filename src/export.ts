import { zipSync, strToU8 } from 'fflate';

export interface MeshData {
  name: string;
  color: string;
  positions: Float32Array;
  indices: Uint32Array;
}

export function toSTL(mesh: { positions: Float32Array; indices: Uint32Array }): Blob {
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
  return new Blob([buf], { type: 'model/stl' });
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/**
 * 3MF with one mesh object per part, grouped into a single assembly object so
 * slicers (PrusaSlicer, Bambu Studio, Orca, Cura) load it as one model made of
 * parts that each can get their own filament.
 */
export function to3MF(parts: MeshData[], title: string): Blob {
  const n = (v: number) => (Math.round(v * 1e4) / 1e4).toString();
  let objects = '';
  const colors = parts.map((p) => p.color.toUpperCase() + 'FF');
  const baseId = parts.length + 1;
  parts.forEach((part, i) => {
    const id = i + 1;
    const vs: string[] = [];
    for (let j = 0; j < part.positions.length; j += 3) {
      vs.push(`<vertex x="${n(part.positions[j])}" y="${n(part.positions[j + 1])}" z="${n(part.positions[j + 2])}"/>`);
    }
    const ts: string[] = [];
    for (let j = 0; j < part.indices.length; j += 3) {
      ts.push(`<triangle v1="${part.indices[j]}" v2="${part.indices[j + 1]}" v3="${part.indices[j + 2]}"/>`);
    }
    objects += `<object id="${id}" name="${esc(part.name)}" type="model" pid="${baseId + 1}" pindex="${i}"><mesh><vertices>${vs.join('')}</vertices><triangles>${ts.join('')}</triangles></mesh></object>\n`;
  });
  const components = parts.map((_, i) => `<component objectid="${i + 1}"/>`).join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Application">Letterforge</metadata>
<resources>
<basematerials id="${baseId + 1}">${colors.map((c, i) => `<base name="${esc(parts[i].name)}" displaycolor="#${c.slice(1)}"/>`).join('')}</basematerials>
${objects}<object id="${baseId}" name="${esc(title)}" type="model"><components>${components}</components></object>
</resources>
<build><item objectid="${baseId}"/></build>
</model>`;
  const files = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
    ),
    '3D/3dmodel.model': strToU8(model),
  };
  return new Blob([zipSync(files, { level: 6 })], { type: 'model/3mf' });
}
