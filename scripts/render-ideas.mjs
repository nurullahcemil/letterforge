// Renders a picture of every idea (and each style's starting design) with the real app, into
// public/ideas/<style>-<i>.webp. Run with the dev server up:  node scripts/render-ideas.mjs [port]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const port = process.argv[2] ?? '5179';
const base = `http://localhost:${port}/`;
fs.mkdirSync('public/ideas', { recursive: true });
const src = fs.readFileSync('src/presets.ts', 'utf8');
// style → number of ideas, read from SAMPLES in presets.ts
const block = src.slice(src.indexOf('export const SAMPLES'));
const counts = {};
let cur = null;
for (const line of block.split('\n')) {
  const m = line.match(/^  (\w+): \[/);
  if (m) { cur = m[1]; counts[cur] = 0; continue; }
  if (cur && /^\s+\{ name: /.test(line)) counts[cur]++;
}
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 900, height: 640 } });
pg.on('pageerror', (e) => console.log('page error', e.message));
for (const [style, n] of Object.entries(counts)) {
  for (let i = 0; i < n; i++) {
    await pg.goto(`${base}#/new/${style}/${i}`);
    await pg.reload();
    // wait for a build to land, then for it to stay quiet (lamps take a few seconds)
    await pg.waitForFunction(() => (window).__letterforge?.builds > 0, null, { timeout: 60000 });
    let last = -1;
    for (let k = 0; k < 40; k++) {
      const now = await pg.evaluate(() => (window).__letterforge.builds);
      if (now === last) break;
      last = now;
      await pg.waitForTimeout(900);
    }
    const url = await pg.evaluate(() => (window).__letterforge.thumb());
    fs.writeFileSync(`public/ideas/${style}-${i}.webp`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(style, i, 'ok');
  }
}
await b.close();
