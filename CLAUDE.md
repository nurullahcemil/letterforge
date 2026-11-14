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
  Variable-font OUTLINES are drawn by HarfBuzz (`glyphPath`, hb glyphToPath at the current axes):
  opentype.js's gvar math can leave stroke ends poking out at joins (user saw nubs on M/E).
  Per-letter italic on a Google variable font without ital/slnt but with an italic file: the
  letter is drawn from that file (`italicCompanion()` → build msg `italicKey` → `setItalicFont`).
  "Mix letters" (Letter style block): Shuffle letters = random per-letter wght/wdth/italic within the
  font's ranges (`shuffleLetters`, params mixWght/mixWdth/mixItal/mixAmount %), Clear removes them.
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

## Editor layout (user: "step by step, like ordering a Tesla; use the canvas")
- Configurator: canvas on the LEFT, step column on the right (desktop). Steps (STEPS in main.ts):
  Idea → Words → Font → Shape → Size → Finish; sections carry `data-step`; `renderStepbar`
  hides the others (`.tab-off`), clickable step bar = jump, sticky Back/Next (last = Download 3MF).
  No-text styles skip Words/Font; Size is skipped when the size section is hidden. New designs
  start at Idea, saved designs open at Shape. Steps do NOT move the camera (user: keep
  the view, or where I moved it); it starts at the 3/4 view from above. Exception: on Size,
  `viewer.setScaleFrame(true)` frames the whole bed from the current direction and holds the
  camera (no auto-refit) so the model visibly grows/shrinks against the bed (user: "I can not get
  the sense of how big it is"); it only pulls back if the model outgrows the frame.
- Canvas: summary pills (style · font · size · plates · colours, `renderSummary`); a size handle at
  the model's right edge on Shape/Size steps (`viewer.screenBox`, drag scales `sizeKeys()` of the
  style); click a part in the parts list to open its colour picker.
- Picture choices: a select whose key is in `OPTION_ICONS` (src/optionIcons.ts, SVG 40×28 in
  currentColor) renders as picture cards instead of words.
- Ideas have pictures: `public/ideas/<style>-<i>.webp`, made by `node scripts/render-ideas.mjs`
  (dev server running; uses `__letterforge.thumb()`). RE-RUN IT after changing SAMPLES. Home page
  "Ideas ready to print" = first two ideas per style; links `#/new/<style>/<i>` open the idea and
  jump to the Words step.
- Click a part ON the model in the Finish step (or any step for styles without letters) to open
  its colour picker (`pickColourOf`; viewer passes the hit part's colour to onPick).
- Basic vs advanced: keys in `ADVANCED` sit behind "More options (n)" in the Shape step.
- Style presets + sample ideas live in `src/presets.ts` (PRESETS, SAMPLES). An idea = DEFAULTS +
  preset patch + idea patch (colours/bed kept). Every start design and idea must pass
  `npx tsx scripts/fit-check.ts [style,style]` (no piece over bed−10, not taller than the bed, not
  cut to fit). Multi-piece styles (lamp, pins apart, concrete, lines, tile) may need several plates.
- Settings lists can hold `{ kind: 'heading', key: 'style', label }` group titles (empty groups
  are dropped after filtering).
- HUD bed check (`updateBedFit`): green "Fits your N mm bed", amber "Prints on N plates" /
  "Cut into pieces", red "Too big", from the print layout (forExport + layoutOnPlates).
- Empty text no longer crashes (manifold can't take an empty polygon list); pins waves/ripples
  build with no text.

## Look: "The Flow" redesign (user's Design canvas, LfD_Home / LfD_Editor)
- Dark, type-first. Tokens on `:root` in style.css (bg #0A0A0B, panel #0F0F11, card #141416, ink
  #F4F4F2…#8E8E93, mint accent #5FD3A0, brand tile #2F6B4F, glass HUD). Geist + Geist Mono (mono
  uppercase labels). White pill = main button; mint only for current step + final Download.
  The "Flow redesign" block at the end of style.css overrides the older rules above it.
- Home: "Ideas ready to print" (first two ideas per style, REAL rendered pictures in the Flow card
  look) + "Start something new" (every style) + My designs. The live-word catalog ("What should it
  say?" box, CSS fake-3D words, category chips) was tried and REMOVED (user didn't like it); the
  editor Idea step also uses the real pictures. `#/new/<style>/<i>?w=<word>` still works.
- Editor steps: Words = count + suggestion chips + artwork; Font = font cards showing the word
  (≤5 letters) + Tight/Normal/Loose spacing; Size = width ruler (`renderRuler`) + size card + bed
  bar; Finish = filament swatches per colour role (`FILAMENTS`, `renderSwatches`; real colour
  inputs kept hidden) + print-check card. Viewer bed is dark (re-run render-ideas after changes).
- Phone width: HUD dims/summary/parts legend hidden; bed-fit pill and actions stay.
- Light theme (user: "add light template as well"): `:root[data-theme='light']` token set; overlay
  colours use `rgba(var(--fg-rgb), a)` so they flip. Moon/sun `.theme-toggle` in the home header
  and editor top line; choice saved in localStorage `lf-theme` (inline script in index.html sets it
  before paint); `applyTheme` also calls `viewer.setTheme` (plate colours). Default dark.
- Canvas background = dot grid (`--dot`, 22 px) over the radial `--stage`.
- Build plate (`Viewer.setBed`, user: "make the base plate look like a base plate, maybe Bambu
  shape"): own design — rounded sheet (print area + edge), two lift tabs at the front (+z), bevelled
  metal body, CanvasTexture coating (speckle, 10 mm grid, 50 mm lines, print-area corner marks)
  on a ShapeGeometry top; dark/light versions. No logos or branding.
- Idea pictures (`__letterforge.thumb`) hide the plate (`viewer.showBed(false)`), trim to the
  object and centre it on a clear background, so picture cards match the live word cards in both
  themes. Every style uses them: re-run `node scripts/render-ideas.mjs` (dev server up) after
  changing SAMPLES or the viewer look (`ONLY=a,b` limits styles). Colour dots have a thin ring.
  Seen from the TOP (user: "put the top views on the cards… it is hard to see"); lamp + mold keep
  the 3/4 view, duo (standing sign) the front view. The script also renders `<style>-start.webp`
  (starting design), shown on "Start something new" and the editor's style picker cards.

## Styles (Params.style)
sign (table sign + QR), planter, topo, facet, keychain, duo (two-text sign/vase),
stack (bold stack), stepped, ramp (ramp relief), book (book sleeve), lamp (no text: shade + base, `src/lamp.ts`),
mold (no text: candle shape + printable candle mold, `src/mold.ts`), flower (letter flower),
arrow (arrow sign), pyramid (pyramid-tile letters), pins (pin art), lines (line letters),
concrete (concrete letter molds), tile (no text: star & cross tile mold, `src/tiles.ts`),
terrace (no text: terrace planter, `src/terrace.ts`).

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

## Bigger than the bed (3MF)
When the printable parts exceed bedSize−10 (not lamp/book), the 3MF download uses `layoutOnPlates`
(export.ts): each piece is its own object (a different-colour part overlapping a piece, e.g. QR on its
sign piece, stays with it), shelf-packed onto plates (5 mm edge, 6 mm gap) placed in Bambu's plate
grid (cols = rounded-up √n, stride 1.2·bed), with `<plate>` entries in model_settings.config.
STL can't hold plates: a warning points to the 3MF. Check: `npx tsx scripts/plate-check.ts '{...}'`.

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

## Candle & mold style
Own parametric designs (user sent photos of tree / pleated ball / zigzag-split / drop molds; never
copy those). `src/mold.ts`, `Builder.mold()`. Params `mold*`; `MOLD_SHAPE_DEFAULTS` are applied by
the UI when the shape changes (sides, pleat depth, size, mold kind).
- Candle = lathe mesh built directly: profile (z, r); each ring has 2·sides points, even = ridge r,
  odd = r·cos(π/n) − depth·r/R (depth 0 = flat facets). Rings turn with `moldTwist`. r = 0 → one
  pole vertex (bottom pole fan must be wound (pole, i+1, i) — got this wrong once: "Not manifold").
  Shapes: ball, drop (tip, rim at 0.42, neck for a cap), gem (table, girdle, point), pillar, tree
  (trunk with 2 grooves, tiers that overlap 35 % → ledges).
- Pour orientation: flat end up (tree/gem/pillar flipped), ball/drop get a pour channel (drop: cone
  from the neck). Wick hole on the axis through the bottom.
- `silicone` (DEFAULT, user: "you need to make a 3d for the mold making first" — the photos were
  silicone molds): `siliconeKit` = master (candle + pour channel + wick pin) upside down on a round
  base plate (pour end on the plate) + a round wall ring that slides over the plate (0.3 fit);
  silicone covers the master by `moldWall`; note gives the silicone ml.
- Molds: `two` = block split at y=0 (pins on A, sockets on B at different heights, M4 bolt holes
  through the flanges, band grooves); `zigzag` = round mold split at the widest ring; the candle's
  seam is a flat ring, teeth (peak-to-peak `moldZig`, lined up with the pleats incl. twist) start
  1.5 mm outside it (`polarSolid` region); `open` = one cup (warns when it would get stuck).
- Preview "Pulled apart" (two-part halves turned to open left/right on screen) or "As printed";
  files always use the print layout (`Part.printMesh`, like the lamp): halves parting face up,
  zigzag top flipped, candle standing; 3MF has each piece as its own object.
- Band grooves: cut with `cs.offset(1) − cs.offset(−2)`; cutting `cs − cs.offset(−2)` (shared outer
  edge) left slivers (genus jumped by 4).
- Wax needed = candle volume × 0.9 g/ml, shown as a note.
Check: `npx tsx scripts/mold-check.ts ['{"moldShape":"ball"}']` (every shape × kind: valid pieces,
no overlap between halves and candle; must end "all clean").

## Letter flower / Arrow sign / Pyramid tiles / Tile mold (user photos; own designs)
- flower (`Builder.flower`): CONFORMAL (angle-keeping) bend, like a map projection: θ = −k·x,
  r = rFoot·e^(k·y), so every bit of a letter keeps its shape (readable; user rejected linear
  bends twice: "still not reading, change the way we work"). Each glyph scaled to the same height;
  slice ∝ letter width; letters auto-narrowed/widened (cN) so the feet land at `flMiddle` % of the
  radius (k·len = ln(1/m)), like the condensed letters in the user's photo; scaled to `flSize`.
  Check from the top: `npx tsx scripts/flower-svg.ts out.svg '{"text":"BLOOM","flCount":12}'`.
- pins (`Builder.pins`, "Pin art"): grid of cylinders on a plate (colour B) + frame; height level
  from waves (sine along `pinAngle`), ripples, or text (signed distance to the outline, eased over
  `pinSoft`); `pinGrow` makes tall pins wider. `pinText` up/down puts the (centred) text into the
  waves/ripples: waves squeezed to 0–45 % (or 55–100 %) of the height, letters go to full (or none). Pins are composed (disjoint), not unioned.
  `pinSeparate` (two-colour printing, DEFAULT ON — user expected 2 plates and had it off): base (+ frame, merged) gets a hole per pin (r + `pinFit`,
  `pinSocket` deep, base ≥ socket + 1.2); pins reach 0.2 mm short of the hole bottom; WorkPart
  `print` → Part.printMesh: pins stand on the bed in the same pattern, beside the base. STL button
  downloads two files (-base.stl, -pins.stl); 3MF ALWAYS puts the base on plate 1 and the pins on plate 2
  (`layoutOnPlates(..., colorPlates=true)`: each colour starts a new plate; user asked for 2 plates).
- pins extras: `pinLayout` grid | rings (circles, every other turned half a step), `pinHole` empty
  middle, `pinMode` 'halo' (tall ring just outside the hole, fading out), `pinTip` flat | round
  (revolved dome) | tube (revolved, hole from the top). User photos: yellow round-top M, framed
  ring of tubes.
- lines (`Builder.lineLetters`, "Line letters", user photo of a fin alphabet): one square tile per
  character (rows = text lines, wrapped at `lnCols`); letter scaled into the tile; inside: rings
  `letter.offset(−k·pitch)` minus a `lnFin` inset; outside: straight bars at 0/45/90/135° or
  concentric squares (seeded per tile), clipped to tile − letter grown. Each tile = own part
  (Tile n colour B + Letter n colour A) so big sets spread over plates; NOT bed-split (decompose
  shattered fins into 300+ pieces). Per-letter settings (variable-font wght/wdth/ital, Mix letters)
  apply per tile: letterMove[key] passed as moves {"0": ...}; tile centres are the click spots.
- concrete (`Builder.concrete`, "Concrete letters"): ONE PIECE PER LETTER (cs.decompose, sorted
  left→right; not bed-split) so each fits the bed. master (DEFAULT): letter narrowing upward by
  `ccDraft` on a 2.4 floor in its own open box (wall D+8) for silicone; mold: tray (follows the
  letter or rectangle) with a MIRRORED pocket (face at the bottom) widening upward. Draft = stacked
  1 mm slabs each offset a bit more (`taper`). Hanging holes: highest vertex of letter.offset(−(r+3))
  per piece (hole through master letter / pin standing in the pocket). Letters spaced by 2·wall+2.
- terrace (`src/terrace.ts`, "Terrace planter", user photo of a stepped succulent tray): hills =
  organic blobs (circle + harmonics 2–4, seeded) side by side; tray = union closed by 0.35·R (necks
  flow); per hill, levels = the blob scaled by 1 − j·step/r, moved toward an off-centre peak, kept
  inside the level below; every outline is a thin wall standing on the ONE floor (H + j·rise), so no
  supports. Step auto-shrinks so all levels fit (note shown). One part, unioned.
- arrow (`Builder.arrowSign`): board around text bounds + margin: turn (bar → quarter-disc corner
  → arm → head; mirrored for left), arrow (head on any side), rect, circle. Shadow = letters swept
  `arShadowLen` toward `arShadowAng` (union of copies every 0.4 mm) ∩ board, colour B; letters on
  top in `colorC` (third colour input, shown only for this style).
- pyramid (`Builder.pyramid`): square grid (optionally turned 45°), each cell a hull: pyramid or a
  slope rising to one random side (`pyMix`, seeded), clipped to the letters, on a base slab. All
  slopes face up, so no supports.
- tile (`src/tiles.ts`): stars at lattice points i+j even (spacing L = size/√2): square ∪ square
  turned 45°; cross = diamond around (L,0) minus 4 stars (areas sum to 2L², checked). Make:
  master (DEFAULT: positive tiles tapered by `tlDraft` in an open box for silicone), tray (hard
  mold with tapered pockets), cutter (0.9 blade + 3 mm rim per shape).
