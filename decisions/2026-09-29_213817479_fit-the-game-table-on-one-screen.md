+++
schema_version = 1
id = "01M3QHNAR74HRJHGXGWT9W82MP"
title = "Fit the game table on one screen"
date = "2026-09-29"
status = "proposed"
tags = ["design", "layout", "mobile"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

Size the game table to the screen instead of letting it scroll. The bar, the other players, the
prompt and the piles take the space they need; the player's own grid gets the rest and is sized by
height as well as width (a CSS size container on `section.mine`). Layouts by screen:

- Phones upright: the prompt beside the piles, other players in one swipeable row that scrolls to
  whoever's turn it is, the grid below.
- Phones sideways (height up to 500px): everything else on the left, the grid in its own column.
- Tablets and desktops (700px wide and more): the piles beside the grid; from 1200px the scores
  get their own column, below that they open as a panel.

Below a minimum grid height the page scrolls again rather than shrinking cards further.

## Context

Niklas asked for Shoalow to be playable on iPhone and iPad. Before this change, an iPhone needed
scrolling between the piles and the player's own cards on every turn, and a landscape iPad could
not show the piles and the grid together. Keeping the stacked layout and only shrinking pieces
was considered, but upright phones cannot fit a full-width grid below the piles, and the
sideways-phone layout needs a separate column anyway.

WebKit tests for iPhone and iPad, upright and sideways (`apps/web/e2e/mobile.spec.ts`), assert
that the grid, the piles and the prompt are all on screen at once.

## Consequences

A turn never requires scrolling on the tested iPhone and iPad sizes, and the grid grows when the
browser toolbar hides or Shoalow runs from the home screen.

On short desktop windows, cards are smaller than before. At 1440×900 player cards are about 100px
wide instead of at least 120px; the geometry test now expects at least 95px and checks that the
grid fits on the screen. Layout changes elsewhere on the table (a taller prompt, a coach tip, more
opponent rows) change the grid size, so those areas keep fixed heights to stop the cards moving
between turns.
