# Letterforge

Type a word and turn it into a 3D-printable object, right in the browser. You get a live 3D preview and can download an **STL** or a multi-part **3MF**.

## Styles

| Style | What it makes | How it works |
|---|---|---|
| **Table sign** | Standing letters on a bar or a flat plaque, with an optional QR-code tile | Text extruded, unioned with a base; QR modules raised as a separate part (two colours via filament swap or AMS) |
| **Planter letters** | Hollow channel letters to fill with moss or plants | Outline offset inward to make a wall, plus a floor; large letters auto-split to fit the bed |
| **Topographic** | Stacked contour layers that step into (bowl) or rise out of (mountain) the letter | Repeated inward offsets with seeded noise wobble; each layer is its own part with a colour gradient |
| **Faceted** | Low-poly "papercraft" letters with roof ridges | CGAL straight skeleton (WASM) turns each outline into a hip roof on top of a straight side wall; optional flat-top cap |

All geometry runs client-side in a Web Worker. Nothing is uploaded.

## Stack

- [opentype.js](https://github.com/opentypejs/opentype.js): font parsing and glyph outlines (bundled OFL fonts, or upload TTF/OTF/WOFF)
- [manifold-3d](https://github.com/elalish/manifold) (WASM): 2D offsets/booleans (Clipper2) and watertight 3D CSG
- [straight-skeleton](https://github.com/StrandedKitty/straight-skeleton) (CGAL → WASM): faceted roofs
- [three.js](https://threejs.org): preview
- [qrcode](https://github.com/soldair/node-qrcode), [fflate](https://github.com/101arrowz/fflate): QR matrices and 3MF zipping

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run smoke      # generate every style in Node and write STL/3MF files to ./out
```

## Notes on the exports

- **3MF** contains one object made of several parts (letters, layers, QR code, plaque). In PrusaSlicer, Bambu Studio or Orca you can give each part its own filament.
- **STL** is a single body (all parts unioned).
- Coordinates are millimetres, Z up, already oriented for printing (signs print lying on their back).

## Ideas for later

- Alignment pegs/dowel holes on split pieces
- Papercraft net (SVG) export for the faceted style
- Keyhole / screw mounts for wall letters
- Shareable URLs for designs
