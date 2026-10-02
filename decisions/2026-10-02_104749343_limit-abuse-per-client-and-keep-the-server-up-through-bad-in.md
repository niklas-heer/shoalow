+++
schema_version = 1
id = "01M3Y3MEAZJ5RSN68TDB4XZ4TW"
title = "Limit abuse per client and keep the server up through bad input"
date = "2026-10-02"
status = "accepted"
tags = ["security", "reliability", "server"]
supersedes = []
superseded_by = []
depends_on = []
related_to = ["01M3PTW17N94KRSJX7NC5B3ASJ"]
+++
## Decision

Shoalow is public and needs no account, so the server limits what one client can do and keeps
running when a request fails. All limits are defined in `apps/server/src/limits.ts`:

- **Per-address rate limits** (token buckets) on creating tables, joining, looking up table codes
  and opening connections. One IPv6 /64 counts as one address. On Fly.io the address comes from
  `Fly-Client-IP`, which Fly's proxy overwrites. Other deployments set `CLIENT_IP_HEADER` only
  behind a proxy that also overwrites it.
- **Per-connection message limits.** A connection over its limit gets one warning. If it keeps
  going, the server closes it with code 1008.
- **Connection caps** per address (64), per seat (3; the oldest connection closes with code 4001,
  and the client then waits instead of reconnecting) and in total.
- **Table capacity.** When the server holds 2,000 tables, a new table replaces the one that has
  been idle longest and has no open connections, lobbies first. A table with open connections or
  recent activity is never removed. If every table qualifies as busy, creation fails with 503.
- **Bounded storage.** The SQLite file is capped below the volume size with `max_page_count`.
  Each table's message log keeps its newest 5,000 entries. A message that leaves the snapshot
  unchanged is neither saved nor broadcast.
- **Defensive handling.** Every HTTP, WebSocket and bot-timer handler catches errors, so one bad
  request cannot crash the process. Snapshots are validated at startup, and unreadable rows are
  skipped and stay in the database. Cross-site API requests and WebSocket connections are refused
  by checking `Origin`. Posts must be JSON. Every response carries a strict Content Security Policy
  and related headers. Static files cannot be read from outside the web root, and dotfiles are
  never served.
- **Clean display names.** Names lose control, bidirectional and invisible characters, and long
  runs of combining marks are shortened.
- A host can hand only an away player's seat to a bot, and only during a game. When the host exits
  a game, hosting goes to someone still playing their own seat before anyone a bot is covering for.
  If everyone was away, the first person to come back becomes host. The room simulation found
  both cases.

## Context

On 2026-10-02 Niklas asked for reliability testing and for hardening the whole approach against
attacks. The concrete limits were chosen while implementing that request. They are sized so a busy
office behind one address can still play several tables, while one address cannot fill the server
or the disk.

Without these limits, one address could create the 2,000 tables the server allowed and block
everyone for 30 days. Unbounded logging could fill the 1 GB volume. A bad snapshot row would stop
the server from starting. A web page on another site could create tables from its visitors'
browsers.

Alternatives considered: longer table codes would make codes harder to share aloud. Signed
cookies instead of seat tokens in the WebSocket URL would mean reworking how seats are kept.
Fly's own concurrency limits stay as an outer bound but cannot tell clients apart.

## Consequences

- This partly changes [Persist games in SQLite on a single Fly.io machine](2026-09-29_145959861_persist-games-in-sqlite-on-a-single-fly-io-machine.md):
  the message log is now bounded per table instead of append-only. Snapshots still decide what
  happens after a restart.
- Clients that act faster than people, such as test autoplayers, need a higher message limit.
  `ServerOptions.limits` overrides any limit.
- Seat tokens still travel in the WebSocket URL. The page sends no referrer, and the server logs
  no URLs.
- The container still runs as root, because the Fly volume is mounted root-owned.
- `apps/server/test/hardening.test.ts` runs floods, junk input, cross-site requests, path tricks,
  full-server eviction and corrupted rows against a real server. `apps/server/test/room-sim.test.ts`
  sends random, illegal and malformed messages to whole tables, with restarts, and checks their
  invariants after every step. `mise run sim` runs a longer seeded version, and a failure prints
  its replay command.
