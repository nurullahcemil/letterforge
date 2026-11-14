/**
 * Live word previews for idea cards (home and Idea step), from the user's Flow design: the typed
 * word drawn in the idea's font and colours, with a CSS "extrusion" that hints at each style.
 * This is a quick picture, not the model; the editor builds the real thing.
 */
import type { Style } from './geometry';

function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c.join(',')})`;
}

const extrude = (side: string, d: number) => {
  const a: string[] = [];
  for (let i = 1; i <= d; i++) a.push(`${i * 0.5}px ${i}px 0 ${side}`);
  a.push(`0 ${d + 8}px ${d + 10}px rgba(0,0,0,0.45)`);
  return a.join(', ');
};

/** Inline CSS for the word, sized to fit a box `boxW` px wide. */
export function liveLook(style: Style, word: string, font: string, a: string, b: string, boxW: number): string {
  const len = Math.max(2, [...word].length);
  let fs = Math.min(60, Math.floor(boxW / (len * 0.72)));
  if (style === 'keychain') fs = Math.round(fs * 0.8);
  const d = Math.max(3, Math.round(fs / 9));
  const p = (k: number) => `${Math.round(fs * k)}px`;
  const side = shade(a, 0.6);
  const o: Record<string, string> = {
    'font-family': `'${font}', sans-serif`, 'font-size': `${fs}px`, color: a, 'text-shadow': extrude(side, d),
  };
  switch (style) {
    case 'sign':
    case 'duo':
      o['border-bottom'] = `${p(0.16)} solid ${shade(b, 0.8)}`;
      o.padding = `0 ${p(0.2)}`;
      break;
    case 'planter':
      o['-webkit-text-stroke'] = `${Math.max(1, fs / 22).toFixed(1)}px ${side}`;
      o.color = 'transparent';
      break;
    case 'keychain':
      o.color = b;
      o['text-shadow'] = `0 2px 0 ${shade(b, 0.6)}`;
      o.background = `radial-gradient(circle at ${p(0.32)} 55%, var(--card) ${p(0.09)}, ${a} ${p(0.1)})`;
      o.padding = `${p(0.02)} ${p(0.35)} ${p(0.12)} ${p(0.62)}`;
      o['border-radius'] = '999px';
      o['box-shadow'] = `0 ${d}px 0 ${side}, 0 ${d * 2}px ${d * 2}px rgba(0,0,0,0.45)`;
      break;
    case 'stepped':
    case 'pyramid':
      o['text-shadow'] = [1, 2, 3].map((i) => `${(i * d * 0.6).toFixed(1)}px ${(i * d * 0.6).toFixed(1)}px 0 ${shade(a, 1 - i * 0.15)}`).join(', ') + `, 0 ${d * 3}px ${d * 3}px rgba(0,0,0,0.45)`;
      break;
    case 'topo':
      o['text-shadow'] = [1, 2, 3, 4].map((i) => `0 ${(i * d / 2).toFixed(1)}px 0 ${shade(a, 1 - i * 0.12)}`).join(', ') + `, 0 ${d * 3}px ${d * 3}px rgba(0,0,0,0.45)`;
      break;
    case 'ramp':
    case 'book':
      o.color = b;
      o.transform = 'skewX(-12deg) rotate(-4deg)';
      o['text-shadow'] = extrude(shade(b, 0.6), Math.max(2, Math.round(d / 2)));
      o.background = a;
      o.padding = `${p(0.06)} ${p(0.2)}`;
      o['border-radius'] = '6px';
      o['box-shadow'] = `0 ${d}px 0 ${side}`;
      break;
    case 'arrow':
      o.color = '#F6EFE4';
      o['text-shadow'] = extrude(shade(b, 0.8), Math.max(2, Math.round(d / 2)));
      o.background = a;
      o.padding = `${p(0.08)} ${p(0.5)} ${p(0.08)} ${p(0.25)}`;
      o['clip-path'] = 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)';
      break;
    case 'pins':
      o.color = a;
      o['text-shadow'] = `0 2px 0 ${side}`;
      o.background = `radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 2px) 0 0/7px 7px, ${b}`;
      o.padding = `${p(0.08)} ${p(0.22)}`;
      o['border-radius'] = '6px';
      break;
    case 'lines':
      o.color = a;
      o.background = `repeating-linear-gradient(45deg, ${shade(b, 1.4)} 0 2px, ${b} 2px 6px)`;
      o.padding = `${p(0.08)} ${p(0.2)}`;
      o['border-radius'] = '4px';
      break;
    case 'concrete':
      o.color = '#BDB8AE';
      o['text-shadow'] = extrude('#7d786f', d);
      break;
    case 'flower':
      o.transform = 'rotate(-8deg)';
      break;
  }
  return Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';');
}

/** Which shelf of the catalog a style sits on. */
export const STYLE_CAT: Record<Style, string> = {
  sign: 'Signs', arrow: 'Signs', ramp: 'Signs', duo: 'Signs',
  keychain: 'Gifts', book: 'Gifts', flower: 'Gifts',
  planter: 'Home', stack: 'Home', stepped: 'Home', facet: 'Home', concrete: 'Home', terrace: 'Home',
  topo: 'Art', pyramid: 'Art', pins: 'Art', lines: 'Art',
  lamp: 'Lamps & molds', mold: 'Lamps & molds', tile: 'Lamps & molds',
};
export const CATS = ['All', 'Signs', 'Gifts', 'Home', 'Art', 'Lamps & molds'];
