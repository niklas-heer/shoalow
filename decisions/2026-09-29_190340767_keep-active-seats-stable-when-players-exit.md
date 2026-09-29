+++
schema_version = 1
id = "01M3Q8T7EZ41H9YHYPMJM97KNK"
title = "Keep active seats stable when players exit"
date = "2026-09-29"
status = "accepted"
tags = ["gameplay", "lifecycle"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

While a game is active, an explicit exit permanently replaces the departing human seat with a
normal bot. Keep the board index and turn order, rotate the seat token to revoke its connections,
and transfer hosting to the next remaining human when the host exits. Delete the table when no
humans remain. Closing or refreshing a browser continues to preserve its reconnectable seat.

Stopping is a separate host-only action: clear the current game and return the existing seats
and settings to the lobby. The interface explains the score reset and asks the host to confirm
it. Clear temporary bot takeovers when returning to the lobby.

## Context

On 2026-09-29 Niklas requested the ability to stop and exit games as part of improving the
player experience. These lifecycle details were chosen under that implementation authority.
Previously, leave was refused during play and the host had to manually cover absent players.

Removing a live seat would change board indices, scoring arrays and turn order. Replacing it
with a bot lets the others keep playing through the existing engine. Stopping separately lets
the group change the score goal or players without abandoning its shared table code.

## Consequences

An explicit exit gives up the seat. That player can join again only after the table returns to
the lobby, while a browser disconnect remains recoverable. The departed player's name remains
on the bot seat; the lobby host may remove it before a new game.

The server persists these actions through its existing snapshot and message log. Room and
WebSocket tests cover board preservation, token revocation, host transfer, stop authorization,
and restart after stopping. Browser tests cover goal selection, stop/restart, and host exit.

Sources: [room lifecycle](../apps/server/src/room.ts), [WebSocket tests](../apps/server/test/server.test.ts),
[browser workflows](../apps/web/e2e/play.spec.ts).
