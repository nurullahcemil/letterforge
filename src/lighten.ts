/**
 * "Lighter files": remove mesh points that don't change the shape by more than 0.02 mm (a tenth of
 * a print layer) with meshoptimizer, on download only. Flat sides and gentle curves lose most of
 * their triangles; the shape stays a closed solid (edges between parts are locked).
 * meshoptimizer is loaded only when a file is made.
 */
export const LIGHTEN_ERROR = 0.02; // mm

type Mesh = { positions: Float32Array; indices: Uint32Array };

export async function lighten<T extends Mesh>(meshes: T[]): Promise<T[]> {
  const { MeshoptSimplifier: S } = await import('meshoptimizer');
  await S.ready;
  return meshes.map((m) => {
    if (m.indices.length < 300) return m;
    try {
      const [idx] = S.simplify(m.indices, m.positions, 3, 0, LIGHTEN_ERROR, ['ErrorAbsolute', 'LockBorder']);
      if (!idx.length || idx.length >= m.indices.length) return m;
      // keep only the points still used, so the file really gets smaller
      const remap = new Int32Array(m.positions.length / 3).fill(-1);
      const pos: number[] = [];
      const out = new Uint32Array(idx.length);
      for (let i = 0; i < idx.length; i++) {
        const v = idx[i];
        if (remap[v] < 0) {
          remap[v] = pos.length / 3;
          pos.push(m.positions[3 * v], m.positions[3 * v + 1], m.positions[3 * v + 2]);
        }
        out[i] = remap[v];
      }
      return { ...m, positions: new Float32Array(pos), indices: out };
    } catch {
      return m;
    }
  });
}
