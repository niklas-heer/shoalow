+++
schema_version = 1
id = "01M3Y609437YNKN5BS383T6HDC"
title = "Shuffle with ChaCha20 keyed from the system's secure random source"
date = "2026-10-02"
status = "accepted"
tags = ["fairness", "security", "engine"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

Shuffle decks with ChaCha20 (RFC 8439), keyed by 256 bits from the platform's secure random
source (`crypto.getRandomValues`). The key is part of the game state on the server and never
appears in a view. Fisher–Yates picks each position by rejection sampling, so every order of the
deck is exactly equally likely. The engine stays deterministic: a game is still its key plus its
action log, so simulations and replays work as before. A numeric seed is stretched into a key for
tests and the practice game.

Bots keep using the small Mulberry32 generator, since their choices need no secrecy.

## Context

On 2026-10-02 Niklas asked whether the game's randomness was as good as it could be. It was not.
Each deck came from Mulberry32, whose whole state is one 32-bit number, seeded by `Math.random`
with 31 bits. So at most about 2 billion decks could ever be dealt.

Worse, the deal could be predicted. Knowing the discard and a few face-up cards, a player could
search every possible state in minutes and then know every face-down card and the order of the
draw pile.

The engine is pure TypeScript and also runs in the browser for the practice game, so it needs a
synchronous generator with no I/O. ChaCha20 is a small, well-studied cipher with a published test
vector. AES-CTR or HMAC-DRBG would be equally sound but need asynchronous Web Crypto in the
browser.

## Consequences

- Games saved before this change keep a numeric `rng`, and their reshuffles use the old generator,
  so a restored game continues exactly. Only new games use ChaCha20.
- The practice game uses a fixed seed for its teaching hand. That seed changed from 33 to 3, so the
  same opening is dealt: a 0 on the discard pile and two 0s in the player's grid.
- Tests check the RFC 8439 vector, that shuffles repeat for the same key and differ across keys,
  and the position distribution (chi-square over 24,000 shuffles). They also check that legacy
  games continue unchanged and that the key never reaches a player's view.
