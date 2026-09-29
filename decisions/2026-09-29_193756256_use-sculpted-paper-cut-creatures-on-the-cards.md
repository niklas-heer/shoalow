+++
schema_version = 1
id = "01M3QARYS0N3HNQQ80NXYCWRNN"
title = "Use sculpted paper-cut creatures on the cards"
date = "2026-09-29"
status = "accepted"
tags = ["design", "artwork"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

Use the B3 sculpted paper-cut direction for all fifteen Shoalow creatures. Keep
the established card frames, colors, numerals, labels and backs, and the larger
player layout. Store the transparent artwork in the repository and keep small
opponent cards focused on large numeric values.

## Context

Niklas liked the card design but disliked the original animal illustrations.
After comparing painted, paper-cut and natural-history directions, he chose
paper-cut, then explicitly selected “B3 — Sculpted” in the refinement round on
2026-09-29. This is his accepted visual direction, rather than an inferred choice.

The [selected reference and generation prompts](../docs/art/README.md) preserve
the style for future illustrations. A single transparent atlas contains all
fifteen creatures; the game draws individual cells inside its existing SVG cards.

## Consequences

The creatures have consistent paper depth and texture. Numbers remain SVG text,
so their readability and the stable card geometry do not depend on raster art.
One shared image is loaded and cached rather than fifteen separate downloads.

The illustrations are raster assets rather than editable vectors. Changes to
individual creatures require a matching generated revision and visual review;
atlas spacing and species order must be checked before replacing the artwork.
