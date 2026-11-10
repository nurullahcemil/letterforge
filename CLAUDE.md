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
- three.js 0.187 viewer (`src/viewer.ts`). qrcode, fflate (3MF zip).
- Fonts: 7 bundled @fontsource WOFFs (latin + latin-ext fallback for Turkish etc.),
  Google Fonts via Fontsource CDN, user uploads (TTF/OTF/WOFF, not WOFF2).
- Saved designs: IndexedDB in the browser (`src/store.ts`). Hash routes `#/`, `#/new/<style>`, `#/d/<id>`.

## Commands
```bash
npm install
npm run dev            # local dev
npx tsc --noEmit -p .  # typecheck
npx vite build
npx tsx scripts/smoke.ts   # builds every style in Node, prints parts/tris/size/warnings
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

## Lamp style
Mushroom table lamp for an E27 lamp kit, modelled on a stacked "Pilzlampe" the user showed.
`src/lamp.ts`: shade outline (r,z) of stacked cone tiers → rounded with offset tricks → wall →
revolve → hub ring + spokes at the bottom → warp for plan shape (corners), twist and surface
pattern (pattern follows distance along the outline, so dots keep their size on slopes).
Base: hollow, 45° roof to the socket hole, feet notches, cable notch. Never bed-split.
Check: `npx tsx scripts/lamp-check.ts '{"shTiers":4}'` (status, pieces, volume).
Next idea: the wavy ribbed lamp in `docs/ROADMAP.md`.
