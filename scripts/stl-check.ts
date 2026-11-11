// Reads a binary STL, welds identical points and checks it is a valid closed solid (manifold).
import fs from 'node:fs';
import Module from 'manifold-3d';
const wasm = await Module(); wasm.setup();
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f);
  const n = b.readUInt32LE(80);
  const map = new Map<string, number>();
  const pos: number[] = [];
  const tri = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) for (let v = 0; v < 3; v++) {
    const o = 84 + i * 50 + 12 + v * 12;
    const x = b.readFloatLE(o), y = b.readFloatLE(o + 4), z = b.readFloatLE(o + 8);
    const k = `${x},${y},${z}`;
    let id = map.get(k);
    if (id === undefined) { id = pos.length / 3; map.set(k, id); pos.push(x, y, z); }
    tri[i * 3 + v] = id;
  }
  try {
    const m = new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(pos), triVerts: tri }));
    console.log(f.split('/').pop(), 'tris', n, 'status', m.status(), 'volume', (m.volume() / 1000).toFixed(2), 'cm3');
  } catch (e) {
    console.log(f.split('/').pop(), 'tris', n, 'NOT a closed solid:', String(e));
  }
}
