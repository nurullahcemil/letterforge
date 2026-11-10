// Simulate putting the shade on: lower it with the slots over the lugs, then turn it to lock.
// Prints the overlap volume (should be ~0 all the way) and checks the shade is held when locked.
import Module from 'manifold-3d';
const { buildLamp, LAMP_TURN } = await import('../src/lamp');
const { DEFAULTS } = await import('../src/defaults');
const wasm = await Module(); wasm.setup();
const over = JSON.parse(process.argv[2] ?? '{}');
const { pieces, shadeZ } = buildLamp(wasm, (o: any) => o, { ...DEFAULTS, lampTex: 'none', ...over } as any, []);
const shade = pieces.find((p) => p.name === 'Shade')!.m;
const base = pieces.find((p) => p.name === 'Base')!.m;
const hit = (rot: number, z: number) => shade.rotate([0, 0, rot]).translate([0, 0, z]).intersect(base).volume();
const rest = shadeZ - 0.2;
const rows: string[] = [];
for (const z of [rest + 25, rest + 14, rest + 8, rest + 3, rest]) rows.push(`down rot 0 z=${z.toFixed(1)} overlap ${hit(0, z).toFixed(2)}`);
for (const r of [-8, -16, -24, -LAMP_TURN]) rows.push(`turn rot ${r} overlap ${hit(r, rest).toFixed(2)}`);
rows.push(`locked: lift 1 mm → overlap ${hit(-LAMP_TURN, rest + 1).toFixed(2)} (should be > 0: lugs hold it)`);
rows.push(`locked: push down 1 mm → overlap ${hit(-LAMP_TURN, rest - 1).toFixed(2)} (should be > 0)`);
console.log(rows.join('\n'));
