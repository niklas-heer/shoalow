# Shoalow

A deep-sea card game for 2 to 10 players in the browser, with optional bots. Everyone keeps a
hidden grid of twelve cards and tries to finish with the lowest score: pearls are worth −2, the
grumpy anglerfish costs 12, and three equal cards in a column vanish.

Shoalow plays by the rules of the card game Skyjo, which I wanted to play online with colleagues.
It is an independent fan project, not affiliated with Magilano or its publishers. The name, the
artwork, the colours and the rules text are all original. Only the game mechanics, which are not
protected, are shared.

## Play

Open the site, enter your name and create a table. Share the link or the five-letter code. The host
adds bots if wanted (Easy or Normal), picks the target score and starts. Your seat is remembered in
the browser, so a refresh or a locked phone puts you straight back into the game. If someone has to
leave, the host can let a bot play their cards until they come back.

The in-game rules page explains everything; the short version:

- On your turn, take the top discard or draw from the pile, then swap the card into your grid. A
  drawn card can instead be dropped on the discard pile, in which case you turn over one of your
  face-down cards.
- A column of three equal face-up cards is cleared.
- When someone has turned over every card, everyone else gets one more turn. If the player who ended
  the round doesn't have the lowest score on their own, and it's above zero, it counts double.
- The game ends after a round in which someone reaches 100 points (the host can change this). The
  lowest total wins.

## Develop

Tools are pinned with [mise](https://mise.jdx.dev/): Bun 1.3 for everything, Dagger for CI.

```sh
mise install
mise run install    # bun install
mise run dev        # game server on :3000 and Vite on :5173
mise run check      # Biome, TypeScript, svelte-check, all tests
mise run e2e        # Playwright: two browser sessions and a bot play a round
mise run sim        # 5000 seeded bot games checking every invariant
mise run ci         # the CI pipeline, locally in Dagger
```

The code is a Bun workspace:

| Path | What it does |
| --- | --- |
| `packages/game` | Pure TypeScript rules engine, per-player views, bots, message types. No I/O. |
| `apps/server` | `Bun.serve` with a small HTTP API, WebSockets, bot turns and SQLite persistence. |
| `apps/web` | Svelte 5 client with the card artwork. |

The engine is deterministic: a game is its seed plus its action log. `viewFor(state, seat)` strips
every face-down value before anything leaves the server, so browsers never receive hidden cards. The
simulation test plays thousands of seeded games and checks card conservation, view secrecy, score
arithmetic, termination and exact replay after every move. A failure prints the command that
replays exactly that game.

## Deploy

Shoalow runs on a single [Fly.io](https://fly.io) machine that stops when nobody is connected and
starts again on the next visit. Games are saved to SQLite on a volume after every move, so an
unfinished game survives the machine stopping. Tables without play for 30 days are deleted.

```sh
fly apps create shoalow
fly volumes create shoalow_data --region fra --size 1 --yes
mise run deploy     # fly deploy --ha=false
```

Keep it to one machine: game state lives on that machine's volume.

## License

[MIT](LICENSE)
