+++
schema_version = 1
id = "01M3Y3MEAPZ93EMEHEZKAC14BG"
title = "Let the host hide running sums"
date = "2026-10-02"
status = "accepted"
tags = ["gameplay", "settings"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

The host can choose in the lobby whether the table shows running sums. A running sum is what a
player's face-up cards add up to during a round. With sums hidden, the server sends `null`
instead of each board's sum, so no client receives the number. Players have to count. The
choice is a game setting (`Settings.showSums`, default on). Only the host can change it, and
only in the lobby, so it stays fixed for a game.

Hidden sums cover only the live count. Each finished round's scores and the running totals stay
visible, as they would on a paper score sheet. Bots add up face-up cards themselves and play the
same either way.

## Context

On 2026-10-02 Niklas asked for a lobby option to show no sums during the game, because counting
is a strategic part of playing. Which sums to hide was decided while implementing that request.
The counting that matters happens during a round. Totals are written down between rounds in the
physical game, so hiding them would make the game harder to follow without adding to that skill.

Omitting the sum from the view is cleaner than hiding it in the interface, but it is not a
secret. Face-up card values remain public, and anyone can add them up.

## Consequences

- `BoardView.visibleSum` is `number | null`; the interface shows nothing when it is `null`.
- Snapshots saved before this setting load with sums shown.
- Engine, room, simulation and browser tests cover the setting. Bots play identical games with
  sums shown or hidden.
