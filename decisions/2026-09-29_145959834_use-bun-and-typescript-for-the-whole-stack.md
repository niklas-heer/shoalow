+++
schema_version = 1
id = "01M3PTW16TY5KP5C69JVMNDE74"
title = "Use Bun and TypeScript for the whole stack"
date = "2026-09-29"
status = "accepted"
tags = ["architecture", "tooling"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

Build the whole game in TypeScript on Bun: a shared, pure `packages/game` for rules, bots and
message types, a `Bun.serve` server, and a Svelte 5 client.

## Context

The first idea was a Rust server with WebSockets and a TypeScript client. Niklas asked on
2026-09-29 whether Bun would simplify things while keeping everything real time, and chose it.
Bun provides HTTP, WebSockets, SQLite and a test runner built in, and a shared TypeScript package
removes the need to generate client types from Rust (for example with `ts-rs`).

Alternatives considered: Rust server plus TypeScript client (stricter compiler, two toolchains,
generated types); Leptos in WebAssembly (one language, weaker animation tooling).

## Consequences

- The client imports the same rules and types the server enforces, so they cannot drift apart.
- Latency is the same for a card game of at most 10 players; the server is not CPU-bound.
- Strict TypeScript settings, Biome and a deterministic simulation stand in for Rust's compiler
  guarantees.
