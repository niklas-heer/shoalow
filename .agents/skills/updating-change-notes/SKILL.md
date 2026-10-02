---
name: updating-change-notes
description: Use when Shoalow work changes anything a player could notice (rules, lobby options, the table, cards, pages, sounds, phone behavior, a visible bug), before committing or finishing that work, or when asked to update or check the What's new page or change notes.
---

# Updating Shoalow's change notes

Players read what changed on the **What's new** page (`/whats-new`). Its only source is
`apps/web/src/lib/changes.ts`. A noticeable change without a note does not exist for players, so
the note goes in the same commit as the change.

## Does it need a note?

| Needs a note | No note |
| --- | --- |
| New feature, rule, setting or page | Refactors, tests, CI, builds, docs |
| Visible fix ("cards now show in Safari") | Internal fixes nobody could see |
| Changed behavior or layout players will notice | Code moves, renamed internals |
| Fairness, privacy or security players benefit from | Dependency bumps without visible effect |

When in doubt, ask yourself whether someone who played last week would notice it. If they would,
write a note.

## Steps

1. Run `mise run changes`. It lists feature and fix commits since the newest entry; check each
   against the notes.
2. Edit `CHANGES` in `apps/web/src/lib/changes.ts`, newest first:
   - If an entry for today (`YYYY-MM-DD`, local date) exists, add to its `notes` and adjust its
     `title` if the day's theme changed.
   - Otherwise add a new entry at the top, with a short title naming the day's theme.
   - If a note in today's entry describes something your change replaces, rewrite that note
     instead of adding a contradicting one.
3. Run `bun test apps/web/test/changes.test.ts`, then `mise run check` before committing.
4. Commit the note together with the change it describes.

## How a note reads

Each note is one or two plain sentences for a player, ending with a period:

- It says what players can now do or see, and where: in the lobby, at the table, on the home page.
- It uses everyday words and "you".
- It leaves out code, file and library names, commit types and how it was built.

| Commit subject | Note |
| --- | --- |
| `fix(game): shuffle with ChaCha20 so decks cannot be predicted` | Shuffling is now cryptographically secure, so nobody can work out the face-down cards from the ones on the table. |
| `feat: let the host hide running sums` | The host can hide running sums in the lobby, so counting your face-up cards becomes part of the game. |

## Common mistakes

- Copying the commit subject. Rewrite it for a player.
- Adding a second entry with the same date. The test rejects it; extend the existing one.
- Writing the note "later". It gets forgotten; write it in the same commit.
- Listing every small polish commit separately. Merge related changes into one note.
