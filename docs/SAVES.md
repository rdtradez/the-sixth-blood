# Saves and save versioning

The goal: a save made on day one still loads after chapters are added, fixed, or rewritten, and no save is ever silently lost or guessed at.

## What a save holds

One plain JSON object (`state`, see `engine/state.js`): book, chapter, where the story is waiting, the call stack, every variable (flags, stats, names), `[once]` choices taken, scene visit counts, the random seed, and the frame the player was looking at. It is wrapped in an envelope with the save format version, content version, time, a small display summary, and a checksum.

Because the runner only ever stops at a page break, a choice, or a chapter end, a save is always taken at one of those points, and loading puts the player on exactly that screen.

## Slots

| Slot | Written |
| --- | --- |
| `auto` | Every page break and choice. |
| `chapter` | Start of every chapter. A safe place to go back to. |
| `quick` | Player's quick save. |
| `1` to `5` | Player's manual saves. |

Each write keeps the previous copy as a backup. A damaged slot falls back to its backup and tells the player. A failed write (full storage, blocked storage) never interrupts play; `game.lastSaveError` is set and the UI shows it.

## Two version numbers

Every save records both:

**Save format (`schema`)** is the shape of the state object. It changes only when the engine changes how state is stored.
To change it: bump `SCHEMA` in `engine/state.js` and add `SCHEMA_MIGRATIONS[oldVersion] = (state) => newState` in the same file.

**Content version (`contentVersion`)** is the story. Change it when an edit would break old saves: renaming a flag, changing what a stat means, splitting a variable.
To change it: bump `contentVersion` in `content/manifest.json` and add `{ version, note, up(state) }` to `content/migrations.js`. The note is shown to the player once, after upgrading.

Opening a save runs, in order: every schema migration after the save's format, then every content migration after the save's content version. Migrations are plain functions, run only when a save is opened, and tested by writing a save with the old version and loading it.

A save from a **newer** version than the app is refused with a clear message. It is never guessed at, and never overwritten.

You do not need a migration for:
- adding a new declared stat (it gets its start value when the save loads),
- adding chapters,
- editing text, scenes or choices (see below).

## Editing chapters after players have saves

Bump the chapter's `@version`. When a save is loaded, the engine checks the saved position still points at the same moment (each page break and choice set has a fingerprint from its nearby text). It tries, in order:

1. The saved position, if it still matches.
2. A named anchor (`:label` placed right before the page break or choice).
3. The nearest page break or choice set with the same fingerprint, so added or moved text does not strand a save.
4. The start of the same scene, keeping all variables.
5. The start of the chapter, if the scene was removed.
6. The first chapter of the book, if the whole chapter was removed.

The player is told in plain words when any repair happened. Variables, flags and stats are always kept. Put an anchor before the moments you are most likely to rewrite around (big decisions, chapter climaxes) to make step 2 exact.

Changing the **text of a choice** changes its identity for `[once]` tracking (the option can reappear), which is acceptable. Prefer adding options over rewording released ones.

## Export and import

Export writes one JSON file holding every readable slot and the profile (finished books), with a checksum. It can be downloaded, copied, or pasted back. Import:

- rejects damaged files, foreign files, and files from a newer app;
- never overwrites a used manual slot unless asked, using the next free slot instead;
- stores saves exactly as exported, and upgrades them when they are opened.

## The profile

`tsb:profile` holds progress across games: which books are finished (used later to unlock books in order) and settings. It travels in exports and is merged on import (finished books are unioned).

## Storage keys

`tsb:slot:<slot>`, `tsb:slot:<slot>:bak`, `tsb:profile`.
