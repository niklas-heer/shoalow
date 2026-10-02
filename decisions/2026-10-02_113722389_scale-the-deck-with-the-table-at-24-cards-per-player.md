+++
schema_version = 1
id = "01M3Y6F5PNG6T2BXN01NMXP8BK"
title = "Scale the deck with the table at 24 cards per player"
date = "2026-10-02"
status = "accepted"
tags = ["gameplay", "fairness", "engine"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

The deck grows with the table: 24 cards per player, from 48 for two players to 240 for ten. Every
size keeps the boxed mix of 1 × −2, 2 × −1, 3 × 0 and 2 of each value from 1 to 12 per 30 cards.
Multiples of 30 match it exactly. For other sizes, each value gets its exact share rounded down,
and the leftover cards go to the values that lost the most in rounding, keeping the deck's average
closest to the box's. No value is ever off by a whole card. A game records its `deckSize`; games
saved before this change have none and keep 150 cards.

## Context

On 2026-10-02 Niklas asked for the deck to scale with the number of players, now that a browser
can deal any number of cards. He wants reshuffling to be a real mechanic at every size. It should
kick in eventually but not too soon, because a fresh draw pile made from the high-card-heavy
discards can widen the gap between players. It should also not be something small tables never
see.

`packages/game/scripts/deck-calibration.ts` played 250–300 bot rounds per table size and deck size
on 2026-10-02:

| Deck | 2–5 players | 6 players | 8 players | 10 players |
| --- | --- | --- | --- | --- |
| Boxed 150 | never runs out | 32% of rounds, 92% through | every round, 59% through | every round, 29% through |
| 22 per player | 82–94% of rounds, about 76–84% through | | | |
| 24 per player | 45–56% of rounds, 85–93% through | | | |
| 25 per player | 24–41% of rounds, 86–95% through | | | |

The scaled rows hold for every table size from 2 to 10. Rounds last about 14 turns per player at
any size, so deck size per player sets the behavior. 24 per player gives the "eventually, late"
feel at every size. 25 would be closer to the boxed game at six players, with reshuffles rarer.
Bots stand in for people, so real tables may differ somewhat.

## Consequences

- Small tables now see reshuffles, and remembering cards matters more with a 48-card deck.
  Big tables no longer reshuffle a third of the way into every round.
- The practice game's teaching seed moved to 21, now in `apps/web/src/lib/coach.ts`, and a test
  checks that it deals its teaching hand.
- Card conservation in the simulations checks each game against its own deck.
- The rules page explains the scaling and shows the mix per 30 cards.
