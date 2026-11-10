# Roadmap / open items

## Next: parametric wavy lamp / vase (requested, not started)
Reference: a tall lamp shade made of vertical ribs that wave sideways along the height
(sinusoidal fins, star-like cross-section, bulging middle), printed in vase mode with
translucent PLA over an LED.

Suggested approach (fits the existing stack):
- New style `lamp` (or a separate "Objects" section), not text-based.
- Build as a single surface mesh directly (positions/indices) like `facet` raw meshes:
  radius r(θ, z) = profile(z) · (1 + ribDepth · wave(N·θ + twist(z) + amp·sin(2π·freq·z/H))).
- Settings: height, base/top/max diameter + profile shape (vase curve control points),
  rib count, rib depth, rib sharpness (sine ↔ pointed), wave amplitude, wave frequency,
  twist, phase, bottom thickness, open top, wall for vase mode (single wall, export as
  closed solid; tell user to enable "Spiral vase" in Bambu), LED hole diameter in the base,
  optional cable notch, resolution.
- Presets: Wavy, Twisted, Bubble, Star.
- Check printability: overhang angle warning, minimum radius > 0, max size vs bed.

## Other open items
- 3MF: decide whether to drop `paint_color` or `m:colorgroup` so Bambu shows exactly 2
  filaments (currently can show 4).
- Optional: show the colour-change height next to downloads for single-STL two-tone prints.
- GitHub repo + Vercel Git integration (see DEPLOY.md).
- `style6.css` contains unused letter-chip styles from an earlier UI (harmless).
