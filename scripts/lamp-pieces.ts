// Lists the separate pieces of the shade (should be exactly 1) with their size and height range.
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const m = buildLamp(wasm, (x: any) => x, { ...DEFAULTS, lampShow: 'shade', ...over } as any, []).pieces[0].m;
const ps = m.decompose();
console.log(JSON.stringify(over), 'pieces', ps.length);
for (const q of ps) { const b = q.boundingBox(); console.log(' vol', q.volume().toFixed(2), 'z', b.min[2].toFixed(2), '-', b.max[2].toFixed(2), 'x', b.min[0].toFixed(1), b.max[0].toFixed(1)); }
