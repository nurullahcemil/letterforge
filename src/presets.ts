/** Each style's label, description and starting design (text, font, settings). */
import type { Params, Style } from './geometry';

export interface StylePreset {
  label: string;
  blurb: string;
  text: string;
  font: string;
  patch: Partial<Params>;
}

export const PRESETS: Record<Style, StylePreset> = {
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
    patch: { capHeight: 80, colorA: '#f6f5f1', colorB: '#6f9a3a', tracking: 0 },
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
    patch: { capHeight: 55, colorA: '#2e8b6e', colorB: '#1f6a53', tracking: 0.04 },
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
  flower: {
    label: 'Letter flower',
    blurb: 'Each letter bends into a petal: they meet in the middle and their sides touch, filling a circle. Deep and chunky, as one sculpture. Repeat the word to fill it.',
    text: 'BLOOM',
    font: 'archivo',
    patch: { capHeight: 80, colorA: '#f0642d', tracking: 0, flCount: 12 },
  },
  arrow: {
    label: 'Arrow sign',
    blurb: 'A shaped board (turning arrow, arrow, rectangle or circle) with block letters that cast a solid shadow, in three colours. Put each letter on its own line to stack them.',
    text: 'F\nU\nN',
    font: 'archivo',
    patch: { capHeight: 32, colorA: '#f2b632', colorB: '#b98552', colorC: '#f6efe4', tracking: 0, lineSpacing: 1.25 },
  },
  terrace: {
    label: 'Terrace planter',
    blurb: 'A low organic tray with hills of stepped levels, for succulents and moss. Change the hills, levels and heights, or shuffle for a new shape.',
    text: '',
    font: 'archivo',
    patch: { colorA: '#efece4' },
  },
  concrete: {
    label: 'Concrete letters',
    blurb: 'Molds to cast letters in concrete. Silicone master: print it, pour silicone over, cast in the soft mold. Or print a hard mold with a pocket per letter.',
    text: 'HOME',
    font: 'archivo',
    patch: { capHeight: 90, colorA: '#c9c6bf', tracking: 0.02 },
  },
  lines: {
    label: 'Line letters',
    blurb: 'Each letter in its own square tile, made of thin standing lines: rings that follow the letter, straight lines around it. Great as a wall alphabet.',
    text: 'ABCDE\nFGHIJ',
    font: 'archivo',
    patch: { colorA: '#3a3a3e', colorB: '#3a3a3e', tracking: 0 },
  },
  pins: {
    label: 'Pin art',
    blurb: 'A grid of round pins on a plate, rising and falling in waves, ripples or the shape of your letters. Pins and plate in two colours, with a frame.',
    text: 'HI',
    font: 'archivo',
    patch: { capHeight: 90, colorA: '#f3efe6', colorB: '#26262a', tracking: 0.04, pinText: 'up' },
  },
  trophy: {
    label: 'Trophy',
    blurb: 'An award: stacked words or a badge on top, standing in a wooden base you laser-cut and engrave (or a printed base).',
    text: 'WINNER\n2025',
    font: 'archivo',
    patch: { capHeight: 14, tracking: -0.05, lineSpacing: 1, colorA: '#f26a1b', colorB: '#f6c430' },
  },
  standee: {
    label: 'Word stand',
    blurb: 'Stacked words in one rounded outline with raised letter lines, standing in a slot stand. A small thank-you gift for a desk.',
    text: 'THANK\nYOU',
    font: 'fredoka',
    patch: { capHeight: 16, lineSpacing: 1.02, tracking: 0, colorA: '#e8336d', colorB: '#e8336d', colorC: '#d6b48c' },
  },
  pyramid: {
    label: 'Pyramid tiles',
    blurb: 'Letters cut into a grid of little pyramids and slopes that catch the light. Shuffle for a new pattern.',
    text: 'C',
    font: 'archivo',
    patch: { capHeight: 120, colorA: '#22b357', tracking: 0.02 },
  },
  tile: {
    label: 'Tile mold',
    blurb: 'Eight-point stars and crosses that fit together. Print a silicone master to make a soft mold for plaster, concrete or clay, a hard mold, or clay cutters.',
    text: '',
    font: 'archivo',
    patch: { colorA: '#cdd6dd', colorB: '#e8c9a8' },
  },
  mold: {
    label: 'Candle & mold',
    blurb: 'A candle shape (pleated ball, drop ornament, gem, pillar or tiered tree). Silicone kit: print the master on a base and a box around it, pour silicone, and you have a soft candle mold. Or print a hard mold directly: two-part block, zigzag split or open cup.',
    text: '',
    font: 'archivo',
    patch: { colorA: '#cdd6dd', colorB: '#f2c6a2' },
  },
};

/** A ready-made idea for a style: real words, sized to print on a 256 mm bed (scripts/fit-check.ts). */
export interface Sample {
  name: string;
  text?: string;
  font?: string;
  patch: Partial<Params>;
}

export const SAMPLES: Record<Style, Sample[]> = {
  sign: [
    { name: 'Open sign', text: 'OPEN', font: 'archivo', patch: { capHeight: 45, qrText: '' } },
    { name: 'Wedding table', text: 'Mr & Mrs', font: 'pacifico', patch: { capHeight: 34, qrText: '', tracking: 0 } },
    { name: 'Desk name plate', text: 'ELENA', font: 'oswald', patch: { capHeight: 30, base: 'plate', qrText: '' } },
  ],
  planter: [
    { name: 'Herb pot', text: 'herbs', font: 'fredoka', patch: { capHeight: 62 } },
    { name: 'For Mum', text: 'MUM', font: 'archivo', patch: { capHeight: 60 } },
  ],
  topo: [
    { name: 'Initial K', text: 'K', font: 'archivo', patch: { capHeight: 110 } },
    { name: 'Ampersand', text: '&', font: 'pacifico', patch: { capHeight: 110 } },
    { name: 'Mountain', text: 'M', font: 'archivo', patch: { capHeight: 110, topoMode: 'stack' } },
  ],
  facet: [
    { name: 'HOME', text: 'HOME', font: 'archivo', patch: { capHeight: 50 } },
    { name: 'JOY', text: 'JOY', font: 'archivo', patch: { capHeight: 70 } },
  ],
  keychain: [
    { name: 'Max', text: 'Max', font: 'fredoka', patch: { capHeight: 18 } },
    { name: 'Noah', text: 'Noah', font: 'pacifico', patch: { capHeight: 16 } },
  ],
  duo: [
    { name: 'Happy Birthday', text: 'BIRTHDAY', font: 'fredoka', patch: { topText: 'Happy', capHeight: 36 } },
    { name: 'Home sweet home', text: 'HOME', font: 'archivo', patch: { topText: 'sweet', capHeight: 45 } },
  ],
  stack: [
    { name: 'Good vibes', text: 'GOOD\nVIBES\nONLY', font: 'archivo', patch: { capHeight: 40 } },
    { name: 'Stay wild', text: 'STAY\nWILD', font: 'archivo', patch: { capHeight: 50 } },
  ],
  stepped: [
    { name: 'Letter M', text: 'M', font: 'oswald', patch: { capHeight: 130 } },
    { name: 'Two letters', text: 'OK', font: 'oswald', patch: { capHeight: 90 } },
  ],
  ramp: [
    { name: 'Good morning', text: 'GOOD\nMORNING', font: 'oswald', patch: { capHeight: 30 } },
    { name: 'Hello', text: 'HELLO', font: 'oswald', patch: { capHeight: 40 } },
  ],
  book: [
    { name: 'Poems', text: 'POEMS', font: 'oswald', patch: { capHeight: 20 } },
    { name: 'Journal', text: 'MY\nJOURNAL', font: 'oswald', patch: { capHeight: 16 } },
  ],
  lamp: [
    { name: 'Umbrella tiers', patch: { lampTier: 'cone' } },
    { name: 'Ribbed', patch: { lampTex: 'ribs' } },
    { name: 'Stone', patch: { lampTex: 'stone', lampWall: 1.6 } },
  ],
  flower: [
    { name: 'ALOHA', text: 'ALOHA', font: 'archivo', patch: { flCount: 10 } },
    { name: 'LOVE', text: 'LOVE', font: 'archivo', patch: { flCount: 12 } },
    { name: 'Small (120 mm)', text: 'SUN', font: 'archivo', patch: { flCount: 9, flSize: 120 } },
    { name: 'Wall art: three words', text: 'LOVE HOPE JOY', font: 'archivo', patch: { flLayout: 'row', flCount: 10, flSize: 150, flGap: 20, flDepth: 20, backOn: true, backHoles: 'two' } },
  ],
  arrow: [
    { name: 'Exit', text: 'EXIT', font: 'archivo', patch: { arShape: 'arrow', arDir: 'right', capHeight: 30 } },
    { name: 'Bar sign', text: 'BAR', font: 'archivo', patch: { arShape: 'rect', capHeight: 45 } },
    { name: 'Round badge', text: 'HI', font: 'archivo', patch: { arShape: 'circle', capHeight: 50 } },
  ],
  trophy: [
    { name: 'Winner 2025', text: 'WINNER\n2025', font: 'archivo', patch: {} },
    { name: 'Idea badge', text: 'BIG\nIDEA', font: 'fredoka', patch: { tpShape: 'badge', tpBadge: 'bulb', tpSize: 90, tpDepth: 6, capHeight: 16, colorA: '#f4f1ea', colorB: '#f6c430', tpTitle: 'INNOVATION AWARD', tpSub: 'Digital team', tpYear: '2025' } },
    { name: 'Star of the month', text: 'STAR', font: 'archivo', patch: { tpShape: 'badge', tpBadge: 'circle', tpSize: 80, tpDepth: 6, capHeight: 18, colorA: '#26262a', colorB: '#f6c430', tpTitle: 'STAR OF THE MONTH', tpSub: 'Customer team', tpYear: 'MAY 2025' } },
  ],
  standee: [
    { name: 'Thank you for being you', text: 'THANK\nYOU\nFOR\nBEING\nYOU', font: 'fredoka', patch: { capHeight: 14 } },
    { name: 'Best mum', text: 'BEST\nMUM\nEVER', font: 'archivo', patch: { capHeight: 16, sdLetters: 'solid', colorA: '#f4f1ea', colorB: '#2f9e6b' } },
    { name: 'You got this', text: 'YOU\nGOT\nTHIS', font: 'fredoka', patch: { capHeight: 18, colorA: '#f2b632', colorB: '#f2b632', colorC: '#26262a' } },
  ],
  pyramid: [
    { name: 'OK', text: 'OK', font: 'archivo', patch: { capHeight: 90 } },
    { name: 'Initial A', text: 'A', font: 'archivo', patch: { capHeight: 130, pyRotate: true } },
  ],
  pins: [
    { name: 'Ring of tubes', text: '', patch: { pinMode: 'halo', pinLayout: 'rings', pinHole: 35, pinTip: 'tube', pinText: 'none' } },
    { name: 'Round-top letter', text: 'M', font: 'archivo', patch: { pinMode: 'letters', pinTip: 'round', capHeight: 120, pinPitch: 7, pinD: 6 } },
    { name: 'Ripples', text: '', patch: { pinMode: 'ripple', pinText: 'none' } },
  ],
  lines: [
    { name: 'HELLO', text: 'HELLO', font: 'archivo', patch: {} },
    { name: 'LOVE square', text: 'LO\nVE', font: 'archivo', patch: { lnTile: 70 } },
  ],
  concrete: [
    { name: 'LOVE', text: 'LOVE', font: 'archivo', patch: { capHeight: 80 } },
    { name: 'One big letter', text: 'A', font: 'archivo', patch: { capHeight: 150 } },
    { name: 'Hard molds', text: 'HOME', font: 'archivo', patch: { ccMake: 'mold', ccHoles: true, capHeight: 80 } },
  ],
  terrace: [
    { name: 'One hill', patch: { tgHills: 1, tgTiers: 4, tgW: 160, tgD: 150 } },
    { name: 'Three hills', patch: { tgHills: 3, tgTiers: 3, tgW: 240, tgD: 150, tgSeed: 7 } },
  ],
  tile: [
    { name: 'Hard mold', patch: { tlMake: 'tray' } },
    { name: 'Clay cutters', patch: { tlMake: 'cutter' } },
  ],
  mold: [
    { name: 'Christmas tree', patch: { moldShape: 'tree', moldSides: 8, moldDepth: 0, moldH: 110, moldD: 80 } },
    { name: 'Drop ornament', patch: { moldShape: 'drop', moldSides: 16, moldDepth: 4, moldH: 95, moldD: 70 } },
    { name: 'Pillar candle', patch: { moldShape: 'pillar', moldSides: 12, moldDepth: 3, moldH: 80, moldD: 60 } },
  ],
};
