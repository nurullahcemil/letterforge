/**
 * Little pictures for choice buttons (key → option value → SVG body, viewBox 0 0 40 28, drawn with
 * currentColor). A choice whose key is here shows as picture cards instead of plain text buttons.
 */
const S = (body: string) => `<svg viewBox="0 0 40 28" aria-hidden="true">${body}</svg>`;
const st = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"';
const fl = 'fill="currentColor"';
const soft = 'fill="currentColor" opacity=".25"';

export const OPTION_ICONS: Record<string, Record<string, string>> = {
  base: {
    bar: S(`<path d="M7 6h5v14H7zM14 6h5v14h-5zM21 6h5v14h-5z" ${fl}/><rect x="4" y="19" width="32" height="4" rx="1" ${soft}/><rect x="4" y="19" width="32" height="4" rx="1" ${st}/>`),
    plate: S(`<rect x="3" y="4" width="34" height="20" rx="2" ${soft}/><path d="M9 9h4v10H9zM15 9h4v10h-4zM21 9h4v10h-4z" ${fl}/>`),
    none: S(`<path d="M8 6h5v16H8zM15 6h5v16h-5zM22 6h5v16h-5z" ${fl}/>`),
  },
  arShape: {
    turn: S(`<path d="M8 3h8v12c0 3 2 4 5 4h6v-4l8 7-8 7v-4h-6c-8 0-13-4-13-12z" ${soft}/><path d="M8 3h8v12c0 3 2 4 5 4h6v-4l8 7-8 7v-4h-6c-8 0-13-4-13-12z" ${st}/>`),
    arrow: S(`<path d="M3 9h22V3l12 11-12 11v-6H3z" ${soft}/><path d="M3 9h22V3l12 11-12 11v-6H3z" ${st}/>`),
    rect: S(`<rect x="4" y="5" width="32" height="18" rx="3" ${soft}/><rect x="4" y="5" width="32" height="18" rx="3" ${st}/>`),
    circle: S(`<circle cx="20" cy="14" r="11" ${soft}/><circle cx="20" cy="14" r="11" ${st}/>`),
  },
  arDir: {
    right: S(`<path d="M8 14h22M24 8l6 6-6 6" ${st}/>`),
    left: S(`<path d="M32 14H10M16 8l-6 6 6 6" ${st}/>`),
    up: S(`<path d="M20 24V5M14 11l6-6 6 6" ${st}/>`),
    down: S(`<path d="M20 4v19M14 17l6 6 6-6" ${st}/>`),
  },
  moldShape: {
    ball: S(`<circle cx="20" cy="14" r="11" ${soft}/><path d="M20 3c-5 6-5 16 0 22M20 3c5 6 5 16 0 22M20 3v22M11 8c3 4 3 8 0 12M29 8c-3 4-3 8 0 12" ${st}/>`),
    drop: S(`<path d="M20 2v3M16 5h8l7 12-11 9-11-9z" ${soft}/><path d="M18 2h4v3h-4zM16 5l-7 12 11 9 11-9-7-12zM9 17h22M20 5v21" ${st}/>`),
    gem: S(`<path d="M13 5h14l7 7-14 14L6 12z" ${soft}/><path d="M13 5h14l7 7-14 14L6 12zM6 12h28M13 5l3 7 4 14 4-14 3-7" ${st}/>`),
    pillar: S(`<rect x="12" y="3" width="16" height="22" rx="1" ${soft}/><path d="M12 3h16v22H12zM16 3v22M20 3v22M24 3v22" ${st}/>`),
    tree: S(`<path d="M20 2l7 9h-4l6 8h-5l6 6H10l6-6h-5l6-8h-4z" ${soft}/><path d="M20 2l7 9h-4l6 8h-5l6 6H10l6-6h-5l6-8h-4zM18 25h4v2h-4z" ${st}/>`),
  },
  moldKind: {
    silicone: S(`<rect x="6" y="6" width="28" height="19" rx="2" ${soft}/><path d="M6 6v19h28V6" ${st}/><path d="M17 25v-9a3 3 0 0 1 6 0v9" ${st}/><path d="M12 6c0-3 4-3 4 0" ${st}/>`),
    two: S(`<rect x="4" y="5" width="14" height="19" rx="1" ${soft}/><rect x="22" y="5" width="14" height="19" rx="1" ${soft}/><path d="M4 5h14v19H4zM22 5h14v19H22zM18 10a4 4 0 0 1 0 9M22 10a4 4 0 0 0 0 9" ${st}/>`),
    zigzag: S(`<rect x="8" y="3" width="24" height="22" rx="2" ${soft}/><path d="M8 3h24v22H8zM8 14l4-3 4 3 4-3 4 3 4-3 4 3" ${st}/>`),
    open: S(`<path d="M9 5h22l-2 20H11z" ${soft}/><path d="M9 5h22l-2 20H11zM14 9h12l-1 12h-10z" ${st}/>`),
  },
  pinLayout: {
    grid: S([0, 1, 2, 3, 4].flatMap((i) => [0, 1, 2].map((j) => `<circle cx="${8 + i * 6}" cy="${7 + j * 7}" r="2" ${fl}/>`)).join('')),
    rings: S(`<circle cx="20" cy="14" r="1.8" ${fl}/>` + [0, 1, 2, 3, 4, 5].map((k) => `<circle cx="${20 + 6 * Math.cos(k)}" cy="${14 + 6 * Math.sin(k)}" r="1.6" ${fl}/>`).join('') + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<circle cx="${20 + 11.5 * Math.cos(k * 0.628)}" cy="${14 + 11.5 * Math.sin(k * 0.628)}" r="1.5" ${fl}/>`).join('')),
  },
  pinTip: {
    flat: S(`<rect x="14" y="7" width="12" height="17" ${soft}/><path d="M14 7h12v17H14z" ${st}/>`),
    round: S(`<path d="M14 24V13a6 6 0 0 1 12 0v11z" ${soft}/><path d="M14 24V13a6 6 0 0 1 12 0v11z" ${st}/>`),
    tube: S(`<rect x="13" y="7" width="14" height="17" ${soft}/><path d="M13 7h14v17H13zM17 7h6v10h-6z" ${st}/>`),
  },
  pinMode: {
    wave: S(`<path d="M3 16c4-8 8-8 12 0s8 8 12 0 8-8 10-3" ${st}/>`),
    ripple: S(`<circle cx="20" cy="14" r="3" ${st}/><circle cx="20" cy="14" r="7.5" ${st}/><circle cx="20" cy="14" r="12" ${st}/>`),
    halo: S(`<circle cx="20" cy="14" r="9" fill="none" stroke="currentColor" stroke-width="5" opacity=".7"/><circle cx="20" cy="14" r="13" ${st} opacity=".4"/>`),
    letters: S(`<path d="M11 24l9-20 9 20M15 16h10" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>`),
  },
  pinText: {
    up: S(`<path d="M3 20c4-4 8-4 12 0M25 20c4-4 8-4 12 0" ${st} opacity=".5"/><path d="M16 22l4-16 4 16M17.5 16h5" ${st}/>`),
    down: S(`<path d="M3 10c4 4 8 4 12 0M25 10c4 4 8 4 12 0" ${st} opacity=".5"/><path d="M16 24l4-16 4 16M17.5 18h5" ${st} opacity=".6"/>`),
    none: S(`<path d="M3 16c4-8 8-8 12 0s8 8 12 0 8-8 10-3" ${st}/>`),
  },
  lampTier: {
    barrel: S(`<path d="M14 3c-6 3-6 8 0 11-6 3-6 8 0 11h12c6-3 6-8 0-11 6-3 6-8 0-11z" ${soft}/><path d="M14 3c-6 3-6 8 0 11-6 3-6 8 0 11h12c6-3 6-8 0-11 6-3 6-8 0-11z" ${st}/>`),
    cone: S(`<path d="M20 2L9 11h22zM20 9L5 20h30z" ${soft}/><path d="M20 2L9 11h22zM20 9L5 20h30zM18 20h4v6h-4z" ${st}/>`),
  },
  tlMake: {
    master: S(`<path d="M4 7v18h32V7" ${st}/><path d="M14 22l2-6-4-4h5l3-5 3 5h5l-4 4 2 6-6-3z" ${fl}/>`),
    tray: S(`<rect x="4" y="4" width="32" height="20" rx="2" ${soft}/><path d="M14 21l2-6-4-4h5l3-5 3 5h5l-4 4 2 6-6-3z" fill="var(--panel, #fff)" stroke="currentColor" stroke-width="1.5"/>`),
    cutter: S(`<path d="M14 23l2-7-5-5h6l3-6 3 6h6l-5 5 2 7-6-4z" ${st}/>`),
  },
  ccMake: {
    master: S(`<path d="M4 8v17h32V8" ${st}/><path d="M12 22V10h7a3 3 0 0 1 0 6h-7M26 10v12" fill="none" stroke="currentColor" stroke-width="3"/>`),
    mold: S(`<rect x="4" y="5" width="32" height="19" rx="2" ${soft}/><path d="M12 21V9h7a3 3 0 0 1 0 6h-7M26 9v12" fill="none" stroke="var(--panel, #fff)" stroke-width="3"/>`),
  },
  ccShape: {
    outline: S(`<path d="M9 5h10a6 6 0 0 1 0 12h-4v6H9z" ${soft}/><path d="M9 5h10a6 6 0 0 1 0 12h-4v6H9z" ${st}/>`),
    block: S(`<rect x="6" y="4" width="28" height="20" rx="2" ${soft}/><rect x="6" y="4" width="28" height="20" rx="2" ${st}/>`),
  },
  topoMode: {
    bowl: S(`<path d="M4 6h32M8 11h24M12 16h16M16 21h8" ${st}/>`),
    stack: S(`<path d="M16 6h8M12 11h16M8 16h24M4 21h32" ${st}/>`),
  },
};
