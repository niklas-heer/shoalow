+++
schema_version = 1
id = "01M3Y8Q2JPRTYRQSAYT0S0HZ2W"
title = "Show hand-written change notes for players in the app"
date = "2026-10-02"
status = "accepted"
tags = ["workflow", "web"]
supersedes = []
superseded_by = []
depends_on = []
related_to = []
+++
## Decision

Shoalow shows its own change notes on a **What's new** page (`/whats-new`). The home page and the
footer link to it. The notes are written by hand for players in `apps/web/src/lib/changes.ts`: one
entry per day something noticeable shipped, with a title and plain-language notes, newest first.
Every change a player could notice gets a note in the same commit.

The home page link carries a marker until the browser has opened the page since the latest entry.
Someone who has never played there starts with everything marked as read, since they have nothing
to catch up on.

## Context

On 2026-10-02 Niklas asked for change notes in the app so players know what changed. Commit
messages are written for developers: they name scopes and internals and come several to a feature.
Generating notes from them would produce the wrong voice and too much detail. A typed TypeScript
list needs no Markdown parser in the client, so it is checked at build time, and a unit test keeps
it dated and in order.

## Consequences

- Notes cover 29 September (launch), 30 September (table polish) and 2 October (house rules,
  scaled deck, secure shuffling, statistics, hardening), taken from the commit history.
- Changes without a note won't appear in the app. The README's Develop section states the rule.
  `mise run changes` lists feature and fix commits since the newest note, and the
  `updating-change-notes` skill tells agents when a note is needed and how it should read. Both
  were added on 2026-10-02 at Niklas's request.
- The read marker lives in local storage (`shoalow:changes-seen`), so it is per browser. It
  stores the newest entry's date and its number of notes, so a note added to today's entry still
  shows as new.
