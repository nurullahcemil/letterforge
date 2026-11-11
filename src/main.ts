import './style.css';
import { FONTS } from './fonts';
import { Viewer } from './viewer';
import { toSTL, to3MF, standOnOpenEnd, toBackingSVG, toBackingDXF } from './export';
import { svgToArtwork, traceImage } from './art';
import type { BuildResult, Params, Part, Style } from './geometry';
import { DEFAULTS } from './defaults';
import { listDesigns, getDesign, putDesign, deleteDesign, newId, exportAll, importAll } from './store';

// ---------- state ----------

const defaults: Params = { ...DEFAULTS };

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
  keychain: {
    label: 'Keychain',
    blurb: 'Name tag with a layered outline and a key-ring hole.',
    text: 'Olivia',
    font: 'pacifico',
    patch: { capHeight: 16, colorA: '#2f6fd6', colorB: '#ffd43b', tracking: 0 },
  },
  duo: {
    label: 'Two-text sign',
    blurb: 'A bold main text with an accent text on top, in two fonts. Drag either text to place it. Prints standing up; add stem holes to use it as a vase.',
    text: 'BIRTHDAY',
    font: 'fredoka',
    patch: { capHeight: 36, colorA: '#9fd4b4', colorB: '#7cc49b', tracking: -0.04, topDx: 0, topDy: 0 },
  },
  stack: {
    label: 'Bold stack',
    blurb: 'Chunky stacked lines with rounded edges, for walls and shelves.',
    text: 'RAISE\nYOUR\nGAME',
    font: 'archivo',
    patch: { capHeight: 45, colorA: '#2fd13a', tracking: -0.05, lineSpacing: 0.8 },
  },
  stepped: {
    label: 'Stepped',
    blurb: 'Letters that step down in sharp tiers, like folded paper. Click a letter to resize, turn or move it.',
    text: 'A',
    font: 'oswald',
    patch: { capHeight: 140, colorA: '#d8232a', colorB: '#f2efe8', tracking: 0.02 },
  },
  ramp: {
    label: 'Ramp relief',
    blurb: 'Letters that rise into slanted wedges off a plate.',
    text: 'ON SUCH\nA FULL SEA',
    font: 'oswald',
    patch: { capHeight: 30, colorA: '#f2c230', colorB: '#f7f5ef', tracking: 0.04, lineSpacing: 1.3, rMax: 10 },
  },
  book: {
    label: 'Book sleeve',
    blurb: 'A slipcase sized to your book, open on the spine side, with raised or ramped letters on the front. Drag the text to place it.',
    text: 'ON SUCH\nA FULL SEA',
    font: 'oswald',
    patch: { capHeight: 16, colorA: '#f2efe8', colorB: '#cdbf98', tracking: 0.03, lineSpacing: 1.35, rMin: 0.4, rMax: 10, rLean: 60, rSpan: 'letter', rDir: 'right', textDx: 0, textDy: 0 },
  },
  lamp: {
    label: 'Lamp',
    blurb: 'A table lamp for an E27 lamp kit (socket, cable, LED bulb): a stacked shade that twists onto a base. Drop the shade on and turn it to lock. Print the shade in a light, translucent colour.',
    text: '',
    font: 'archivo',
    patch: { colorA: '#f3e6cf', colorB: '#d9967a' },
  },
};

type Control =
  | { kind: 'range'; key: keyof Params; label: string; min: number; max: number; step: number; unit?: string; hint?: string }
  | { kind: 'select'; key: keyof Params; label: string; options: [string, string][]; hint?: string }
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
  keychain: [
    { kind: 'range', key: 'kcOutline', label: 'Outline width', min: 1, max: 8, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'kcBase', label: 'Base thickness', min: 1, max: 5, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'kcTier', label: 'Outline step', min: 0, max: 3, step: 0.2, unit: 'mm', hint: 'A second, narrower outline layer. 0 = none.' },
    { kind: 'range', key: 'kcText', label: 'Name height', min: 0.4, max: 4, step: 0.2, unit: 'mm', hint: 'Swap filament where the name starts for two colours.' },
    { kind: 'range', key: 'ringHole', label: 'Ring hole', min: 3, max: 10, step: 0.5, unit: 'mm' },
    { kind: 'range', key: 'ringWall', label: 'Ring wall', min: 1, max: 5, step: 0.25, unit: 'mm' },
  ],
  duo: [
    { kind: 'range', key: 'topCap', label: 'Accent text height', min: 10, max: 150, step: 1, unit: 'mm' },
    { kind: 'range', key: 'topThickness', label: 'Accent text thickness', min: 2, max: 15, step: 0.5, unit: 'mm' },
    { kind: 'range', key: 'vDepth', label: 'Main text depth', min: 6, max: 60, step: 1, unit: 'mm' },
    { kind: 'toggle', key: 'vBar', label: 'Join letters with a base strip' },
    { kind: 'toggle', key: 'vHoles', label: 'Stem holes for flowers' },
    { kind: 'range', key: 'holeD', label: 'Stem hole size', min: 2, max: 12, step: 0.5, unit: 'mm' },
    { kind: 'range', key: 'holeDepth', label: 'Stem hole depth', min: 5, max: 60, step: 1, unit: 'mm' },
    { kind: 'range', key: 'holeWall', label: 'Wall around holes', min: 0.8, max: 4, step: 0.2, unit: 'mm' },
  ],
  stack: [
    { kind: 'range', key: 'stDepth', label: 'Depth', min: 4, max: 60, step: 1, unit: 'mm' },
    { kind: 'range', key: 'stStep', label: 'Depth change per line', min: 0, max: 30, step: 1, unit: 'mm' },
    { kind: 'select', key: 'stMode', label: 'Line depths', options: [['alternate', 'Alternate'], ['cascade', 'Cascade']] },
    { kind: 'range', key: 'stRound', label: 'Edge rounding', min: 0, max: 10, step: 0.5, unit: 'mm' },
    { kind: 'toggle', key: 'stStretch', label: 'Stretch every line to the same width', hint: 'Condenses long lines and widens short ones, like a variable-width font.' },
  ],
  stepped: [
    { kind: 'range', key: 'spSteps', label: 'Steps', min: 1, max: 12, step: 1 },
    { kind: 'range', key: 'spHeight', label: 'Step height', min: 0.6, max: 10, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'spInset', label: 'Step width', min: 0.5, max: 8, step: 0.25, unit: 'mm' },
    { kind: 'select', key: 'spJoin', label: 'Corners', options: [['Miter', 'Sharp'], ['Round', 'Soft']] },
    { kind: 'toggle', key: 'spBase', label: 'Base', hint: 'A plate under the letters that holds them together. It can be a second colour.' },
    { kind: 'select', key: 'spBaseShape', label: 'Base shape', options: [['rect', 'Rectangle'], ['outline', 'Follows the letters']] },
    { kind: 'range', key: 'spBaseT', label: 'Base thickness', min: 1, max: 12, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'spBasePad', label: 'Base margin', min: 1, max: 40, step: 0.5, unit: 'mm' },
  ],
  ramp: [
    { kind: 'range', key: 'rMin', label: 'Low end', min: 0.4, max: 10, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'rMax', label: 'High end', min: 1, max: 60, step: 0.5, unit: 'mm' },
    { kind: 'select', key: 'rDir', label: 'Rises toward', options: [['right', 'Right'], ['left', 'Left'], ['alternate', 'Alternate']] },
    { kind: 'select', key: 'rSpan', label: 'Ramp across', options: [['letter', 'Each letter'], ['line', 'Whole line']] },
    { kind: 'range', key: 'rLean', label: 'Sweep angle', min: 0, max: 70, step: 1, unit: '°', hint: 'Letters slide sideways as they rise. 0 = straight up.' },
    { kind: 'toggle', key: 'lineMode', label: 'Line letters (outline only)', hint: 'Only a thin line around each letter, like the On Such a Full Sea cover. Works with every letter effect.' },
    { kind: 'range', key: 'lineW', label: 'Line width', min: 0.4, max: 6, step: 0.1, unit: 'mm' },
    { kind: 'toggle', key: 'rPlate', label: 'Back plate' },
    { kind: 'range', key: 'rPlateT', label: 'Plate thickness', min: 1, max: 8, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'rPad', label: 'Plate margin', min: 2, max: 40, step: 1, unit: 'mm' },
  ],
  book: [
    { kind: 'range', key: 'bookW', label: 'Book width', min: 60, max: 320, step: 1, unit: 'mm' },
    { kind: 'range', key: 'bookH', label: 'Book height', min: 80, max: 420, step: 1, unit: 'mm' },
    { kind: 'range', key: 'bookT', label: 'Book thickness (spine)', min: 4, max: 120, step: 0.5, unit: 'mm' },
    { kind: 'range', key: 'bookCover', label: 'Front coverage', min: 20, max: 100, step: 1, unit: '%', hint: 'How much of the cover the sleeve hides. 100% = full slipcase.' },
    { kind: 'range', key: 'bookWall', label: 'Wall thickness', min: 1, max: 5, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'bookClear', label: 'Fit clearance', min: 0, max: 4, step: 0.1, unit: 'mm', hint: 'Extra room on each side so the book slides in.' },
    { kind: 'toggle', key: 'bookFit', label: 'Fit text to the front', hint: 'Wraps the text and picks the letter size so it fills the front.' },
    { kind: 'toggle', key: 'bookStretch', label: 'Stretch lines to fill the page', hint: 'Like a variable-width font: each line is condensed or widened to the full width. With "Fit text" on, line breaks are chosen for you; press Enter to force one.' },
    { kind: 'range', key: 'bookMargin', label: 'Margin', min: 0, max: 40, step: 1, unit: 'mm' },
    { kind: 'select', key: 'bookAlign', label: 'Align', options: [['left', 'Left'], ['center', 'Centre']] },
    { kind: 'select', key: 'bookEffect', label: 'Letters', options: [['sweep', 'Swept'], ['ramp', 'Ramps'], ['flat', 'Raised']] },
    { kind: 'toggle', key: 'lineMode', label: 'Line letters (outline only)', hint: 'Only a thin line around each letter, like the On Such a Full Sea cover. Works with every letter effect.' },
    { kind: 'range', key: 'lineW', label: 'Line width', min: 0.4, max: 6, step: 0.1, unit: 'mm' },
    { kind: 'range', key: 'rLean', label: 'Sweep angle', min: 0, max: 70, step: 1, unit: '°', hint: 'How far the letters slide sideways as they rise off the cover.' },
    { kind: 'range', key: 'bookRelief', label: 'Letter height', min: 0.4, max: 8, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'rMin', label: 'Ramp low end', min: 0.4, max: 10, step: 0.2, unit: 'mm' },
    { kind: 'range', key: 'rMax', label: 'Ramp high end', min: 1, max: 40, step: 0.5, unit: 'mm', hint: 'How far the tallest edge stands off the cover.' },
    { kind: 'select', key: 'rDir', label: 'Rises toward', options: [['right', 'Right'], ['left', 'Left'], ['alternate', 'Alternate']] },
    { kind: 'select', key: 'rSpan', label: 'Ramp across', options: [['letter', 'Each letter'], ['line', 'Whole line']] },
    { kind: 'select', key: 'bookOrient', label: 'Print orientation', options: [['standing', 'Standing'], ['lying', 'Lying flat']] },
  ],
  lamp: [],
};

const LAMP_CONTROLS: Control[] = [
  { kind: 'select', key: 'lampShow', label: 'Make', options: [['both', 'Shade and base'], ['shade', 'Shade only'], ['base', 'Base only']] },
  { kind: 'select', key: 'lampView', label: 'Show', options: [['assembled', 'Put together'], ['print', 'As printed']], hint: 'Files are always laid out for printing.' },
  { kind: 'select', key: 'lampTier', label: 'Shade shape', options: [['barrel', 'Round bulges'], ['cone', 'Umbrella tiers']] },
  { kind: 'range', key: 'shTiers', label: 'Tiers', min: 1, max: 6, step: 1 },
  { kind: 'range', key: 'shDia', label: 'Shade size', min: 100, max: 320, step: 1, unit: 'mm', hint: 'Across the corners (the diameter when round).' },
  { kind: 'range', key: 'shTierH', label: 'Tier height', min: 20, max: 120, step: 0.5, unit: 'mm' },
  { kind: 'range', key: 'shShrink', label: 'Smaller each tier', min: 0, max: 35, step: 1, unit: '%' },
  { kind: 'range', key: 'shPuff', label: 'Waist depth', min: 0, max: 100, step: 1, unit: '%', hint: 'How far the shade pulls in between tiers. Slopes never pass 45°, so every layer stays one thin line.' },
  { kind: 'range', key: 'shRim', label: 'Rim height', min: 0, max: 40, step: 0.5, unit: 'mm', hint: 'The upright band at the edge of each tier.' },
  { kind: 'range', key: 'shSlope', label: 'Top slope', min: 25, max: 70, step: 1, unit: '°', hint: 'How steeply each tier rises to the middle. Below about 30° may sag.' },
  { kind: 'range', key: 'shUnder', label: 'Underside angle', min: 15, max: 65, step: 1, unit: '°', hint: 'How far the underside leans out. Above about 60° may sag.' },
  { kind: 'range', key: 'shRound', label: 'Roundness', min: 0, max: 30, step: 0.5, unit: 'mm' },
  { kind: 'range', key: 'shTopHole', label: 'Top vent', min: 0, max: 80, step: 1, unit: 'mm', hint: 'A hole at the very top lets heat out. 0 = closed.' },
  { kind: 'range', key: 'shSides', label: 'Corners', min: 0, max: 8, step: 1, hint: '0 = round. 3 = triangle.' },
  { kind: 'range', key: 'shCorner', label: 'Corner rounding', min: 0, max: 100, step: 1, unit: '%', hint: '100 = round.' },
  { kind: 'range', key: 'shTwist', label: 'Twist per tier', min: -90, max: 90, step: 1, unit: '°' },
  { kind: 'select', key: 'lampTex', label: 'Surface', options: [['basket', 'Basket weave'], ['dots', 'Knurled dots'], ['ribs', 'Ribs'], ['rings', 'Rings'], ['none', 'Smooth']] },
  { kind: 'range', key: 'lampTexSize', label: 'Pattern width', min: 2.5, max: 15, step: 0.5, unit: 'mm', hint: 'Size of one block or dot, going around.' },
  { kind: 'range', key: 'lampTexH', label: 'Pattern height', min: 1.5, max: 15, step: 0.5, unit: 'mm', hint: 'Size of one block or dot, going up.' },
  { kind: 'range', key: 'lampTexDepth', label: 'Pattern depth', min: 0.2, max: 3, step: 0.1, unit: 'mm' },
  { kind: 'range', key: 'lampWall', label: 'Wall thickness', min: 0.3, max: 3, step: 0.01, unit: 'mm', hint: 'Match your slicer\'s line width for clean walls: 0.42 = one line with a 0.4 mm nozzle, 0.84 = two lines. In-between sizes add messy gap fill.' },
  { kind: 'range', key: 'hubSpokes', label: 'Spokes', min: 2, max: 8, step: 1 },
  { kind: 'range', key: 'baseH', label: 'Base height', min: 50, max: 250, step: 0.5, unit: 'mm', hint: 'Body only; the neck adds to it.' },
  { kind: 'range', key: 'baseD', label: 'Base width', min: 80, max: 200, step: 0.5, unit: 'mm' },
  { kind: 'range', key: 'baseTaper', label: 'Base top width', min: 50, max: 120, step: 1, unit: '%' },
  { kind: 'range', key: 'baseRound', label: 'Base shoulder', min: 0, max: 50, step: 1, unit: 'mm' },
  { kind: 'range', key: 'neckH', label: 'Neck height', min: 18, max: 60, step: 0.5, unit: 'mm', hint: 'The socket sits on top of the neck.' },
  { kind: 'range', key: 'baseFeet', label: 'Feet', min: 0, max: 12, step: 1, hint: '0 = flat bottom. The cable leaves through a gap.' },
  { kind: 'toggle', key: 'baseTex', label: 'Pattern on the base' },
  { kind: 'range', key: 'socketD', label: 'Socket hole', min: 20, max: 60, step: 0.5, unit: 'mm', hint: 'E27 with a threaded ring: about 41 mm. E27 without thread: 38 mm. Measure yours.' },
  { kind: 'range', key: 'jointD', label: 'Joint size', min: 50, max: 90, step: 0.5, unit: 'mm', hint: 'Neck width where the shade twists on. Keep the same on lamps you want to swap shades between.' },
  { kind: 'range', key: 'jointFit', label: 'Joint fit', min: 0.15, max: 1, step: 0.05, unit: 'mm', hint: 'Gap in the twist lock. Bigger = looser.' },
];
STYLE_CONTROLS.lamp = LAMP_CONTROLS;

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
let lastBacking: BuildResult['backing'];
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
  const def = FONTS.find((f) => f.key === key) ?? (key.startsWith('gf:') ? googleFont(key) : undefined);
  const url = customFonts.get(key) ?? def!.url;
  // a variable family may only have its weight file: try the alternative when the first is missing
  const get = async (u: string, alt?: string) => {
    let r = await fetch(u);
    if (!r.ok && alt) r = await fetch(alt);
    return r;
  };
  const [buf, ext] = await Promise.all([
    get(url, (def as GFont | undefined)?.alt).then((r) => {
      if (!r.ok) throw new Error(`Could not download the font (${r.status}).`);
      return r.arrayBuffer();
    }),
    def?.extUrl
      ? get(def.extUrl, (def as GFont).extAlt).then((r) => (r.ok ? r.arrayBuffer() : undefined)).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  worker.postMessage({ type: 'font', key, buffer: buf, ext }, ext ? [buf, ext] : [buf]);
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
(window as any).__letterforge = { viewer, params, rebuild: () => { refreshUI(); schedule(true); } };
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
    const topFontKey = params.style === 'duo' ? params.topFont : undefined;
    if (topFontKey) await ensureFont(topFontKey);
    const myId = ++latestBuild;
    const res = await call({ type: 'build', fontKey, topFontKey, params: { ...params } });
    if (res.type === 'error') {
      showWarnings([`Something went wrong: ${res.message}`]);
    } else if (myId === latestBuild) {
      lastParts = res.parts;
      lastLetters = res.letters ?? [];
      lastBacking = res.backing;
      (window as any).__letterforge.shaper = res.shaper;
      const ax: Axis[] = params.style === 'lamp' ? [] : (res.axes ?? []);
      if (JSON.stringify(ax) !== JSON.stringify(fontAxesNow)) {
        fontAxesNow = ax;
        renderAxes();
      }
      const bn = $('#backing-note');
      bn.hidden = !params.backOn;
      if (params.backOn) {
        bn.textContent = lastBacking
          ? `Board ${fmt(lastBacking.size[0])} × ${fmt(lastBacking.size[1])} mm. Red lines are cuts, blue lines are the letter guide.`
          : 'Nothing to back yet.';
      }
      ($('#dl-backing') as HTMLButtonElement).disabled = !lastBacking;
      ($('#dl-backing-dxf') as HTMLButtonElement).disabled = !lastBacking;
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
      $('#drag-hint').hidden = !printable.some((p: Part) => p.drag);
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
  num.addEventListener('change', () => set(Math.min(c.max * 4, Math.max(c.min < 0 ? c.min * 4 : 0, parseFloat(num.value))), num));
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
        if (String(c.key).startsWith('back')) renderBacking();
        else if (String(c.key).startsWith('art')) renderArt();
        else renderStyleControls();
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
      if (c.key === 'rPlate' || c.key === 'vHoles' || c.key === 'bookFit' || c.key === 'bookStretch' || c.key === 'lineMode' || c.key === 'spBase' || c.key === 'shSides' || c.key === 'lampTex' || c.key === 'lampShow' || c.key === 'lampTier' || c.key === 'backOn') { renderBacking(); renderStyleControls(); renderGeneral(); syncColors(); }
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
  if (params.style === 'stepped' && !params.spBase) list = list.filter((c) => !['spBaseShape', 'spBaseT', 'spBasePad'].includes(c.key));
  if (params.style === 'ramp' && !params.rPlate) list = list.filter((c) => c.key !== 'rPlateT' && c.key !== 'rPad');
  if (params.style === 'duo' && !params.vHoles) list = list.filter((c) => !['holeD', 'holeDepth', 'holeWall'].includes(c.key));
  if (params.style === 'book') {
    const rampKeys = ['rMin', 'rMax', 'rDir', 'rSpan', 'rLean'];
    list = list.filter((c) => {
      if (c.key === 'bookAlign' && params.bookStretch) return false;
      if (params.bookEffect === 'flat') return !rampKeys.includes(c.key);
      if (c.key === 'bookRelief') return false;
      if (c.key === 'rLean') return params.bookEffect === 'sweep';
      return true;
    });
  }
  if (!params.lineMode) list = list.filter((c) => c.key !== 'lineW');
  if (params.style === 'lamp') {
    const shadeKeys = ['shTiers', 'shDia', 'shTierH', 'shShrink', 'shPuff', 'shRim', 'shSlope', 'shUnder', 'shRound', 'shTopHole', 'shSides', 'shCorner', 'shTwist', 'hubSpokes', 'lampTier'];
    const baseKeys = ['baseH', 'baseD', 'baseTaper', 'baseRound', 'neckH', 'baseFeet', 'baseTex', 'socketD'];
    const coneOnly = ['shRim', 'shSlope', 'shUnder', 'shRound', 'shTopHole'];
    list = list.filter((c) => {
      if (params.lampShow === 'base' && shadeKeys.includes(c.key)) return false;
      if (params.lampShow === 'shade' && baseKeys.includes(c.key)) return false;
      if (Math.round(params.shSides) < 3 && c.key === 'shCorner') return false;
      if (params.lampTier === 'barrel' && coneOnly.includes(c.key)) return false;
      if (params.lampTier === 'cone' && c.key === 'shTierH') return false;
      if (params.lampShow !== 'both' && c.key === 'lampView') return false;
      if (params.lampTex === 'none' && ['lampTexSize', 'lampTexH', 'lampTexDepth', 'baseTex'].includes(c.key)) return false;
      if (params.lampTex === 'ribs' && c.key === 'lampTexH') return false;
      if (params.lampTex === 'rings' && c.key === 'lampTexSize') return false;
      return true;
    });
  }
  // the lamp has no text, so its text and size sections go away
  const isLamp = params.style === 'lamp';
  $('#text-section').hidden = isLamp;
  $('#size-section').hidden = isLamp;
  list.forEach((c) => host.appendChild(controlEl(c)));
  $('#style-title').textContent = PRESETS[params.style].label + ' settings';
}

// ---------- per-letter settings, opened by clicking a letter on the canvas ----------

/** Letter positions from the last build (model x/y), for picking. */
let lastLetters: { i: number; x: number; y: number }[] = [];
/** Selected letter (index among the text's non-space characters), or null. */
let selLetter: number | null = null;
const pop = document.createElement('div');
pop.className = 'letter-pop';
pop.hidden = true;
$('.stage').appendChild(pop);

const lettersOf = () => Array.from(params.text).filter((ch) => ch.trim() !== '');

function setLetter(indices: number[], patch: { w?: number; dx?: number; dy?: number; rot?: number } | null) {
  // never mutate: DEFAULTS shares these objects
  const W = { ...params.letterW };
  const M = { ...params.letterMove };
  for (const i of indices) {
    const k = String(i);
    if (patch === null) {
      delete W[k];
      delete M[k];
      continue;
    }
    if (patch.w !== undefined) {
      if (Math.abs(patch.w - 1) < 1e-3) delete W[k];
      else W[k] = patch.w;
    }
    const m = { ...M[k], ...(patch.dx !== undefined ? { dx: patch.dx } : {}), ...(patch.dy !== undefined ? { dy: patch.dy } : {}), ...(patch.rot !== undefined ? { rot: patch.rot } : {}) };
    if (!m.dx && !m.dy && !m.rot) delete M[k];
    else M[k] = m;
  }
  params.letterW = W;
  params.letterMove = M;
}

function closeLetter() {
  selLetter = null;
  pop.hidden = true;
  viewer.highlight(null);
}

function openLetter(i: number, clientX: number, clientY: number) {
  selLetter = i;
  viewer.highlight(`letter:${i}`);
  renderLetterPop();
  const stage = $('.stage').getBoundingClientRect();
  pop.hidden = false;
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  let x = clientX - stage.left + 18;
  let y = clientY - stage.top - h / 2;
  if (x + w > stage.width - 12) x = clientX - stage.left - w - 18;
  x = Math.max(12, Math.min(stage.width - w - 12, x));
  y = Math.max(12, Math.min(stage.height - h - 80, y));
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
}

function renderLetterPop() {
  if (selLetter === null) return;
  const i = selLetter;
  const ch = lettersOf()[i] ?? '';
  const w = params.letterW[String(i)] ?? 1;
  const m = params.letterMove[String(i)] ?? {};
  const fill = (params.style === 'book' && params.bookStretch) || (params.style === 'stack' && params.stStretch);
  const canDrag = params.style === 'stepped';
  const same = lettersOf().filter((c) => c === ch).length;
  const row = (key: string, label: string, min: number, max: number, step: number, val: number, unit: string) =>
    `<label class="lp-row"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${fmtVal(val, unit)}</output></label>`;
  pop.innerHTML = `
    <div class="lp-head"><b class="lp-glyph">${escapeHtml(ch)}</b><span>Letter ${i + 1}</span><button type="button" class="lp-x" aria-label="Close">×</button></div>
    ${row('w', 'Width', 0.3, 4, 0.05, w, '×')}
    <small class="lp-note">${fill ? 'The other letters on this line squeeze or stretch so the line still fills the width.' : 'Wider or narrower, like a variable font’s width axis.'}</small>
    ${row('rot', 'Rotate', -180, 180, 1, m.rot ?? 0, '°')}
    ${row('dx', 'Move ←→', -100, 100, 0.5, m.dx ?? 0, 'mm')}
    ${row('dy', 'Move ↓↑', -100, 100, 0.5, m.dy ?? 0, 'mm')}
    ${canDrag ? '<small class="lp-note">Or drag the letter on the canvas.</small>' : ''}
    <div class="lp-actions">
      ${same > 1 ? `<button type="button" data-act="same">Width to every “${escapeHtml(ch)}”</button>` : ''}
      <button type="button" data-act="reset">Reset</button>
    </div>`;
  pop.querySelector('.lp-x')!.addEventListener('click', closeLetter);
  pop.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      const k = inp.dataset.k as 'w' | 'rot' | 'dx' | 'dy';
      setLetter([i], { [k]: v });
      inp.nextElementSibling!.textContent = fmtVal(v, k === 'w' ? '×' : k === 'rot' ? '°' : 'mm');
      schedule();
    }),
  );
  pop.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.act === 'reset') setLetter([i], null);
      else {
        const idx: number[] = [];
        lettersOf().forEach((c, n) => c === ch && idx.push(n));
        setLetter(idx, { w: params.letterW[String(i)] ?? 1 });
      }
      renderLetterPop();
      schedule();
    }),
  );
}

const fmtVal = (v: number, unit: string) => (unit === '×' ? v.toFixed(2) + '×' : unit === '°' ? Math.round(v) + '°' : v.toFixed(1) + ' mm');

viewer.onPick = (pt, cx, cy) => {
  if (!pt || !lastLetters.length) return closeLetter();
  let best = lastLetters[0];
  let bd = Infinity;
  for (const l of lastLetters) {
    const d = Math.hypot(l.x - pt.x, l.y - pt.y);
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  openLetter(best.i, cx, cy);
};

/** Drop settings for letters that no longer exist after the text changed. */
function pruneLetters() {
  const n = lettersOf().length;
  const gone = [...new Set([...Object.keys(params.letterW), ...Object.keys(params.letterMove)])].map(Number).filter((k) => k >= n);
  if (gone.length) setLetter(gone, null);
  if (selLetter !== null && selLetter >= n) closeLetter();
}

function renderGeneral() {
  const host = $('#general-controls');
  host.innerHTML = '';
  const book = params.style === 'book';
  const controls: Control[] = [];
  if (!(book && params.bookFit)) {
    controls.push({ kind: 'range', key: 'capHeight', label: 'Letter height', min: book ? 3 : 10, max: 400, step: book ? 0.5 : 1, unit: 'mm', hint: 'Height of a capital letter.' });
  }
  controls.push({ kind: 'range', key: 'tracking', label: 'Letter spacing', min: -0.1, max: 0.4, step: 0.01 });
  if (book || params.text.includes('\n')) controls.push({ kind: 'range', key: 'lineSpacing', label: 'Line spacing', min: 0.9, max: 2.5, step: 0.05 });
  controls.forEach((c) => host.appendChild(controlEl(c)));
}

const BACKING_CONTROLS: Control[] = [
  { kind: 'select', key: 'backShape', label: 'Shape', options: [['outline', 'Follows the letters'], ['rect', 'Rectangle']] },
  { kind: 'range', key: 'backMargin', label: 'Margin around the letters', min: 0, max: 80, step: 1, unit: 'mm' },
  { kind: 'range', key: 'backRound', label: 'Corner rounding', min: 0, max: 60, step: 1, unit: 'mm' },
  { kind: 'select', key: 'backHoles', label: 'Hanging holes', options: [['none', 'None'], ['two', '2 at the top'], ['four', '4 corners']] },
  { kind: 'range', key: 'backHoleD', label: 'Hole size', min: 2, max: 12, step: 0.5, unit: 'mm', hint: 'Kept clear of the letters so a screw or nail can reach it.' },
  { kind: 'range', key: 'backT', label: 'Board thickness', min: 1, max: 20, step: 0.5, unit: 'mm', hint: 'For the 3D preview only; the laser file is the outline.' },
  { kind: 'toggle', key: 'backGuide', label: 'Mark where the letters go', hint: 'Adds the letter outlines in blue, to engrave or score as a gluing guide.' },
  { kind: 'range', key: 'backKerf', label: 'Laser kerf', min: 0, max: 0.5, step: 0.01, unit: 'mm', hint: 'How much the laser burns away (often 0.1–0.2 mm). The cut line moves out by half, so the board comes out at true size.' },
];

function renderBacking() {
  const sec = $('#backing-section');
  sec.hidden = params.style === 'lamp' || params.style === 'book';
  const host = $('#backing-controls');
  host.innerHTML = '';
  host.appendChild(controlEl({ kind: 'toggle', key: 'backOn', label: 'Make a laser-cut backing', hint: 'A wooden board behind the letters, cut on a laser cutter. Shown under the model in 3D.' }));
  if (params.backOn) BACKING_CONTROLS.filter((c) => c.key !== 'backHoleD' || params.backHoles !== 'none').forEach((c) => host.appendChild(controlEl(c)));
  $('#dl-backing').hidden = !params.backOn;
  $('#dl-backing-dxf').hidden = !params.backOn;
  if (!params.backOn) $('#backing-note').hidden = true;
}

// ---------- artwork (SVG or traced picture), joined with the text ----------
/** The picture behind a traced artwork, kept on this page so the threshold can be changed. */
let artSource: { name: string; blob: Blob } | undefined;
let traceTimer = 0;

const ART_CONTROLS: Control[] = [
  { kind: 'select', key: 'artPlace', label: 'Place it', options: [['left', 'Left'], ['right', 'Right'], ['above', 'Above'], ['below', 'Below'], ['center', 'On the text']] },
  { kind: 'range', key: 'artSize', label: 'Artwork height', min: 5, max: 400, step: 1, unit: 'mm' },
  { kind: 'range', key: 'artGap', label: 'Space to the text', min: -20, max: 80, step: 0.5, unit: 'mm', hint: 'Below 0 it overlaps the text and joins it.' },
  { kind: 'range', key: 'artX', label: 'Move right', min: -200, max: 200, step: 0.5, unit: 'mm' },
  { kind: 'range', key: 'artY', label: 'Move up', min: -200, max: 200, step: 0.5, unit: 'mm' },
  { kind: 'range', key: 'artRot', label: 'Rotate', min: -180, max: 180, step: 1, unit: '°' },
];
const TRACE_CONTROLS: Control[] = [
  { kind: 'range', key: 'artThreshold', label: 'Picture threshold', min: 1, max: 254, step: 1, hint: 'Higher takes in lighter parts of the picture.' },
  { kind: 'toggle', key: 'artInvert', label: 'Swap shape and background', hint: 'For a light drawing on a dark background.' },
];

function renderArt() {
  const host = $('#art-controls');
  host.innerHTML = '';
  if (!params.art) return;
  const head = document.createElement('div');
  head.className = 'art-head';
  head.innerHTML = `<b title="${escapeHtml(params.art.name)}">${escapeHtml(params.art.name)}</b><button type="button">Remove</button>`;
  head.querySelector('button')!.addEventListener('click', () => {
    params.art = undefined;
    artSource = undefined;
    renderArt();
    schedule(true);
  });
  host.appendChild(head);
  ART_CONTROLS.filter((c) => c.key !== 'artGap' || params.artPlace !== 'center').forEach((c) => host.appendChild(controlEl(c)));
  if (artSource?.name === params.art.name) {
    for (const c of TRACE_CONTROLS) {
      const el = controlEl(c);
      // a new threshold means tracing the picture again (a moment later, while the slider moves)
      el.addEventListener('input', () => queueTrace());
      el.addEventListener('change', () => queueTrace());
      host.appendChild(el);
    }
  }
}

function queueTrace() {
  clearTimeout(traceTimer);
  traceTimer = window.setTimeout(async () => {
    if (!artSource) return;
    try {
      const a = await traceImage(artSource.blob, artSource.name, params.artThreshold ?? 128, !!params.artInvert);
      params.art = a;
      schedule(true);
    } catch (err) {
      showWarnings([String((err as Error).message ?? err)]);
    }
  }, 250);
}

$('#art-upload').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    setBusy(true);
    if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') {
      params.art = svgToArtwork(await file.text(), file.name);
      artSource = undefined;
    } else {
      artSource = { name: file.name, blob: file };
      params.art = await traceImage(file, file.name, params.artThreshold ?? 128, !!params.artInvert);
    }
    // start at about the height of the text
    params.artSize = Math.round(Math.max(10, params.capHeight * 1.2));
    params.artX = 0;
    params.artY = 0;
    params.artRot = 0;
    renderArt();
    schedule(true);
  } catch (err) {
    showWarnings([String((err as Error).message ?? err)]);
  } finally {
    setBusy(false);
  }
});

function renderPrinter() {
  const host = $('#printer-controls');
  host.innerHTML = '';
  host.appendChild(controlEl({ kind: 'range', key: 'bedSize', label: 'Print bed size', min: 120, max: 500, step: 1, unit: 'mm' }));
  host.appendChild(controlEl({ kind: 'toggle', key: 'splitBed', label: 'Split large parts to fit the bed' }));
}

// ---------- variable font sliders (shown when the chosen font has variation axes) ----------
type Axis = { tag: string; min: number; max: number; def: number };
let fontAxesNow: Axis[] = [];
const AXIS_NAMES: Record<string, string> = { wght: 'Weight', wdth: 'Width', opsz: 'Optical size', slnt: 'Slant', ital: 'Italic', GRAD: 'Grade', CASL: 'Casual', MONO: 'Monospace', SOFT: 'Softness', WONK: 'Wonky' };

function renderAxes() {
  const host = $('#font-axes');
  host.innerHTML = '';
  host.hidden = !fontAxesNow.length;
  if (!fontAxesNow.length) return;
  const cur = params.fontVar?.key === fontKey ? params.fontVar.axes : {};
  // weight and width first; skip axes that do nothing visible for a print (e.g. hidden ones)
  const order = (t: string) => ['wght', 'wdth', 'opsz', 'slnt'].indexOf(t) + 1 || 9;
  for (const a of [...fontAxesNow].sort((x, y) => order(x.tag) - order(y.tag)).slice(0, 5)) {
    const step = a.max - a.min > 20 ? 1 : 0.1;
    const v = Math.min(a.max, Math.max(a.min, cur[a.tag] ?? a.def));
    const row = document.createElement('label');
    row.className = 'row range';
    row.innerHTML = `<span class="lbl">${AXIS_NAMES[a.tag] ?? a.tag}</span><span class="num"><input type="number" min="${a.min}" max="${a.max}" step="${step}" value="${v}"></span><input type="range" min="${a.min}" max="${a.max}" step="${step}" value="${v}">`;
    const [num, rng] = row.querySelectorAll('input');
    const set = (x: number) => {
      if (!Number.isFinite(x)) return;
      x = Math.min(a.max, Math.max(a.min, x));
      num.value = String(x);
      rng.value = String(x);
      const axes = { ...(params.fontVar?.key === fontKey ? params.fontVar.axes : {}), [a.tag]: x };
      params.fontVar = { key: fontKey, axes };
      schedule();
    };
    rng.addEventListener('input', () => set(Number(rng.value)));
    num.addEventListener('change', () => set(Number(num.value)));
    host.appendChild(row);
  }
  const note = document.createElement('small');
  note.className = 'note';
  note.textContent = 'This is a variable font: pick any weight in between, not just Regular or Bold.';
  host.appendChild(note);
}

function renderFonts() {
  renderAxes();
  const host = $('#fonts');
  const all = [...FONTS.map((f) => ({ key: f.key, label: f.label, css: f.css })), ...[...googleFonts.values()], ...[...customFonts.keys()].map((k) => ({ key: k, label: k.replace(/^custom:/, ''), css: 'custom-' + k }))];
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
        <b>${PRESETS[s].label}</b></button>`,
    )
    .join('');
  $('#style-blurb').textContent = PRESETS[params.style].blurb;
  host.querySelectorAll<HTMLButtonElement>('button.style').forEach((b) =>
    b.addEventListener('click', () => selectStyle(b.dataset.s as Style)),
  );
}

function applyPreset(s: Style) {
  params.style = s;
  const pr = PRESETS[s];
  Object.assign(params, pr.patch);
  if (!textTouched) params.text = pr.text;
  if (!fontTouched) fontKey = pr.font;
}

function selectStyle(s: Style) {
  if (s === params.style) return;
  applyPreset(s);
  refreshUI();
  schedule(true);
}

/** Re-render every control from the current params. */
function refreshUI() {
  ($('#text') as HTMLTextAreaElement).value = params.text;
  syncText2();
  syncColors();
  renderStyles();
  renderFonts();
  renderGeneral();
  renderStyleControls();
  renderBacking();
  renderArt();
  renderPrinter();
  updateSaveState();
}

function syncColors() {
  ($('#colorA') as HTMLInputElement).value = params.colorA;
  ($('#colorB') as HTMLInputElement).value = params.colorB;
  const labels: Record<Style, [string, string]> = {
    sign: ['Letters', 'QR / plaque'],
    planter: ['Shell', 'Moss preview'],
    topo: ['Top layer', 'Deepest layer'],
    facet: ['Paper', '—'],
    keychain: ['Base', 'Name'],
    duo: ['Main text', 'Accent text'],
    book: ['Case', 'Letters'],
    stack: ['Colour', '—'],
    stepped: ['Letters', 'Base'],
    ramp: ['Plate', 'Letters'],
    lamp: ['Shade', 'Base'],
  };
  const [a, b] = labels[params.style];
  $('#colorA-label').textContent = a;
  $('#colorB-label').textContent = b;
  $('#colorB-wrap').style.display = ['facet', 'stack'].includes(params.style) || (params.style === 'stepped' && !params.spBase) ? 'none' : '';
}

const ICONS: Record<Style, string> = {
  lamp: `<svg viewBox="0 0 48 32"><path d="M24 2c-6 4-12 7-14 10 3 1 6 0 8 0-5 3-10 6-12 9 6 1 12 0 18 0s12 1 18 0c-2-3-7-6-12-9 2 0 5 1 8 0-2-3-8-6-14-10z" fill="currentColor" opacity=".35" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M19 22h10l1 8H18z" fill="currentColor"/></svg>`,
  keychain: `<svg viewBox="0 0 48 32"><path d="M9 8h30a8 8 0 0 1 0 16H9a8 8 0 0 1 0-16z" fill="currentColor" opacity=".3"/><circle cx="9" cy="16" r="2.6" fill="var(--bg)"/><path d="M17 21c2-7 4-10 6-10s1 5-1 7m5 3c1-4 3-7 5-7 1 0 1 3-1 5m4 2c1-3 2-5 4-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  duo: `<svg viewBox="0 0 48 32"><path d="M4 18h40v10H4z" fill="currentColor" opacity=".4"/><path d="M8 17c3-9 6-12 8-10s-2 7-4 9m8 1c2-6 4-9 6-8 2 2-1 6-3 8m7 0c2-5 5-8 7-7 1 2-1 5-3 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M38 5l3 3-3 3M41 8h-6" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".7"/></svg>`,
  book: `<svg viewBox="0 0 48 32"><rect x="6" y="3" width="16" height="26" rx="1" fill="currentColor" opacity=".3"/><rect x="18" y="2" width="24" height="28" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M22 9h6l10 2v2l-10-1h-6zM22 18h4l12 2v2l-12-1h-4z" fill="currentColor"/></svg>`,
  stack: `<svg viewBox="0 0 48 32"><rect x="5" y="3" width="38" height="8" rx="2.5" fill="currentColor"/><rect x="8" y="12" width="32" height="8" rx="2.5" fill="currentColor" opacity=".6"/><rect x="6" y="21" width="36" height="8" rx="2.5" fill="currentColor"/></svg>`,
  stepped: `<svg viewBox="0 0 48 32"><path d="M10 29L22 3h4l12 26" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 29L24 8l10 21M18 29l6-13 6 13" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".6"/><path d="M17 21h14" stroke="currentColor" stroke-width="2"/></svg>`,
  ramp: `<svg viewBox="0 0 48 32"><rect x="3" y="3" width="42" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".5"/><path d="M8 9h8M8 9v14M20 9h4l14 3v2l-14-1h-4zM20 19h4l14 3v2l-14-1h-4z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
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
  pruneLetters();
  if (selLetter !== null) renderLetterPop();
  schedule(true);
});

for (const id of ['colorA', 'colorB'] as const) {
  const el = $(`#${id}`) as HTMLInputElement;
  el.addEventListener('input', () => {
    params[id] = el.value;
    schedule();
  });
}

/** Uploaded font bytes, kept so saved designs can carry their fonts. */
const customFontData = new Map<string, ArrayBuffer>();

async function addCustomFont(key: string, data: ArrayBuffer) {
  customFontData.set(key, data);
  const url = URL.createObjectURL(new Blob([data]));
  customFonts.set(key, url);
  sentFonts.delete(key);
  try {
    const ff = new FontFace('custom-' + key, data);
    await ff.load();
    document.fonts.add(ff);
  } catch {
    /* preview only */
  }
}

// ---------- Google Fonts (through the Fontsource CDN, which serves WOFF files we can read) ----------

interface GFont { key: string; label: string; css: string; url: string; extUrl?: string; alt?: string; extAlt?: string }
interface GFMeta { id: string; family: string; weights: number[]; styles: string[]; subsets: string[]; category: string; variable?: boolean }
const googleFonts = new Map<string, GFont>();
let gfCatalog: GFMeta[] | null = null;
const GF_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';

/** Font definition from a key like "gf:poppins:700"; the key alone is enough to restore it. */
function googleFont(key: string, meta?: GFMeta): GFont {
  const known = googleFonts.get(key);
  if (known) return known;
  const [, id, w] = key.split(':');
  meta ??= gfCatalog?.find((m) => m.id === id);
  const family = meta?.family ?? id.replace(/(^|-)(\w)/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase());
  const main = meta && !meta.subsets.includes('latin') ? meta.subsets[0] : 'latin';
  const ext = !meta || meta.subsets.includes('latin-ext');
  // "gf:<id>:var" = the variable version (one WOFF2 file with every weight; "standard" also holds
  // width etc. when the family has more axes, otherwise only the weight file exists)
  const g: GFont =
    w === 'var'
      ? {
          key,
          label: `${family} (variable)`,
          css: `gf-${id}-var`,
          url: `${GF_CDN}/${id}:vf@latest/${main}-standard-normal.woff2`,
          alt: `${GF_CDN}/${id}:vf@latest/${main}-wght-normal.woff2`,
          extUrl: ext ? `${GF_CDN}/${id}:vf@latest/latin-ext-standard-normal.woff2` : undefined,
          extAlt: ext ? `${GF_CDN}/${id}:vf@latest/latin-ext-wght-normal.woff2` : undefined,
        }
      : {
          key,
          label: `${family}${w !== '400' ? ' ' + w : ''}`,
          css: `gf-${id}-${w}`,
          url: `${GF_CDN}/${id}@latest/${main}-${w}-normal.woff`,
          extUrl: ext ? `${GF_CDN}/${id}@latest/latin-ext-${w}-normal.woff` : undefined,
        };
  googleFonts.set(key, g);
  new FontFace(g.css, `url(${g.url})`)
    .load()
    .catch(() => (g.alt ? new FontFace(g.css, `url(${g.alt})`).load() : Promise.reject()))
    .then((f) => document.fonts.add(f))
    .catch(() => {});
  return g;
}

const gfSearch = $('#gf-search') as HTMLInputElement;
const gfWeight = $('#gf-weight') as HTMLSelectElement;
const gfNote = $('#gf-note');

async function loadCatalog(): Promise<GFMeta[]> {
  if (gfCatalog) return gfCatalog;
  gfNote.textContent = 'Loading the Google Fonts list…';
  try {
    const r = await fetch('https://api.fontsource.org/v1/fonts?type=google');
    if (!r.ok) throw new Error(String(r.status));
    const all = (await r.json()) as GFMeta[];
    gfCatalog = all.filter((f) => f.styles.includes('normal')).sort((a, b) => a.family.localeCompare(b.family));
    gfNote.textContent = `${gfCatalog.length.toLocaleString()} Google Fonts. Tap one to use it, or search by name.`;
    renderGfGrid();
  } catch {
    gfNote.textContent = 'Could not reach Google Fonts. Check your connection and try again.';
    gfCatalog = null;
    return [];
  }
  return gfCatalog;
}

/** The family picked by typing its full name, or by tapping it in the grid. */
let gfPicked: GFMeta | undefined;
function pickedFamily(): GFMeta | undefined {
  const v = gfSearch.value.trim().toLowerCase();
  return gfCatalog?.find((f) => f.family.toLowerCase() === v) ?? gfPicked;
}

/** Fill the weight list for a family (and enable Use). */
function showWeights(f: GFMeta | undefined) {
  gfWeight.disabled = !f;
  ($('#gf-use') as HTMLButtonElement).disabled = !f;
  if (!f) {
    gfWeight.innerHTML = '';
    return;
  }
  const ws = [...f.weights].sort((a, b) => a - b);
  const best = bestWeight(f);
  const names: Record<number, string> = { 100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' };
  // variable families: one file with every weight, set with the Weight slider under the fonts
  gfWeight.innerHTML =
    (f.variable ? '<option value="var" selected>Any weight (variable)</option>' : '') +
    ws.map((w) => `<option value="${w}" ${!f.variable && w === best ? 'selected' : ''}>${names[w] ?? w}</option>`).join('');
  gfNote.textContent = f.subsets.includes('latin-ext')
    ? `${f.family}. Change the weight and press Use to switch.`
    : `${f.family}. No extended Latin, so letters such as ğ ş ı may be missing.`;
}

gfSearch.addEventListener('focus', () => void loadCatalog());
gfSearch.addEventListener('input', () => {
  gfPicked = undefined;
  renderGfGrid();
  showWeights(pickedFamily());
});

// ----- browsable grid: each font's name drawn in that font, loaded only when it scrolls into view -----
const GF_POPULAR = ['Poppins', 'Montserrat', 'Bebas Neue', 'Anton', 'Lobster', 'Oswald', 'Playfair Display', 'Josefin Sans', 'Raleway', 'Abril Fatface', 'Bangers', 'Permanent Marker', 'Righteous', 'Russo One', 'Alfa Slab One', 'Luckiest Guy', 'Titan One', 'Lilita One', 'Fjalla One', 'Rubik', 'Nunito', 'Inter', 'Lato', 'Roboto', 'Open Sans', 'Caveat', 'Satisfy', 'Great Vibes', 'Kaushan Script', 'Cinzel', 'DM Serif Display', 'Space Grotesk', 'Barlow Condensed', 'Teko', 'Staatliches', 'Chewy', 'Black Ops One', 'Passion One', 'Comfortaa', 'Baloo 2', 'Quicksand', 'Merriweather', 'Archivo Black', 'Bungee', 'Fredoka', 'Pacifico', 'Dancing Script'];
const GF_CATS: [string, string][] = [['', 'All'], ['sans-serif', 'Sans'], ['serif', 'Serif'], ['display', 'Display'], ['handwriting', 'Handwriting'], ['monospace', 'Mono']];
let gfCat = '';
let gfVar = false; // show only variable fonts (any weight, one file)
let gfShown: GFMeta[] = [];
let gfCount = 0;
const gfGrid = $('#gf-grid');
const gfLoaded = new Set<string>();
/** Weight used for the preview and as the starting choice: bold reads best as a 3D print. */
function bestWeight(f: GFMeta): number {
  return [...f.weights].sort((a, b) => a - b).reduce((a, b) => (Math.abs(b - 700) < Math.abs(a - 700) ? b : a), f.weights[0] ?? 400);
}
const gfPreview = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      gfPreview.unobserve(el);
      if (el.classList.contains('gf-more')) {
        addGfCards(60);
        continue;
      }
      const f = gfCatalog?.find((m) => m.id === el.dataset.id);
      if (!f) continue;
      const css = `gfp-${f.id}`;
      if (gfLoaded.has(css)) {
        el.classList.add('ready');
        continue;
      }
      gfLoaded.add(css);
      const sub = f.subsets.includes('latin') ? 'latin' : f.subsets[0];
      new FontFace(css, `url(${GF_CDN}/${f.id}@latest/${sub}-${bestWeight(f)}-normal.woff)`)
        .load()
        .then((ff) => {
          document.fonts.add(ff);
          gfGrid.querySelectorAll(`[data-id="${f.id}"]`).forEach((c) => c.classList.add('ready'));
        })
        .catch(() => {});
    }
  },
  { root: gfGrid, rootMargin: '120px' },
);

function renderGfCats() {
  const host = $('#gf-cats');
  host.innerHTML =
    GF_CATS.map(([v, l]) => `<button type="button" data-c="${v}" class="${v === gfCat ? 'on' : ''}">${l}</button>`).join('') +
    `<button type="button" data-var="1" class="gf-var ${gfVar ? 'on' : ''}" aria-pressed="${gfVar}" title="Fonts that come in every weight">Variable</button>`;
  host.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.var) gfVar = !gfVar;
      else gfCat = b.dataset.c!;
      renderGfCats();
      void loadCatalog().then(renderGfGrid);
    }),
  );
}

function renderGfGrid() {
  if (!gfCatalog) return;
  const q = gfSearch.value.trim().toLowerCase();
  let list = gfCatalog.filter((f) => (!gfCat || f.category === gfCat) && (!gfVar || f.variable) && (!q || f.family.toLowerCase().includes(q)));
  if (q) {
    // names that start with the search come first
    list = [...list.filter((f) => f.family.toLowerCase().startsWith(q)), ...list.filter((f) => !f.family.toLowerCase().startsWith(q))];
  } else {
    const rank = new Map(GF_POPULAR.map((n, i) => [n, i]));
    list = [...list.filter((f) => rank.has(f.family)).sort((a, b) => rank.get(a.family)! - rank.get(b.family)!), ...list.filter((f) => !rank.has(f.family))];
  }
  gfShown = list;
  gfCount = 0;
  const typed = gfCatalog.some((f) => f.family.toLowerCase() === q);
  if (!typed) gfNote.textContent = `${list.length.toLocaleString()} ${gfVar ? 'variable ' : ''}Google Font${list.length === 1 ? '' : 's'}${q ? (list.length === 1 ? ' matches' : ' match') : ''}. Tap one to use it, or search by name.`;
  gfGrid.innerHTML = '';
  gfGrid.scrollTop = 0;
  if (!list.length) {
    gfGrid.innerHTML = `<small class="note">No Google Font matches “${escapeHtml(gfSearch.value.trim())}”.</small>`;
    return;
  }
  addGfCards(40);
}

function addGfCards(n: number) {
  gfGrid.querySelector('.gf-more')?.remove();
  const usedId = fontKey.startsWith('gf:') ? fontKey.split(':')[1] : '';
  const frag = document.createDocumentFragment();
  for (const f of gfShown.slice(gfCount, gfCount + n)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gf-card' + (f.id === usedId ? ' on' : '') + (gfLoaded.has(`gfp-${f.id}`) ? ' ready' : '');
    b.dataset.id = f.id;
    b.title = f.family;
    b.innerHTML = `<span style="font-family:'gfp-${f.id}', var(--font-ui, sans-serif)">${escapeHtml(f.family)}</span><small>${escapeHtml(GF_CATS.find(([v]) => v === f.category)?.[1] ?? f.category)}${f.variable ? ' · Variable' : ''}</small>`;
    b.addEventListener('click', () => {
      gfPicked = f;
      showWeights(f);
      void useGoogleFont(true);
    });
    frag.appendChild(b);
    gfPreview.observe(b);
  }
  gfCount += n;
  if (gfCount < gfShown.length) {
    const more = document.createElement('div');
    more.className = 'gf-more';
    frag.appendChild(more);
    gfPreview.observe(more);
  }
  gfGrid.appendChild(frag);
}
renderGfCats();
// the list is small to fetch; load it once the page has settled so the grid is ready to browse
setTimeout(() => void loadCatalog(), 1500);

async function useGoogleFont(keepSearch = false) {
  const f = pickedFamily();
  if (!f) return;
  const key = `gf:${f.id}:${gfWeight.value}`;
  googleFont(key, f);
  // a variable font starts bold (reads best as a print); the Weight slider changes it
  if (gfWeight.value === 'var' && params.fontVar?.key !== key) params.fontVar = { key, axes: { wght: 700 } };
  rememberGoogleFont(key);
  sentFonts.delete(key);
  fontKey = key;
  fontTouched = true;
  if (!keepSearch && gfSearch.value) {
    gfSearch.value = '';
    gfSearch.dispatchEvent(new Event('input'));
  }
  gfGrid.querySelectorAll<HTMLElement>('.gf-card').forEach((c) => c.classList.toggle('on', c.dataset.id === f.id));
  syncText2();
  renderFonts();
  schedule(true);
}
$('#gf-use').addEventListener('click', () => void useGoogleFont());
gfSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    void useGoogleFont();
  }
});

/** Recently used Google Fonts stay in the font grid on this device. */
function rememberGoogleFont(key: string) {
  try {
    const list = JSON.parse(localStorage.getItem('lf-gfonts') ?? '[]') as string[];
    localStorage.setItem('lf-gfonts', JSON.stringify([key, ...list.filter((k) => k !== key)].slice(0, 12)));
  } catch {
    /* storage may be off */
  }
}
try {
  for (const k of (JSON.parse(localStorage.getItem('lf-gfonts') ?? '[]') as string[]).reverse()) googleFont(k);
} catch {
  /* ignore */
}

$('#font-upload').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const key = 'custom:' + file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
  await addCustomFont(key, await file.arrayBuffer());
  fontKey = key;
  fontTouched = true;
  syncText2();
  renderFonts();
  schedule(true);
});

$('#fit').addEventListener('click', () => viewer.fit());

/** The preview shows the book sleeve front-up; the file is turned to print standing. */
function forExport<T extends { positions: Float32Array }>(meshes: T[]): T[] {
  if (params.style === 'lamp') {
    return meshes.map((m) => {
      const pm = m as unknown as Part;
      if (pm.printMesh) return { ...m, positions: pm.printMesh.positions, indices: pm.printMesh.indices };
      if (!pm.printOffset) return m;
      const [dx, dy, dz] = pm.printOffset;
      const q = new Float32Array(m.positions.length);
      for (let i = 0; i < q.length; i += 3) {
        q[i] = m.positions[i] + dx;
        q[i + 1] = m.positions[i + 1] + dy;
        q[i + 2] = m.positions[i + 2] + dz;
      }
      return { ...m, positions: q };
    });
  }
  return params.style === 'book' && params.bookOrient === 'standing' ? standOnOpenEnd(meshes) : meshes;
}

function baseName() {
  if (params.style === 'lamp') return 'lamp';
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

/** The lamp preview is built lighter; downloads rebuild it at full detail first. */
async function fullDetailParts(): Promise<Part[]> {
  if (params.style !== 'lamp') return lastParts;
  const res = await call({ type: 'build', fontKey, params: { ...params, lampFine: true } });
  return res.type === 'result' ? res.parts : lastParts;
}

$('#dl-3mf').addEventListener('click', async () => {
  setBusy(true);
  const parts = await fullDetailParts();
  setBusy(false);
  const printable = parts.filter((p) => !p.previewOnly);
  if (!printable.length) return;
  download(to3MF(forExport(printable), params.style === 'lamp' ? 'Lamp' : params.text.trim() || 'Letterforge', params.style === 'lamp'), baseName() + '.3mf');
});

$('#dl-backing').addEventListener('click', () => {
  if (!lastBacking) return;
  download(toBackingSVG(lastBacking, params.text.trim() || 'Letterforge'), baseName() + '-backing.svg');
});
$('#dl-backing-dxf').addEventListener('click', async () => {
  if (!lastBacking) return;
  download(await toBackingDXF(lastBacking), baseName() + '-backing.dxf');
});

$('#dl-stl').addEventListener('click', async () => {
  // One STL with everything. STL can't store colour; use the 3MF for two colours.
  setBusy(true);
  await fullDetailParts();
  const res = await call({ type: 'merged', byColor: false });
  setBusy(false);
  if (res.type !== 'merged') return;
  type M = { color: string; positions: Float32Array; indices: Uint32Array };
  const mesh = (res.meshes as M[])[0];
  if (mesh?.indices.length) download(toSTL(forExport([mesh])[0]), baseName() + '.stl');
});

// ---------- accent text (two-text sign) ----------

const text2El = $('#text2') as HTMLInputElement;
const font2El = $('#font2') as HTMLSelectElement;

function syncText2() {
  const on = params.style === 'duo';
  $('#text2-wrap').hidden = !on;
  $('#text-label').hidden = !on;
  text2El.value = params.topText;
  const opts = [...FONTS.map((f) => [f.key, f.label.replace(' (script)', '')]), ...[...googleFonts.values()].map((g) => [g.key, g.label]), ...[...customFonts.keys()].map((k) => [k, k.replace(/^custom:/, '')])];
  font2El.innerHTML = opts.map(([k, l]) => `<option value="${escapeHtml(k)}" ${k === params.topFont ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
}
text2El.addEventListener('input', () => {
  params.topText = text2El.value;
  schedule();
});
font2El.addEventListener('change', () => {
  params.topFont = font2El.value;
  schedule();
});

// ---------- drag to move text ----------

viewer.onDragEnd = (key, a, b) => {
  if (key === 'top') {
    params.topDx += a;
    params.topDy += b;
  } else if (key === 'main') {
    // moving the main text = moving the accent the other way
    params.topDx -= a;
    params.topDy -= b;
  } else if (key === 'text') {
    params.textDx += a;
    params.textDy += b;
  } else if (key.startsWith('letter:')) {
    const i = +key.slice(7);
    const m = params.letterMove[String(i)] ?? {};
    setLetter([i], { dx: (m.dx ?? 0) + a, dy: (m.dy ?? 0) + b });
    if (selLetter === i) renderLetterPop();
  }
  schedule();
};

// Load font previews for the picker.
for (const f of FONTS) {
  const ff = new FontFace(f.css, `url(${f.url})`);
  ff.load().then((x) => document.fonts.add(x)).catch(() => {});
}

// ---------- saving, home page, routing ----------

let currentId: string | null = null;
let currentCreated = 0;
let lastSaved = '';
const nameEl = $('#design-name') as HTMLInputElement;
const stateKey = () => JSON.stringify({ params, fontKey, name: nameEl.value });
const isDirty = () => stateKey() !== lastSaved;

function updateSaveState() {
  const el = $('#save-state');
  const btn = $('#save') as HTMLButtonElement;
  if (!currentId) {
    el.textContent = 'Not saved yet';
    btn.textContent = 'Save';
    btn.classList.add('attn');
  } else if (isDirty()) {
    el.textContent = 'Unsaved changes';
    btn.textContent = 'Save';
    btn.classList.add('attn');
  } else {
    el.textContent = 'All changes saved';
    btn.textContent = 'Saved';
    btn.classList.remove('attn');
  }
}
nameEl.addEventListener('input', updateSaveState);
document.addEventListener('input', () => setTimeout(updateSaveState, 0), true);
document.addEventListener('click', () => setTimeout(updateSaveState, 0), true);

/** Downscale the viewer's picture into a small JPEG for the gallery. */
function makeThumb(): Promise<string> {
  return new Promise((resolve) => {
    const src = new Image();
    src.onload = () => {
      const w = 480;
      const h = Math.round((src.height / src.width) * w);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ebe7dd';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(src, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    src.onerror = () => resolve('');
    src.src = viewer.snapshotFitted();
  });
}

async function saveDesign() {
  await idle();
  const thumb = await makeThumb();
  const id = currentId ?? newId();
  const usedFonts = [fontKey, params.style === 'duo' ? params.topFont : '']
    .filter((k) => k.startsWith('custom:') && customFontData.has(k))
    .map((k) => ({ key: k, data: customFontData.get(k)! }));
  const now = Date.now();
  const name = nameEl.value.trim() || 'Untitled design';
  nameEl.value = name;
  await putDesign({
    id,
    name,
    params: { ...params },
    fontKey,
    fonts: usedFonts.length ? usedFonts : undefined,
    thumb,
    created: currentId ? currentCreated || now : now,
    updated: now,
  });
  if (!currentId) {
    currentId = id;
    currentCreated = now;
    history.replaceState(null, '', '#/d/' + id);
  }
  lastSaved = stateKey();
  updateSaveState();
}

/** Wait until the current build has finished so the thumbnail matches. */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (building || queued ? setTimeout(check, 50) : resolve());
    check();
  });
}

$('#save').addEventListener('click', () => void saveDesign());
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !$('#editor').hidden) {
    e.preventDefault();
    void saveDesign();
  }
});

function newDesign(style: Style) {
  currentId = null;
  currentCreated = 0;
  textTouched = false;
  fontTouched = false;
  Object.assign(params, DEFAULTS);
  closeLetter();
  applyPreset(style);
  nameEl.value = 'Untitled design';
  lastSaved = '';
  refreshUI();
  schedule(true);
}

async function openDesign(id: string) {
  const d = await getDesign(id);
  if (!d) {
    location.hash = '#/';
    return;
  }
  for (const f of d.fonts ?? []) await addCustomFont(f.key, f.data);
  for (const k of [d.fontKey, d.params.topFont]) if (k?.startsWith('gf:')) googleFont(k);
  currentId = d.id;
  currentCreated = d.created;
  textTouched = true;
  fontTouched = true;
  Object.assign(params, DEFAULTS, d.params);
  closeLetter();
  fontKey = d.fontKey;
  nameEl.value = d.name;
  lastSaved = stateKey();
  refreshUI();
  schedule(true);
}

const STYLE_ORDER = Object.keys(PRESETS) as Style[];

async function renderHome() {
  $('#home-styles').innerHTML = STYLE_ORDER.map(
    (s) => `<a class="start" href="#/new/${s}"><span class="ico" aria-hidden="true">${ICONS[s]}</span><b>${PRESETS[s].label}</b><small>${escapeHtml(PRESETS[s].blurb.split('. ')[0])}</small></a>`,
  ).join('');
  const designs = await listDesigns();
  $('#design-count').textContent = designs.length ? `(${designs.length})` : '';
  const gallery = $('#gallery');
  if (!designs.length) {
    gallery.innerHTML = `<div class="empty"><b>No saved designs yet.</b><span>Pick a style above, then press <b>Save</b> in the editor. Your designs will appear here.</span></div>`;
    return;
  }
  const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  gallery.innerHTML = designs
    .map(
      (d) => `<article class="card" data-id="${d.id}">
        <a class="thumb" href="#/d/${d.id}">${d.thumb ? `<img src="${d.thumb}" alt="" loading="lazy" />` : `<span class="ico">${ICONS[d.params.style] ?? ''}</span>`}</a>
        <div class="meta"><a href="#/d/${d.id}" class="name">${escapeHtml(d.name)}</a><small>${escapeHtml(PRESETS[d.params.style]?.label ?? d.params.style)} · ${fmtDate(d.updated)}</small></div>
        <div class="card-actions"><button type="button" data-act="dup">Duplicate</button><button type="button" data-act="del">Delete</button></div>
      </article>`,
    )
    .join('');
  gallery.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.closest<HTMLElement>('.card')!.dataset.id!;
      if (b.dataset.act === 'dup') {
        const d = await getDesign(id);
        if (d) await putDesign({ ...d, id: newId(), name: d.name + ' copy', created: Date.now(), updated: Date.now() });
        renderHome();
      } else if (b.dataset.confirm) {
        await deleteDesign(id);
        renderHome();
      } else {
        // two-step delete instead of a blocking dialog
        b.dataset.confirm = '1';
        b.textContent = 'Really delete?';
        b.classList.add('danger');
        setTimeout(() => {
          delete b.dataset.confirm;
          b.textContent = 'Delete';
          b.classList.remove('danger');
        }, 3000);
      }
    }),
  );
}

$('#export-btn').addEventListener('click', async () => {
  download(await exportAll(), `letterforge-designs-${new Date().toISOString().slice(0, 10)}.json`);
});
$('#import-btn').addEventListener('click', () => ($('#import-file') as HTMLInputElement).click());
$('#import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const n = await importAll(file);
    await renderHome();
    $('#design-count').textContent += ` · imported ${n}`;
  } catch (err) {
    alert(String((err as Error).message ?? err));
  }
});

let routing = false;
async function route() {
  if (routing) return;
  routing = true;
  try {
    const h = location.hash.replace(/^#/, '');
    const m = h.match(/^\/(new|d)\/([\w-]+)/);
    const showEditor = !!m;
    $('#home').hidden = showEditor;
    $('#editor').hidden = !showEditor;
    document.title = showEditor ? `${nameEl.value} — Letterforge` : 'Letterforge — 3D printable letters';
    if (!m) {
      await renderHome();
    } else if (m[1] === 'new') {
      newDesign((STYLE_ORDER.includes(m[2] as Style) ? m[2] : 'sign') as Style);
    } else if (m[2] !== currentId) {
      await openDesign(m[2]);
    }
  } finally {
    routing = false;
  }
}

let lastHash = location.hash;
window.addEventListener('hashchange', (e) => {
  // leaving the editor with unsaved work
  const leaving = /^#\/(new|d)\//.test(lastHash) && !/^#\/(new|d)\//.test(location.hash);
  if (leaving && isDirty() && !confirm('You have unsaved changes. Leave without saving?')) {
    history.replaceState(null, '', lastHash);
    e.preventDefault();
    return;
  }
  lastHash = location.hash;
  void route();
});
window.addEventListener('beforeunload', (e) => {
  if (!$('#editor').hidden && currentId && isDirty()) e.preventDefault();
});

refreshUI();
void route();
