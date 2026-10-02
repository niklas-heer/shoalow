+++
schema_version = 1
id = "01M3Y7XVNJKZ8TSGMK99CNNTEA"
title = "Show public statistics, counting players by an anonymous browser ID"
date = "2026-10-02"
status = "accepted"
tags = ["statistics", "privacy"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

The home page shows public statistics, updated every 30 seconds while the page is visible:

- **Right now:** people connected, the tables they sit at, and how many of those have a game.
- **Players:** distinct players, ever and in the last 30 days.
- **Play:** tables opened, games played to the end, rounds, columns cleared and reshuffles, plus
  the best round score anyone has had.
- **Since when:** the date counting began.

Each browser keeps a random ID in local storage and sends it when it creates or joins a table. The
server stores a SHA-256 hash of that ID with when it was first and last seen. It stores no IP
addresses, names, table codes or seat tokens for statistics. Counters live in a `counters` table
and are written as they change. `GET /api/stats` has its own per-address rate limit.

## Context

On 2026-10-02 Niklas asked for statistics on the side for everyone to see, such as unique players
and matches. The game has no accounts, so "unique players" needs an identifier. Hashed IP
addresses would still count as personal data, and one address covers a whole office or household.
A random per-browser ID identifies nothing about the person.

## Consequences

- One person counts once per browser and app: clearing site data, switching browsers or using the
  home-screen app counts them again. A client can also send made-up IDs. The create and join rate
  limits cap how fast that can inflate the count, and the number is for fun, not billing.
- Practice games run in the browser and are not counted.
- Counting starts when this ships; earlier play is not included.
- A server test plays a full game and checks every number, that nothing identifying reaches the
  response, and that the numbers survive a restart. A hardening test checks the rate limit, and a
  browser test checks the panel.
