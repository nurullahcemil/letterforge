import Module from 'manifold-3d';
(globalThis as any).self = globalThis;
const { buildLamp } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const w: string[] = [];
const { pieces: ps, shadeZ } = buildLamp(wasm, (o: any) => o, { ...DEFAULTS, ...over } as any, w);
for (const p of ps) {
  for (const e of (p as any).extra ?? []) if (e.status() !== 'NoError') console.log(p.name, 'band status', e.status());
  if ((p as any).extra?.length) console.log(p.name, 'separate bands', (p as any).extra.length, 'band volume', Math.round((p as any).extra.reduce((a: number, e: any) => a + e.volume(), 0) / 1000), 'cm3');
  const b = p.m.boundingBox();
  console.log(p.name, 'status', p.m.status(), 'pieces', p.m.decompose().length, 'genus', p.m.genus(), 'vol', Math.round(p.m.volume()/1000), 'cm3', 'h', Math.round(b.max[2]-b.min[2]), 'w', Math.round(b.max[0]-b.min[0]));
  // slice at z=1.5: hub ring should exist
  if (p.name === 'Shade') { const sl = p.m.slice(1.5); console.log(' slice@1.5 area', Math.round(sl.area()), 'pieces', sl.decompose().length); }
}
console.log(w, 'shadeZ', shadeZ);
