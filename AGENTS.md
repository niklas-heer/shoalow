# Shoalow

A browser card game for 2 to 10 players: Bun and TypeScript throughout, a pure rules engine in
`packages/game`, a `Bun.serve` server with SQLite in `apps/server`, and a Svelte 5 client in
`apps/web`. `README.md` explains the layout, setup and deployment.

## Checks

- `mise run check`: Biome, TypeScript, svelte-check, and all unit, simulation and server tests.
- `mise run e2e`: Playwright in Chromium and WebKit.
- `mise run sim`: the long seeded simulations. A failure prints the command that replays it.
- `mise run ci`: the full CI pipeline in Dagger, including a smoke test of the production image.

## Boundaries

- Views must never contain hidden information: face-down cards, the draw pile or the deck key.
  The server sends only what `viewFor` and `eventsFor` allow.
- Deploy only when asked (`mise run deploy`), and keep it to one Fly.io machine.
- Record consequential choices with `vrdx` in `decisions/`.

## Change notes

Every change a player could notice gets a note on the What's new page, in the same commit. Use
the `updating-change-notes` skill (`.agents/skills/updating-change-notes/SKILL.md`).
