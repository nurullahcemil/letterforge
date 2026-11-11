# Letterforge — handoff notes

Browser app that turns text into 3D-printable objects (STL / multi-colour 3MF).
Everything runs client-side. Live: https://letterforge-sigma.vercel.app

Read this file first. Details: `docs/ARCHITECTURE.md` (code map), `docs/DEPLOY.md`
(how to ship), `docs/DECISIONS.md` (why things are the way they are, past bugs), `docs/ROADMAP.md`.

## Stack
- Vite + TypeScript (ESM), no framework. UI is hand-written DOM in `src/main.ts`.
- Geometry in a Web Worker (`src/worker.ts` → `src/geometry.ts`):
  - manifold-3d 3.5.4 (WASM): CrossSection offset/boolean (Clipper2), extrude, warp, Manifold CSG.
  - straight-skeleton 3.0.0 (CGAL WASM) for faceted roofs. Outer ring must be CCW.
  - opentype.js 2.0.0 for glyph outlines (`src/text.ts`).
- three.js 0.187 viewer (`src/viewer.ts`), three-mesh-bvh (fast picking + "Check print" view:
  overhangs > 45° unsupported, walls < 0.8 mm). qrcode, fflate (3MF zip, WOFF1 unpacking).
- Text shaping: harfbuzzjs in the worker (`setShaper`; kerning, ligatures, Arabic/RTL, variable-font
  spacing), opentype.js for outlines and as fallback. WOFF2 decoded with woff2-encoder/decompress.
  Letter style block (under the fonts) ONLY for variable fonts (user: "only for variable fonts"):
  Light/Regular/Bold, Narrow/Normal/Wide, Upright/Italic + sliders, each shown only if the font has
  that axis (or a Google italic file, key suffix `:i`); `params.fontVar = {key, axes}`. No made-up
  styling in the UI (textBold/textWidth/textSlant still work in geometry but are reset by the UI).
  Per letter (click a letter): Weight / Slant / Italic rows for the font's own axes
  (`letterMove[i].wght|slnt|ital`, drawn per glyph; the letter's slot follows its new width).
  Variable fonts are NEVER stretched (user): per-letter Width = the font's wdth axis value
  (`letterMove[i].wdth`), greyed "Not in this font" without the axis; old letterW factors on a
  variable font become wdth = current·factor. Only non-variable fonts stretch (letterW).
  Per-letter italic on a Google variable font without ital/slnt but with an italic file: the
  letter is drawn from that file (`italicCompanion()` → build msg `italicKey` → `setItalicFont`).
  Popup shows missing settings greyed ("Not in this font"); gallery cards of variable fonts list
  what they have (weight/width/italic) from api.fontsource.org/v1/variable/<id>, fetched on view.
- Artwork (`src/art.ts`, page side): SVG via three SVGLoader (white fills = holes) or PNG/JPG traced
  with esm-potrace-wasm; `params.art` outlines (1 unit tall) placed by `Builder.artwork`.
- Downloads: meshoptimizer "Lighter files" (0.02 mm, not the lamp; `src/lighten.ts`); backing DXF
  via makerjs (lazy). Lamp 'stone' surface uses simplex-noise.
- Fonts: 7 bundled @fontsource WOFFs (latin + latin-ext fallback for Turkish etc.),
  Google Fonts via Fontsource CDN (variable ones as WOFF2), user uploads (TTF/OTF/WOFF/WOFF2). Google Fonts gallery
  (`#gf-grid`): catalog from api.fontsource.org, popular fonts first, kind chips, each name drawn in
  its own font (loaded only when scrolled into view, 40 cards then more on scroll); tap = use.
  "Variable" chip filters to variable fonts (Fontsource `variable` flag); cards show "· Variable".
- Saved designs: IndexedDB in the browser (`src/store.ts`). Hash routes `#/`, `#/new/<style>`, `#/d/<id>`.

## Commands
```bash
npm install
npm run dev            # local dev
npx tsc --noEmit -p .  # typecheck
npx vite build
npx tsx scripts/smoke.ts   # builds every style in Node (with HarfBuzz; NOHB=1 without), prints parts/tris/size/warnings
```
Regression check used so far: run smoke before and after a change and diff the
`name parts tris size` lines; they must be identical unless the change is meant to alter output.

## Styles (Params.style)
sign (table sign + QR), planter, topo, facet, keychain, duo (two-text sign/vase),
stack (bold stack), stepped, ramp (ramp relief), book (book sleeve), lamp (no text: shade + base, `src/lamp.ts`).

## Key conventions
- Model coordinates = print coordinates, mm, Z up. Viewer rotates the model −90° about X.
- Book sleeve is shown front-up; `standOnOpenEnd` rotates only on export when "Standing".
- Stacked slabs overlap by `OVERLAP = 0.01` so unions fuse.
- `Params` object holds all settings (defaults in `src/defaults.ts`). Never mutate
  `params.letterW` / `params.letterMove` in place (DEFAULTS shares the object) — copy.
- Per-letter keys = index among the text's non-space characters.
- Everything user-facing: short plain English, no jargon.

## Current state (all deployed)
See the bottom of `docs/DECISIONS.md` for the feature list and history.
The user prints on a Bambu Lab X1E with Bambu Studio 2.x; 3MF colour import is confirmed working.

## Wooden backing (side feature, all text styles except book)
Params `back*`. `Builder.backing()`: footprint = union of `project()` of every kept part (so split
and dragged parts count), grown by the margin; "outline" bridges gaps (close by max(round, 0.35·cap))
and drops inner holes, "rect" = bounds + margin with rounded corners. Hanging holes: allowed area =
board inset by r+3 minus letters grown by r+2; each hole goes to the point of that area nearest its
target (15%/85% across, near top/bottom). Shown in 3D as a previewOnly board under z=0 (never
exported). `BuildResult.backing` → `toBackingSVG` (export.ts): mm units, red 0.1 = cut,
blue 0.1 = letter guide (engrave/score). Check: `npx tsx scripts/backing-check.ts '{"backHoles":"four"}'`.

## Lamp style
Table lamp for an E27 lamp kit. Defaults are measured from a lamp the user owns a paid file of
("Dreieckige retro Lampe mit Korbstruktur", MakerWorld, Standard Digital File License): use it for
sizes only, never copy its geometry. Real sizes: shade 173 tall, 202×222 (triangle, 244 across
corners), 3 round bulges, waist ≈ 0.8; base body 117 + neck 24.5, Ø121.5; neck Ø65; socket hole Ø41.
`src/lamp.ts`:
- Shade: outline (r,z) → wall → revolve → hub (rim ring, spokes, collar) → `shadeWarp`.
- `shadeWarp`: wall points are placed by their depth below the outer surface, measured square to
  it (meridian normal, plus the plan-shape angle), so the wall keeps its thickness on every slope
  and side, and the pattern moves both skins together. Never push the pattern straight out from
  the centre: on flat-ish parts that folds the wall (seen as holes in Bambu Studio). Only the hub
  fades back to round near the centre (fading the wall folded umbrella tops).
- Pattern grid: mesh points sit exactly on the dot grid (`perDot` = 4 preview / 6 download).
  Rows: the outer outline is `resample`d at size/perDot along its length. Columns: revolve with
  around·perDot segments, then `perimeterMap` spaces them evenly along the plan outline (flat sides
  and corners alike) and they turn with the twist. Don't go back to angle- or z-based patterns.
- Basket weave (default) is built exactly like the original (measured from its mesh):
  `wovenBands` — the wall is a stack of separate bands, each a wavy ring (sine around, constant
  wave count, scaled with the radius) extruded one band height along the surface (resampled at
  `lampTexH` 2.13), tilted to follow it, wall measured square to it; every other band is shifted
  half a wave. Defaults from the original: wave 5 mm (`lampTexSize`), depth 1.5 mm peak-to-valley.
  Wall is measured FLAT (as the slicer cuts it), default 0.42 = one print line (user wants one line
  per band; 0.9 gave two lines + white gap fill in Bambu). On steep parts it widens to
  2·0.2·tan(lean) so each layer sits half on the one below. Waves use cos with 6 points per wave
  (a point on every crest/valley; 0.1 mm off the true curve) → shade ~0.73M, base ~0.29M tris.
  The lamp 3MF has shade and base as separate objects (`to3MF(..., separate)`), each < 1M tris.
  Seam: every band has one tiny sharp inward V crease (0.6 wide, 0.25 deep) at the SAME world angle
  (+Y, twist taken out), spliced into the outline with its shoulders on the existing edge, so the wave
  keeps its exact shape and the creases line up into one straight line (an older version snapped a
  0.4 mm notch to the nearest valley → zigzag stripe the user saw as a fault). It is the sharpest
  concave corner of each layer, so Bambu's Aligned/Back seam lands there. Check: `scripts/lamp-seam.ts`. Where depth > wall, neighbouring bands don't touch → small light holes (as in the
  original). Bands touch face to face and are NOT merged (like the original file): merging or even
  `Manifold.compose` of ~100 bands takes 15-25 s in WASM. LampPiece has `extra` (unmerged meshes);
  Builder.lamp concatenates them; kept parts are raw meshes so STL export never merges.
  Only overlapping bits are merged (hub + bottom bands; base neck/feet + nearby bands).
  Beware: manifold ops are lazy — time with `scripts/lamp-time.ts`, which forces evaluation.
- Barrel outline: no part leans more than 45° (`shadeOutline` raises valleys with 45° flanks →
  V waists, like the original). 45° is the steepest one 0.42 line climbs at 0.2 layers, so every
  layer is ONE line (user: "I don't want a thick lamp"). Check: `scripts/lamp-lines.ts` (must say
  1 line: 100%). Same on the woven base: where the rounded shoulder turns flatter than 45° the bands
  carry on in a straight 45° line into the neck (flat bands printed as stair steps at the neck).
- Twist lock (own design): 3 lugs on the base neck, 3 L-slots inside the shade collar. Drop the
  shade on, turn 32° to lock. Check with `npx tsx scripts/lamp-lock.ts '{}'` (overlap must be 0
  while putting on, > 0 when lifting/pushing a locked shade).
- Preview builds lighter; downloads rebuild with `lampFine: true`.
- "Put together" view: shade shown on the base; files always use the side-by-side print layout
  (`Part.printOffset` / `printMesh`, applied in `forExport`).
Other checks: `scripts/lamp-holes.ts` (folds/holes, must say clean), `scripts/lamp-wall.ts`
(wall thickness), `scripts/lamp-check.ts` (validity), `scripts/lamp-slice.ts` (SVG slices),
`scripts/lamp-time.ts` (speed).
