+++
schema_version = 1
id = "01M3Y7NH0X5ZMQYY7R1DVG1BNX"
title = "Let the host choose what the piles show"
date = "2026-10-02"
status = "accepted"
tags = ["gameplay", "settings"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

In the lobby, the host chooses what the piles show for the whole table:

- **Top cards:** only the top card of each pile, as at a real table. No pile sizes reach the
  browser, and reshuffle events arrive without their size.
- **Counts:** both piles show how many cards they hold. This is the default, and what earlier
  tables had.
- **Everything:** counts, plus a viewer that lists every card in the discard pile with a tally
  per value.

At every setting, the draw pile is marked "New pile" when it was made from the shuffled discards,
with a count of how many times that happened this round. The game menu shows the deck size. The
choice is fixed for the game, like running sums.

## Context

On 2026-10-02 Niklas asked for the piles' contents and counts to be visible and for reshuffles to
be marked. Asked how much to show, he decided that each table should choose, because these are
strategic choices. Some groups want to count hard, while others want to rely on intuition or just
have a nice time.

The server enforces the choice by leaving the data out of views and events, so hiding it is not
cosmetic. The discard pile only ever holds cards that were face up for everyone, so showing it
reveals nothing secret. A reshuffle is visible at a real table, so it is always marked.

## Consequences

- `GameView.drawCount` and `discardCount` are `number | null`; `discards` is `number[] | null`.
  `legalActions` decides whether the discard can be taken from `discardTop`, not the count.
- `eventsFor` removes the reshuffle size from events at top-cards tables before they are sent.
- Games saved before this change show counts.
- Engine, room, simulation and browser tests cover all three settings.
