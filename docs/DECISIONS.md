# Decisions, gotchas and history

## Gotchas (learned the hard way)
- opentype.js / straight-skeleton in Node: use namespace imports with fallbacks; tests need
  `self`/`window` shims.
- Straight skeleton aborts the WASM on a CW outer ring — pass CCW outer + holes.
- Dancing Script: `stringToGlyphs` throws (GSUB) → fall back to `charToGlyph`.
- Turkish glyphs live in the latin-ext WOFF → loaded as fallback font.
- Stepped style: letters fused/merged and bed-split cut through letters → added automatic
  letter `gap`, and `splitToBed` first decomposes into whole letters, only cuts oversize pieces.
- `splitToBed` cells must meet exactly at cut lines (earlier bug left a 1 mm gap).
- Blank page on toggle: absolutely positioned checkbox inputs made the document tall and the
  page scrolled to empty space → `.toggle { position: relative }`, input 1×1 at 0,0.
- Fill-the-page: never squeeze a line below 0.5× (MIN_SQUEEZE); if the box is taller, scale
  the text block vertically (capFill/cap).
- Line letters: outline pieces must ramp across the whole original letter (inner ring of "O").
- Pixel/blocky fonts: pieces touching only at a corner → `joinLetterPieces` adds a bridge.
  Pieces >0.3 mm apart (i/j dot) are left alone.
- **Bambu Studio colour import** (from reading BambuStudio source, tags v02.05–v02.09):
  non-Bambu 3MF → config (model_settings.config) is ignored; versions ≤2.08 read only
  `m:colorgroup`/`m:color` (literal `m:` prefix, expat non-namespace mode), NOT
  `basematerials`; 2.09 also reads basematerials and per-triangle `paint_color`, and adds
  missing filaments. We write colorgroup + paint_color. Confirmed working by the user.
  Side effect: Bambu may create 4 filament slots (2 from each mechanism) — open question,
  user was offered removing one mechanism.
- STL cannot carry colour. STL button = one merged file. Two colours → 3MF, or STL with a
  filament change at a layer height in Bambu Preview.
- Prime tower in Bambu is Bambu's own (multi-colour purge), not from our file.

## UX decisions by the user
- Fill the page (book) on by default with smart line breaks.
- Per-letter settings open by clicking the letter on the canvas (not in the sidebar).
- Stepped: optional base (rectangle or follows letters, own colour), drag letters on canvas.
- One STL file only.

## Feature history (commits)
1. Base app: sign+QR, planter, topo, facet styles.
2. keychain, two-text sign (duo, flower stem holes), bold stack, stepped, ramp relief.
3. Book sleeve (sized to a book, raised/ramp/swept letters), drag text, stepped spacing fix.
4. Book: word wrap, fit-to-front, Turkish glyphs.
5. Save designs + home gallery; stretch lines to fill the page.
6. Blank-page fix; smart fill default.
7. Line (outline) letters, Google Fonts search, two-colour exports.
8. Per-letter widths (variable-font style; line refills).
9. Click-a-letter popover (width/rotate/move), stepped base + per-letter drag, outline ramp fix.
10. Bed-split gap fix. 11. 3MF colours via m:colorgroup; STL single file.
12. Join touching letter pieces.
13. Lamp style (mushroom lamp: shade + base, E27 kit). Printability: walls lean at most
    max(underside angle, 90° − top slope); warning above 62°. Top vent default 30 mm (no flat ceiling).
14. Lamp matched to the user's real lamp file (sizes only; licence forbids copying): round-bulge
    shade with triangle plan, base with neck, own twist lock; assembled preview; lighter preview mesh.
    Gotchas: manifold booleans are lazy, the cost shows up at the next warp/getMesh; offsets add
    tiny arcs at every curve point → `simplify(0.03)` before densifying; round offsets eat the
    bottom edge → extend outlines below z=0 and trim.
