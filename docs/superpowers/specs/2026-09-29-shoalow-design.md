# Shoalow design

Date: 2026-09-29. Status: approved in conversation.

## Purpose

Shoalow is a browser card game that Niklas plays with colleagues. It follows the rules of the
card game Skyjo, but it has its own name, deep-sea theme, artwork, colors and rules text, so it
does not reuse the original's protected expression. Game mechanics are not protected; the name,
art, trade dress and rulebook wording are, so all of those are new.

Success means 2 to 10 people (plus optional bots) can open a link, sit down, play complete
games with automatic scoring, see everyone's board in real time, and come back later to an
unfinished game.

## Rules

- **Deck (150 cards):** 5 × −2, 10 × −1, 15 × 0, and 10 each of 1 to 12.
- **Setup:** each player receives 12 face-down cards in a grid of 3 rows and 4 columns. The next
  card starts the discard pile face up. Every player reveals 2 of their cards; this happens
  simultaneously and the game waits for everyone.
- **Starting player:** in round 1, the highest total of the two revealed cards starts. A tie goes
  to the earliest seat. In later rounds, the player who ended the previous round starts.
- **Turn:** either
  - take the top discard and swap it with any card of your grid (face up or down), or
  - draw from the draw pile, then either swap it in, or discard it and reveal one of your
    face-down cards.

  A replaced card goes face up onto the discard pile.
- **Columns:** when a column's three cards are face up and equal, the column goes to the discard
  pile. This also applies to the final reveal at the end of a round.
- **Round end:** when a player has no face-down cards left, every other player gets exactly one
  more turn. Then all cards are revealed and each player's remaining cards are added up. If the
  player who ended the round does not have the strictly lowest score and their score is positive,
  it is doubled.
- **Game end:** after a round in which any player reaches the target score (100 by default,
  set by the host), the lowest total wins. Tied players share the win.
- **Empty draw pile:** all discards except the top card are shuffled into a new draw pile.

Rule variants are out of scope, but settings live in one object so that variants can be added
later.

## Architecture

A Bun workspace with three packages:

```text
packages/game/  pure TypeScript: rules, bots, protocol types, seeded random numbers
apps/server/    Bun.serve: HTTP, WebSocket, rooms, SQLite persistence, bot scheduling
apps/web/       Svelte 5 + Vite: lobby, table, scoreboard, artwork
```

### Game package

- `applyAction(state, playerId, action)` is pure. It returns the next state and a list of events,
  or an error that explains why the move is illegal.
- Shuffling uses a seeded generator whose state is part of the game state, so a game is fully
  reproducible from its seed and action log.
- `viewFor(state, playerId)` builds what one seat is allowed to see: no values for face-down cards
  or the draw pile. The server only ever sends views.
- The card in hand (drawn from the pile) is visible to everyone, as at a real table.
- Bots implement `chooseAction(view, level)` and receive the same limited view as humans.
  - **Easy** plays random legal moves with a mild preference for low cards.
  - **Normal** takes low discards (≤ 3) or column-completing ones, otherwise draws and replaces
    its worst card. It discards high draws to reveal a card, and avoids ending the round unless
    it expects to have the lowest score. Once a round has lasted more than 20 turns per player,
    it stops avoiding the end, so a table of bots always finishes.

### Server

- **Rooms** have a 5-character code (no ambiguous letters) and a shareable link. The creator is
  the host.
- **Lobby:** the host adds or removes bots (Easy or Normal), sets the target score and starts the
  game. There are 2 to 10 seats, and nobody can join once the game has started.
- **Identity:** joining issues a random seat token that the browser stores. Reconnecting with it
  restores the seat. There are no accounts.
- **Messages:** after every accepted action, the server sends each connected socket its own seat's
  view plus events for animation. Views differ per seat, so there is no shared pub/sub topic.
- **Bot turns** run after a delay of about 1 second, through the same code path as human actions.
- **Absent players:** the host can hand an absent player's seat to a bot. The player takes the
  seat back by reconnecting.
- **Persistence:** SQLite (`bun:sqlite`) at `DATA_DIR/shoalow.sqlite`. Every accepted action is
  appended to a log, and a room snapshot is saved in the same transaction. Unfinished rooms load
  at startup, and rooms idle for more than 30 days are deleted.
- **Validation:** all incoming messages are checked against a schema before reaching the engine.
- **Heartbeat:** the server sends a ping every 25 seconds.

### Web client

- **Screens:** home (create or join, name remembered), lobby, table, round summary, game over
  (play again with the same seats), rules.
- **Table (layout A):** your grid large at the bottom, the draw and discard piles in the middle,
  opponents as small boards across the top that wrap or scroll. Tap a board to enlarge it.
- **Interaction:** everything is by tapping; legal targets are highlighted and everything else is
  dimmed. Other players' turns show a banner, and when a player ends the round a final-turn
  banner appears.
- **Scores:** a live sum of face-up cards on every board, plus a scoreboard panel with every
  round's score and the running totals.
- **Animations:** card flips, card moves and column clears. They are turned off when the device
  asks for reduced motion.
- **Background tabs:** a tab hidden for more than 10 minutes closes its socket and reconnects
  when it becomes visible again, so forgotten tabs do not keep the Fly machine awake.
- **Artwork:** original flat SVG in the flat and bold style. Solid value-band colors: lilac pearl
  for −2 and −1, sand for 0, sea-glass teal for 1 to 4, amber for 5 to 8, coral for 9 to 12. Each
  card has a white creature:

  | Value | Creature |
  | --- | --- |
  | −2 | pearl clam |
  | −1 | conch |
  | 0 | starfish |
  | 1 | krill |
  | 2 | shrimp |
  | 3 | seahorse |
  | 4 | jellyfish |
  | 5 | octopus |
  | 6 | sea turtle |
  | 7 | crab |
  | 8 | pufferfish |
  | 9 | lionfish |
  | 10 | moray eel |
  | 11 | shark |
  | 12 | grumpy anglerfish |

  There is also a card back and a logo.

Out of scope for now: chat, sound, accounts, spectators, rule variants.

## Tooling and testing

- mise pins Bun and defines the tasks `dev`, `test`, `check`, `sim`, `build`, `e2e`, `deploy`
  and `clean`.
- TypeScript runs in strict mode, with `svelte-check` and Biome.
- **Rules unit tests** cover every rule and edge case.
- **Deterministic simulation** plays seeded bot games with 2 to 10 players and checks these
  invariants: card conservation, no hidden information in views, score arithmetic, termination,
  and that replaying the log reproduces the snapshot. A small set runs in `check`; a large set
  runs in `sim`.
- **Server end-to-end:** real WebSocket clients play a game, and the server restarts mid-game to
  verify that the game resumes.
- **Browser smoke test:** Playwright plays a round with two tabs and a bot.
- **CI:** Dagger with the Dang SDK runs `mise run check`.

## Deployment

- **Fly.io app `shoalow`:** one Docker image (`oven/bun`) serves the static client, `/ws` and
  `/healthz`.
- **Machine:** `auto_stop_machines = "stop"`, `auto_start_machines = true`,
  `min_machines_running = 0`, exactly one machine in `fra` (shared-cpu-1x, 256 MB), and a 1 GB
  volume mounted at `/data`.
- **Deploys** run manually with `mise run deploy`.
- **Repository:** `niklas-heer/shoalow`, public, MIT license.
