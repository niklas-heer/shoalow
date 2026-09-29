# Sculpted paper creature artwork

Niklas selected **B3 — Sculpted paper-cut** after two comparison rounds on
2026-09-29. [The chosen reference](sculpted-reference.png) preserves that direction.
Only its creature artwork is used as the reference; the game retains its existing
SVG card frames, numbers, labels and card backs.

The built-in imagegen tool generated the fifteen-creature atlas, then corrected
its spacing. The final transparent PNG is
[`creatures-sculpted.png`](../../apps/web/src/assets/creatures-sculpted.png).
It is a five-column, three-row atlas ordered by card value, -2 through 12,
left to right and top to bottom. `Creature.svelte` selects one cell with a nested
SVG viewport. Vite fingerprints the shared asset for caching; small opponent
cards retain their large numbers.

## Generation prompt

Use case: stylized-concept. Asset type: production transparent sprite atlas for Shoalow playing-card animal illustrations.
Input image 1 is the user's selected B3 sculpted paper-cut reference. Match its sophisticated folded-paper volume, rich organized contact shadows, cream accents, restrained tactile fibers, graceful observed animal forms and approachable eyes. Use the animal illustrations as the style reference only; OMIT ALL cards, borders, numerals, captions, circular backdrops and navy background.
Create exactly FIFTEEN separate complete animal cutouts on a genuinely transparent canvas, arranged in a STRICT equal-cell 5-COLUMN by 3-ROW GRID. Each of the 15 cells has exactly one creature centered, entire silhouette fully visible with 12% empty padding on every edge. Equal-sized invisible cells; no dividers. Wide landscape atlas, width to height ratio 5:3. Every creature must stay inside its own cell including tentacles, antennas, fins, tail and lure; no overlaps. Each animal fills its cell as much as its proportions allow. No text anywhere.
Exact cell order left to right:
ROW 1: (1) open lavender pearl clam with luminous ivory pearl, (2) ivory and pale peach spiral conch shell with its opening visible, (3) warm peach five-armed starfish with natural tiny bumps, (4) pale translucent mint-and-ivory slender krill with black eyes and delicate long antennae, (5) coral-orange curved shrimp with segmented abdomen, tail fan and antennae.
ROW 2: (1) golden orange seahorse with folded ridges and curled tail, (2) mint-and-ivory flowing jellyfish with a domed bell and long elegant ribbon tentacles, (3) burnt orange octopus with eight curling arms and cream suckers, (4) teal sea turtle swimming diagonally with patterned shell and four flippers, (5) warm coral crab with two clearly visible claws and legs.
ROW 3: (1) golden round pufferfish with small spines and cream belly, (2) terracotta-and-ivory striped lionfish with striking fan fins and dorsal spines, (3) moss-and-teal moray eel with a long curved sinuous body and its recognizable broad head, (4) slate-blue shark with ivory underside, prominent dorsal fin and forked tail, (5) deep navy anglerfish matching reference B3 with sculpted fins, large open toothed mouth and arched lure tipped with an ivory glowing bulb.
Lighting: consistent soft light from upper left, paper-layer contact shadows belonging to the creature only. Full silhouettes on transparency, no ground shadows or background glow. Preserve subtle craft detail in large coherent shapes readable at 120px. No realistic ocean, bubbles, props, lettering, logos, watermarks or missing cells.

## Spacing correction prompt

Use case: precise-object-edit. Edit target: input image 1, the transparent 15-creature paper-cut atlas. Change ONLY placement and scale: preserve all fifteen animal identities, poses, paper-cut styles, colors, anatomical details, expressions and their row/column order exactly. The current creatures are too close to adjacent cells and canvas edges. Rearrange them into a mathematically regular five-column three-row sprite atlas with equal square cells on a wide landscape 5:3 canvas. Shrink each creature to occupy at most 70% of its own cell's width AND height, centered exactly in the cell, leaving at least 15% of each cell empty on ALL FOUR sides. Especially contain long shrimp antennae, octopus arms, jellyfish ribbons and anglerfish lure wholly in their cells. There must be transparent gutters separating every silhouette by at least 30% of one cell dimension. No artwork touches any grid boundary or canvas edge. All 15 complete animals must be visible. Keep genuine transparency, no backgrounds, ground shadows, grids, labels, numbers or text. This is a spacing correction for safe sprite clipping, not a style change.
