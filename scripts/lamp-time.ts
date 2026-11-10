// Times a lamp build, including the deferred geometry work (forces every mesh to be computed).
import Module from 'manifold-3d';
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const o = JSON.parse(process.argv[2] ?? '{}');
const t = performance.now();
const { pieces } = buildLamp(wasm, (x: any) => x, { ...DEFAULTS, lampShow: 'shade', ...o } as any, []);
const tris = pieces.map((p) => [p.m, ...(p.extra ?? [])].reduce((a, m) => a + m.numTri(), 0));
console.log(JSON.stringify(o), Math.round(performance.now() - t), 'ms', tris);
