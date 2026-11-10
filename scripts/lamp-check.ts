import Module from 'manifold-3d';
(globalThis as any).self = globalThis;
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const w: string[] = [];
const ps = buildLamp(wasm, (o: any) => o, { ...DEFAULTS, ...over } as any, w);
for (const p of ps) {
  const b = p.m.boundingBox();
  console.log(p.name, 'status', p.m.status(), 'pieces', p.m.decompose().length, 'genus', p.m.genus(), 'vol', Math.round(p.m.volume()/1000), 'cm3', 'h', Math.round(b.max[2]-b.min[2]), 'w', Math.round(b.max[0]-b.min[0]));
  // slice at z=1.5: hub ring should exist
  if (p.name === 'Shade') { const sl = p.m.slice(1.5); console.log(' slice@1.5 area', Math.round(sl.area()), 'pieces', sl.decompose().length); }
}
console.log(w);
