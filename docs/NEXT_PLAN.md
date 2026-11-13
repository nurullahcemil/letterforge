# Next four styles (user photos, "build all four"; own designs, never copies)

1. `flower` — Letter flower: each letter of the text (optionally repeated to fill the circle) stands
   with its bottom toward the centre, turned so its top points outward, evenly spaced around; all
   extruded `flDepth` deep and joined by a hub disc. Params flRadius (inner radius), flDepth,
   flHub, flFill (repeat text to fill), flCount. Prints face down, one colour.
2. `arrow` — Shaped sign: board (arrow / turn arrow / rect / rounded / circle; direction) around the
   text + margin; on it a "shadow" layer = letters swept toward a direction (block-letter side,
   colour B) and the letters on top (colour C). Multi-line text ("F\nU\nN" = stacked).
   Params arShape, arDir, arMargin, arBoard, arShadowLen, arShadowAng, arShadowT, arLetterT, colorC.
3. `pyramid` — Pyramid-tile letters: letter outline cut into a square grid; every cell gets a pyramid
   or a wedge sloping one of 4 ways (random by seed, mix %), clipped by the letter, on a base slab.
   Params pyCell, pyHeight, pyBase, pyMix (pyramids vs wedges), pySeed, pyRotate (45° grid).
4. `tile` — Tile mold (no text, src/tiles.ts): 8-point stars + crosses that tile together.
   Stars at lattice points i+j even (spacing L): star = square half-side L/2 ∪ same turned 45°;
   cross = diamond |x−L|+|y| ≤ L minus the 4 neighbour stars. Make: tray mold (cavities with draft,
   walls between), master (positive tiles on a plate for silicone), cutter (clay cutter walls).
   Params tlSize, tlThick, tlStars, tlCrosses, tlWall, tlDraft, tlMake.
