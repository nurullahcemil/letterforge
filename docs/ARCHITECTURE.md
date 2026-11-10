# Code map

## src/text.ts — text → 2D contours
- `parseFont`, `setFallbacks(font, [extFont])` (latin-ext glyphs for ğ ş ı etc.).
- `shapeLine` — glyph positions with kerning/tracking/`gap`. Uses `stringToGlyphs` unless
  per-letter options are set (then one glyph per char so indices line up).
- `layoutText(font, text, opts)` → `{contours, lines, lastBaseline, capHeight, lineCount,
  lineTexts, stretch, letterCenters, glyphs}`. Options:
  - `capHeight, tracking, lineSpacing, gap, maxWidth (wrap), align`
  - `stretchTo` — each line scaled in x to fill this width ("variable font" fill).
  - `widths` — per-letter width factor; later glyphs shift; then line re-stretched.
  - `moves` — per-letter `{dx, dy, rot}` applied after stretch, around the letter centre.
  - `glyphs` — contours per glyph (same arrays as `contours`).
- `smartLines(font, text, {tracking, lineSpacing}, boxW, boxH)` — DP choosing line breaks
  so stretched lines fill a box; returns `{lines, cap, capFill}`. Typed newlines are forced.

## src/geometry.ts — `Builder` (runs in the worker)
- `build(font, params, topFont?)` → `{parts, warnings, size, letters}`.
  `parts[]`: `{name, color, positions, indices, previewOnly?, drag?}`.
  `letters[]`: model x/y of each letter for canvas picking.
- Base layout → `CrossSection cs` → `joinLetterPieces` (for sign/planter/topo/facet/keychain/
  duo/stepped: bridges letter pieces that touch within 0.3 mm) → style method.
- Style methods: `sign, planter, topo, facet, keychain, duo, stack, stepped, ramp, book`.
  Helpers: `rampSolids` (warp-based wedge/sweep; optional solid shapes so outline pieces
  share their letter's slope), `outline` (line letters), `rounded`, `splitToBed`.
- `mergedByColor(byColor)` / `mergedMesh(color)` — unions for STL.
- Memory: every WASM object goes through `this.k()` and is freed in `flush()`;
  kept parts freed on the next build.

## src/lamp.ts — lamp style (no text)
- `shadeOutline(p)` sharp (r,z) outline of the tiers, mirrored; `buildLamp(wasm, keep, p, warnings)`
  → `[{name, m, role: 'shade'|'base'}]`. `Builder.lamp()` lays the pieces side by side on the bed.
- UI: `LAMP_CONTROLS` in main.ts; the Text and Size sections are hidden for this style.

## src/worker.ts
Messages: `font {key, buffer, ext}`, `build {fontKey, topFontKey, params}`, `merged {byColor}`.

## src/export.ts
- `toSTL(mesh)` binary STL.
- `to3MF(parts, title)` — one assembly object with components; colours as
  `<m:colorgroup>`/`<m:color>` (xmlns:m material ext), object `pid/pindex`; every triangle
  also gets `paint_color` (Bambu paint code: filament 1 "4", 2 "8", 3 "0C", 4 "1C"…);
  plus `Metadata/model_settings.config` with per-part extruder.
- `standOnOpenEnd` — rotation for standing book sleeve export.

## src/viewer.ts — three.js
- `setParts(parts, refit)`, `fit()`, `setBed(size)`, `snapshotFitted()` (thumbnails),
  `screenPointOf(dragKey)`, `highlight(dragKey|null)`.
- Drag: parts with `drag: {key, axes}` move in the plane of two model axes;
  `onDragEnd(key, a, b)`. Keys: `top`, `main` (duo), `text` (book), `letter:<i>` (stepped).
- Click (<5 px movement): `onPick(modelPoint|null, clientX, clientY)`.

## src/main.ts — UI
- `PRESETS` (per-style defaults/blurb), `STYLE_CONTROLS` (sidebar controls per style),
  `controlEl` (range/select/toggle/text), `renderStyleControls`, `renderGeneral`.
- Build loop: `schedule()` debounced → worker build → viewer.
- Letter popover: click a letter on the canvas → floating box (width, rotate, move x/y,
  "width to every X", reset). State in `params.letterW` / `params.letterMove`.
- Google Fonts: Fontsource API list + jsDelivr WOFF; keys `gf:<id>:<weight>`; recent list
  in localStorage `lf-gfonts`.
- Saving: Save button / Ctrl-S → IndexedDB with JPEG thumb; home gallery with duplicate,
  delete, export/import JSON backup.
- Downloads: 3MF (colours) and STL (always one merged file).

## scripts/smoke.ts
Builds ~23 named cases in Node (needs `self`/`window` shims, already in the script).
