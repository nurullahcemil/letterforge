# Candle & mold style — build plan (user: "All at once")

User sent photos: two-part candle mold of a tiered faceted tree (block halves, corner bolt holes,
side slots), pleated ball (sharp meridian pleats, some twisted), cylindrical mold split along a
zigzag "crown" that follows the pleats, pleated drop ornament (wavy rim, two cones, neck for a cap).
Build our own parametric shapes (never copies of those designs).

## New style `mold` (no text, like `lamp`) — `src/mold.ts`, `Builder.mold()`
Params (prefix `mold`):
- moldShape: 'tree' | 'ball' | 'drop' | 'gem' | 'pillar'
- moldH (height, 90), moldD (diameter, 70), moldSides (facets/pleats; tree 8, ball 14, drop 16,
  gem 10, pillar 12), moldDepth (pleat depth mm; tree 0, ball 5, drop 4, gem 0, pillar 3),
  moldTwist (deg over height, 0), moldTiers (tree, 3), moldShrink (tree %, 30), moldBaseRings (tree)
- moldKind: 'two' (two-part block) | 'zigzag' (pleat-following split, round mold) | 'open' (cup)
- moldWall (6), moldWick (Ø 2.5, 0 = none), moldPour (sprue Ø 14 for shapes without a flat end),
  moldPins (bool), moldBolts (bool, Ø 4.5, corners), moldBands (band grooves), moldZig (mm)
- moldShow: 'all' | 'shape' | 'mold'

## Shape = lathe mesh built directly (star-shaped around z)
Profile = list of (z, r) samples (duplicate z with two r for tree ledges). Each ring = 2n points:
even k at angle kπ/n radius r (pleat ridge), odd k radius r − depth·r/rMax (valley); depth 0 gives
inner = r·cos(π/n) → plain facets. Ring angle + twist·z/H. r≈0 → single pole vertex; else flat cap
fan to centre. Build Mesh (vertProperties, triVerts) → new Manifold; if volume < 0 flip triangles.
Profiles: pillar (cylinder), ball (sphere, poles), drop (cone up to rim at 0.45H, cone to neck,
neck cylinder r≈4 h≈5 for an ornament cap), gem (pavilion apex → girdle 0.55H → table 0.55R flat),
tree (base cylinder 0.12H r 0.62R with 2 grooves; tiers: bottom R(1−s)^i, top 0.45 of that, next
tier starts at previous top → ledge; last tier to apex).

## Molds
- Orientation: pour end up. Tree flipped (base up, tip down = wick). Gem table up, drop neck up,
  pillar top up, ball: sprue cylinder Ø moldPour from top pole to block top (+wall).
- 'two': block (rounded/chamfered rect cross-section extruded) X = 2R + 2wall (+12 each side with
  bolts), Y = 2R + 2wall, z −wall..H (+wall if sprue). Minus cavity + wick cylinder on axis through
  the bottom. Split at y=0 → half A (y<0), half B (y>0). Pins on A's face (Ø5, 4 long, asymmetric:
  (+x, 0.2H) and (−x, 0.8H)), sockets in B (Ø5.4, 4.4 deep). Bolt holes along y at the 4 corners.
  Band grooves around outside at 0.3H/0.7H (6 wide, 2 deep). Warn if pleats deep (undercut near
  split) → suggest 'zigzag'.
- 'zigzag': cylinder mold radius R+wall; lower region = solid whose top surface is a fan from the
  axis at zEq (z of widest radius) to the rim at zEq + moldZig·tri(n·θ + twist(zEq)) (ridges aligned
  with pleats); lower = mold ∩ region, upper = mold − region. Pour sprue top, wick bottom.
- 'open': one cup; check r(z) non-decreasing toward the opening, else warn "will get stuck".
- Print layout: half A rotate [90,0,0], half B [−90,0,0] (parting face up, back on the bed, cavity
  open upward = no supports); zigzag upper flipped 180° about X. Shape standing upright beside them.
  Parts: 'Shape' (colorB), 'Mold half A/B' or 'Mold bottom/top' (colorA); 3MF separate objects.
- Warnings/notes: wax use ≈ volume·0.9 g/cm³; PLA softens ~55–60 °C → pour wax ≤ 60–65 °C or print
  PETG/ABS; use release spray. "Shape only" export as a master for silicone casting.

## UI (main.ts)
PRESETS/ICONS/STYLE_CONTROLS entry 'mold' ("Candle & mold"), hide text/size/backing/letter-style
sections like the lamp (grep `'lamp'`), colour labels ['Mold', 'Candle'], filters per shape/kind.
Smoke case + scripts/mold-check.ts (validity, volume, halves fit together, cavity matches shape).
