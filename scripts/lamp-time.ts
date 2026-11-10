import Module from 'manifold-3d';

const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const o = JSON.parse(process.argv[2] ?? '{}');
const t = performance.now();
const { pieces } = buildLamp(wasm, (x: any) => x, { ...DEFAULTS, lampShow: 'shade', ...o } as any, []);
console.log(JSON.stringify(o), Math.round(performance.now() - t), 'ms', pieces.map((p) => p.m.numTri()));
