+++
schema_version = 1
id = "01M3PTW17N94KRSJX7NC5B3ASJ"
title = "Persist games in SQLite on a single Fly.io machine"
date = "2026-09-29"
status = "accepted"
tags = ["persistence", "deployment"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

Keep game state in memory on one Fly.io machine and save every accepted move to SQLite
(`bun:sqlite`) on a 1 GB volume: a room snapshot plus an append-only message log, in one
transaction. Deploy with `fly deploy --ha=false` so there is exactly one machine.

## Context

Niklas chose on 2026-09-29 that unfinished games must survive the machine auto-stopping when
everyone leaves, over the simpler memory-only option. Fly stops the machine only when no
connections remain; WebSockets count as connections because `http_service.concurrency.type` is
`connections`.

## Consequences

- A second machine would split rooms between processes, so do not scale horizontally without
  moving state to shared storage first.
- Restarts resume games exactly, including pending bot turns; the server end-to-end test restarts
  mid-game to prove this.
- Rooms idle for 30 days are deleted. The volume costs roughly $0.15 per month.
