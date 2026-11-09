import './style.css';
import { FONTS } from './fonts';
import { Viewer } from './viewer';
import { toSTL, to3MF } from './export';
import type { Params, Part, Style } from './geometry';

// ---------- state ----------

const defaults: Params = {
  style: 'sign',
  text: 'MENU',
  capHeight: 40,
  tracking: 0.02,
  lineSpacing: 1.25,
  depth: 14,
  base: 'bar',
  baseHeight: 4,
  platePadding: 6,
  letterRelief: 3,
  qrText: 'https://example.com/menu',
  qrRelief: 1,
  wallHeight: 30,
  wall: 1.6,
  floor: 2,
  layers: 6,
  layerThickness: 3,
  step: 3,
  rim: 3.5,
  topoMode: 'bowl',
  openCenter: true,
  wobble: 2.5,
  seed: 7,
  facetWall: 14,
  angle: 45,
  cap: 0,
  splitBed: true,
  bedSize: 256,
  colorA: '#2b2d2f',
  colorB: '#f4f1ea',
};

interface StylePreset {
  label: string;
  blurb: string;
  text: string;
  font: string;
  patch: Partial<Params>;
}

const PRESETS: Record<Style, StylePreset> = {
  sign: {
    label: 'Table sign',
    blurb: 'Standing letters on a bar, with an optional QR tile.',
    text: 'MENU',
    font: 'archivo',
    patch: { capHeight: 40, colorA: '#2b2d2f', colorB: '#f4f1ea', tracking: 0.02 },
  },
  planter: {
    label: 'Planter letters',
    blurb: 'Hollow channel letters to fill with moss or plants.',
    text: 'grow',
    font: 'pacifico',
    patch: { capHeight: 110, colorA: '#f6f5f1', colorB: '#6f9a3a', tracking: 0 },
  },
  topo: {
    label: 'Topographic',
    blurb: 'Stacked contour layers that step into the letter.',
    text: 'B',
    font: 'fredoka',
    patch: { capHeight: 120, colorA: '#eef3d2', colorB: '#c9df3f', tracking: 0.02, wobble: 4 },
  },
  facet: {
    label: 'Faceted',
    blurb: 'Low-poly roof ridges, like folded papercraft.',
    text: 'LOVE',
    font: 'archivo',
    patch: { capHeight: 90, colorA: '#2e8b6e', colorB: '#1f6a53', tracking: 0.04 },
  },
};

type Control =
  | { kind: 'range'; key: keyof Params; label: string; min: number; max: number; step: number; unit?: string; hint?: string }
  | { kind: 'select'; key: keyof Params; label: string; options: [string, string][] }
  | { kind: 'toggle'; key: keyof Params; label: string; hint?: string }
  | { kind: 'text'; key: keyof Params; label: string; placeholder?: string; hint?: string };

const STYLE_CONTROLS: Record<Style, Control[]> = {
  sign: [
    { kind: 'select', key: 'base', label: 'Base', options: [['bar', 'Stand bar'], ['plate', 'Flat plaque'], ['none', 'None']] },
    { kind: 'range', key: 'depth', label: 'Thickness', min: 4, max: 40, step: 1, unit: 'mm', hint: 'How deep the standing letters are.' },
    { kind: 'range', key: 'baseHeight', label: 'Bar / plaque height', min: 1.5, max: 12, step: 0.5, unit: 'mm' },
    { kind: 'range', key: 'platePadding', label: 'Plaque padding', min: 2, max: 30, step: 1, unit: 'mm' },
    { kind: 'range', key: 'letterRelief', label: 'Letter relief', min: 0.6, max: 10, step: 0.2, unit: 'mm', hint: 'Plaque only: how far letters rise.' },
    { kind: 'text', key: 'qrText', label: 'QR code link', placeholder: 'https://… (leave empty for none)' },
    { kind: 'range', key: 'qrRelief', label: 'QR relief', min: 0.4, max: 3, step: 0.2, unit: 'mm', hint: 'Swap filament at this height for a two-colour QR.' },
  ],
  planter: [
    { kind: 'range', key: 'wallHeight', label: 'Depth', min: 8, max: 80, step: 1, unit: 'mm' },
    { kind: 'range', key: 'wall', label: 'Wall thickness', min: 0.8, max: 5, step: 0.1, unit: 'mm' },
    { kind: 'range', key: 'floor', label: 'Floor thickness', min: 0.8, max: 6, step: 0.2, unit: 'mm' },
  ],
  topo: [
    { kind: 'select', key: 'topoMode', label: 'Shape', options: [['bowl', 'Carved in (bowl)'], ['stack', 'Built up (mountain)']] },
    { kind: 'range', key: 'layers', label: 'Layers', min: 2, max: 14, step: 1 },
    { kind: 'range', key: 'layerThickness', label: 'Layer thickness', min: 0.8, max: 8, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'step', label: 'Step inset', min: 0.6, max: 8, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'rim', label: 'Outer rim', min: 1, max: 10, step: 0.5, unit: 'mm' },
    { kind: 'range', key: 'wobble', label: 'Wobble', min: 0, max: 8, step: 0.25, unit: 'mm', hint: 'Organic, flowing contours.' },
    { kind: 'range', key: 'seed', label: 'Variation', min: 1, max: 99, step: 1 },
    { kind: 'toggle', key: 'openCenter', label: 'Open through the bottom' },
  ],
  facet: [
    { kind: 'range', key: 'facetWall', label: 'Side wall height', min: 0, max: 60, step: 1, unit: 'mm' },
    { kind: 'range', key: 'angle', label: 'Facet angle', min: 20, max: 65, step: 1, unit: '°', hint: 'Keep ≤ 50° for support-free printing.' },
    { kind: 'range', key: 'cap', label: 'Flat top', min: 0, max: 30, step: 0.5, unit: 'mm', hint: '0 = sharp ridges. Otherwise caps the roof at this height.' },
  ],
};

const params: Params = { ...defaults };
let fontKey = 'archivo';
let textTouched = false;
let fontTouched = false;
const customFonts = new Map<string, string>();

// ---------- worker ----------

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const sentFonts = new Set<string>();
let reqId = 0;
let latestBuild = 0;
let lastParts: Part[] = [];
const pending = new Map<number, (d: any) => void>();

worker.onmessage = (e) => {
  const d = e.data;
  const cb = pending.get(d.id);
  if (cb) {
    pending.delete(d.id);
    cb(d);
  }
};

async function ensureFont(key: string) {
  if (sentFonts.has(key)) return;
  const url = customFonts.get(key) ?? FONTS.find((f) => f.key === key)!.url;
  const buf = await (await fetch(url)).arrayBuffer();
  worker.postMessage({ type: 'font', key, buffer: buf }, [buf]);
  sentFonts.add(key);
}

function call(msg: any): Promise<any> {
  const id = ++reqId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker.postMessage({ ...msg, id });
  });
}

// ---------- DOM ----------

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const viewer = new Viewer($('#viewport'));
viewer.setBed(params.bedSize);

const statusEl = $('#status');
const dimsEl = $('#dims');
const warnEl = $('#warnings');
const partsEl = $('#parts');

function setBusy(b: boolean) {
  statusEl.classList.toggle('busy', b);
}

let refitNext = true;
let timer = 0;
let building = false;
let queued = false;

function schedule(refit = false) {
  if (refit) refitNext = true;
  clearTimeout(timer);
  timer = window.setTimeout(run, 120);
}

async function run() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  setBusy(true);
  try {
    await ensureFont(fontKey);
    const myId = ++latestBuild;
    const res = await call({ type: 'build', fontKey, params: { ...params } });
    if (res.type === 'error') {
      showWarnings([`Something went wrong: ${res.message}`]);
    } else if (myId === latestBuild) {
      lastParts = res.parts;
      viewer.setBed(params.bedSize);
      viewer.setParts(res.parts, refitNext);
      refitNext = false;
      const [x, y, z] = res.size as number[];
      const printable = res.parts.filter((p: Part) => !p.previewOnly);
      dimsEl.innerHTML = printable.length
        ? `<b>${fmt(x)} × ${fmt(y)} × ${fmt(z)}</b> mm <span>· ${printable.length} part${printable.length > 1 ? 's' : ''} · ${Math.round(res.ms)} ms</span>`
        : '';
      showWarnings(res.warnings);
      renderParts(printable);
    }
  } finally {
    building = false;
    setBusy(false);
    if (queued) {
      queued = false;
      run();
    }
  }
}

const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1));

function showWarnings(w: string[]) {
  warnEl.innerHTML = w.map((s) => `<div class="warn">${escapeHtml(s)}</div>`).join('');
}

function renderParts(parts: Part[]) {
  const groups = new Map<string, { color: string; count: number; name: string }>();
  for (const p of parts) {
    const key = p.color + (p.name.startsWith('Letter') ? 'L' : p.name);
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { color: p.color, count: 1, name: p.name.startsWith('Letter') ? 'Letters' : p.name });
  }
  partsEl.innerHTML = [...groups.values()]
    .map((g) => `<li><i style="background:${g.color}"></i>${escapeHtml(g.name)}${g.count > 1 ? ` <span>×${g.count}</span>` : ''}</li>`)
    .join('');
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

// ---------- controls ----------

function rangeRow(c: Extract<Control, { kind: 'range' }>) {
  const row = document.createElement('label');
  row.className = 'row range';
  const v = params[c.key] as number;
  row.innerHTML = `
    <span class="lbl">${c.label}</span>
    <span class="num"><input type="number" min="${c.min}" max="${c.max}" step="${c.step}" value="${v}">${c.unit ? `<em>${c.unit}</em>` : ''}</span>
    <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${v}">
    ${c.hint ? `<small>${c.hint}</small>` : ''}`;
  const [num, rng] = row.querySelectorAll('input');
  const set = (val: number, from: HTMLInputElement) => {
    if (Number.isNaN(val)) return;
    (params as any)[c.key] = val;
    if (from !== num) num.value = String(val);
    if (from !== rng) rng.value = String(val);
    schedule();
  };
  rng.addEventListener('input', () => set(parseFloat(rng.value), rng));
  num.addEventListener('change', () => set(Math.min(c.max * 4, Math.max(0, parseFloat(num.value))), num));
  return row;
}

function controlEl(c: Control): HTMLElement {
  if (c.kind === 'range') return rangeRow(c);
  if (c.kind === 'select') {
    const row = document.createElement('div');
    row.className = 'row seg';
    row.innerHTML = `<span class="lbl">${c.label}</span><div class="segmented">${c.options
      .map(([v, l]) => `<button type="button" data-v="${v}" class="${params[c.key] === v ? 'on' : ''}">${l}</button>`)
      .join('')}</div>`;
    row.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        (params as any)[c.key] = b.dataset.v;
        row.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        renderStyleControls();
        schedule(true);
      }),
    );
    return row;
  }
  if (c.kind === 'toggle') {
    const row = document.createElement('label');
    row.className = 'row toggle';
    row.innerHTML = `<input type="checkbox" ${params[c.key] ? 'checked' : ''}><span class="sw"></span><span class="lbl">${c.label}</span>${c.hint ? `<small>${c.hint}</small>` : ''}`;
    const cb = row.querySelector('input')!;
    cb.addEventListener('change', () => {
      (params as any)[c.key] = cb.checked;
      schedule();
    });
    return row;
  }
  const row = document.createElement('label');
  row.className = 'row textrow';
  row.innerHTML = `<span class="lbl">${c.label}</span><input type="text" placeholder="${c.placeholder ?? ''}" value="${escapeHtml(String(params[c.key]))}">`;
  const inp = row.querySelector('input')!;
  inp.addEventListener('input', () => {
    (params as any)[c.key] = inp.value;
    schedule();
  });
  return row;
}

function renderStyleControls() {
  const host = $('#style-controls');
  host.innerHTML = '';
  let list = STYLE_CONTROLS[params.style];
  if (params.style === 'sign') {
    list = list.filter((c) => {
      if (params.base === 'plate') return c.key !== 'depth' && c.key !== 'qrRelief';
      if (c.key === 'platePadding' || c.key === 'letterRelief') return false;
      if (params.base === 'none' && c.key === 'baseHeight') return false;
      return true;
    });
  }
  list.forEach((c) => host.appendChild(controlEl(c)));
  $('#style-title').textContent = PRESETS[params.style].label + ' settings';
}

function renderGeneral() {
  const host = $('#general-controls');
  host.innerHTML = '';
  const controls: Control[] = [
    { kind: 'range', key: 'capHeight', label: 'Letter height', min: 10, max: 400, step: 1, unit: 'mm', hint: 'Height of a capital letter.' },
    { kind: 'range', key: 'tracking', label: 'Letter spacing', min: -0.1, max: 0.4, step: 0.01 },
  ];
  if (params.text.includes('\n')) controls.push({ kind: 'range', key: 'lineSpacing', label: 'Line spacing', min: 0.9, max: 2.5, step: 0.05 });
  controls.forEach((c) => host.appendChild(controlEl(c)));
}

function renderPrinter() {
  const host = $('#printer-controls');
  host.innerHTML = '';
  host.appendChild(controlEl({ kind: 'range', key: 'bedSize', label: 'Print bed size', min: 120, max: 500, step: 1, unit: 'mm' }));
  host.appendChild(controlEl({ kind: 'toggle', key: 'splitBed', label: 'Split large parts to fit the bed' }));
}

function renderFonts() {
  const host = $('#fonts');
  const all = [...FONTS.map((f) => ({ key: f.key, label: f.label, css: f.css })), ...[...customFonts.keys()].map((k) => ({ key: k, label: k.replace(/^custom:/, ''), css: 'custom-' + k }))];
  host.innerHTML = all
    .map((f) => `<button type="button" class="font ${f.key === fontKey ? 'on' : ''}" data-k="${f.key}" title="${escapeHtml(f.label)}"><span style="font-family:'${f.css}'">Ag</span><small>${escapeHtml(f.label.replace(' (script)', ''))}</small></button>`)
    .join('');
  host.querySelectorAll<HTMLButtonElement>('button.font').forEach((b) =>
    b.addEventListener('click', () => {
      fontKey = b.dataset.k!;
      fontTouched = true;
      renderFonts();
      schedule(true);
    }),
  );
}

function renderStyles() {
  const host = $('#styles');
  host.innerHTML = (Object.keys(PRESETS) as Style[])
    .map(
      (s) => `<button type="button" class="style ${s === params.style ? 'on' : ''}" data-s="${s}">
        <span class="ico ico-${s}" aria-hidden="true">${ICONS[s]}</span>
        <b>${PRESETS[s].label}</b><small>${PRESETS[s].blurb}</small></button>`,
    )
    .join('');
  host.querySelectorAll<HTMLButtonElement>('button.style').forEach((b) =>
    b.addEventListener('click', () => selectStyle(b.dataset.s as Style)),
  );
}

function selectStyle(s: Style) {
  if (s === params.style) return;
  params.style = s;
  const pr = PRESETS[s];
  Object.assign(params, pr.patch);
  if (!textTouched) {
    params.text = pr.text;
    ($('#text') as HTMLTextAreaElement).value = pr.text;
  }
  if (!fontTouched) fontKey = pr.font;
  syncColors();
  renderStyles();
  renderFonts();
  renderGeneral();
  renderStyleControls();
  schedule(true);
}

function syncColors() {
  ($('#colorA') as HTMLInputElement).value = params.colorA;
  ($('#colorB') as HTMLInputElement).value = params.colorB;
  const labels: Record<Style, [string, string]> = {
    sign: ['Letters', 'QR / plaque'],
    planter: ['Shell', 'Moss preview'],
    topo: ['Top layer', 'Deepest layer'],
    facet: ['Paper', '—'],
  };
  const [a, b] = labels[params.style];
  $('#colorA-label').textContent = a;
  $('#colorB-label').textContent = b;
  $('#colorB-wrap').style.display = params.style === 'facet' ? 'none' : '';
}

const ICONS: Record<Style, string> = {
  sign: `<svg viewBox="0 0 48 32"><path d="M4 8h6v14H4zM12 8h6v14h-6zM20 8h6v14h-6z" fill="currentColor"/><rect x="29" y="8" width="15" height="17" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M32 11h3v3h-3zM38 11h3v3h-3zM32 18h3v3h-3zM37 17h2v2h-2zM39 20h2v2h-2z" fill="currentColor"/><path d="M3 22h42v4H3z" fill="currentColor" opacity=".55"/></svg>`,
  planter: `<svg viewBox="0 0 48 32"><path d="M8 26c-4 0-5-5-1-9 5-5 12-9 15-7 3 2-2 7-6 11-3 3-5 5-8 5z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M10 22c3-3 6-6 9-8" stroke="#6f9a3a" stroke-width="4" stroke-linecap="round"/><path d="M28 24c3-7 8-14 12-13 3 1 0 8-3 12" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M31 21c2-4 4-7 6-8" stroke="#6f9a3a" stroke-width="3.4" stroke-linecap="round"/></svg>`,
  topo: `<svg viewBox="0 0 48 32"><path d="M10 4h16c8 0 11 4 11 8 0 2-1 4-3 5 3 1 5 3 5 6 0 5-4 7-12 7H10z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M14 8h11c5 0 7 2 7 4s-2 4-7 4M14 18h12c5 0 8 1 8 4s-3 4-8 4H14z" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7"/><path d="M18 11h6M18 21h7" stroke="currentColor" stroke-width="1.4" opacity=".45"/></svg>`,
  facet: `<svg viewBox="0 0 48 32"><path d="M6 4h10v18h12v6H6z" fill="currentColor" opacity=".25"/><path d="M6 4l5 5v13l-5 6M16 4l-5 5M28 22l-5 3M28 28l-5-3H11M11 22h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 4h10v18h12v6H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M33 4l9 0 0 24-9 0z" fill="currentColor" opacity=".25"/><path d="M33 4h9v24h-9zM33 4l4.5 5 4.5-5M37.5 9v14M33 28l4.5-5 4.5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};

// ---------- wiring ----------

const textEl = $('#text') as HTMLTextAreaElement;
textEl.value = params.text;
textEl.addEventListener('input', () => {
  params.text = textEl.value;
  textTouched = true;
  renderGeneral();
  schedule(true);
});

for (const id of ['colorA', 'colorB'] as const) {
  const el = $(`#${id}`) as HTMLInputElement;
  el.addEventListener('input', () => {
    params[id] = el.value;
    schedule();
  });
}

$('#font-upload').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const key = 'custom:' + file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
  const url = URL.createObjectURL(file);
  if (/\.woff2$/i.test(file.name)) {
    showWarnings(['WOFF2 fonts are not supported yet. Please upload a TTF, OTF or WOFF file.']);
    return;
  }
  customFonts.set(key, url);
  try {
    const ff = new FontFace('custom-' + key, `url(${url})`);
    await ff.load();
    document.fonts.add(ff);
  } catch {
    /* preview only */
  }
  sentFonts.delete(key);
  fontKey = key;
  fontTouched = true;
  renderFonts();
  schedule(true);
});

$('#fit').addEventListener('click', () => viewer.fit());

function baseName() {
  const t = params.text.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 24) || 'letters';
  return `${t}-${params.style}`;
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

$('#dl-3mf').addEventListener('click', () => {
  const printable = lastParts.filter((p) => !p.previewOnly);
  if (!printable.length) return;
  download(to3MF(printable, params.text.trim() || 'Letterforge'), baseName() + '.3mf');
});

$('#dl-stl').addEventListener('click', async () => {
  setBusy(true);
  const res = await call({ type: 'merged' });
  setBusy(false);
  if (res.type === 'merged' && res.mesh.indices.length) download(toSTL(res.mesh), baseName() + '.stl');
});

// Load font previews for the picker.
for (const f of FONTS) {
  const ff = new FontFace(f.css, `url(${f.url})`);
  ff.load().then((x) => document.fonts.add(x)).catch(() => {});
}

syncColors();
renderStyles();
renderFonts();
renderGeneral();
renderStyleControls();
renderPrinter();
schedule(true);
