# The Sixth Blood: build notes

Source of truth for story and design is the "Daywalker Series Design Notes" doc (https://claude.ai/artifact/2Gd9QjYxgpiwK2pXKjWids). This file tracks the build only. It is spoiler free by design: no chapter plans, choices or twists belong here.

## How it is built

- One PWA on GitHub Pages, all seven books in one app so saves carry over. Plain JavaScript modules, no build step, no dependencies. Open `index.html` through any static server.
- The engine is separate from the story. Each chapter is one `.tsb` file loaded only when played (docs/SCRIPT_FORMAT.md).
- Chapters compile to flat operation lists, so the story position is just (scene, position) and saving mid chapter is simple and exact.
- Engine code never touches the DOM or storage directly (`engine/game.js` takes a loader and a storage), so the whole game plays from a Node test.
- Run `npm test` and `npm run check` before every commit.

## File map

| Path | Role |
| --- | --- |
| `engine/expr.js` | Safe expression language (no eval). |
| `engine/script.js` | `.tsb` parser and compiler, with line numbered errors. |
| `engine/runner.js` | Executes a chapter to the next wait point. Also `relocate()` for edited chapters. |
| `engine/validate.js` | Cross chapter checks (missing scenes, unreachable scenes, fall off the end). |
| `engine/state.js` | State shape, stat clamping, `SCHEMA` and schema migrations. |
| `engine/versioning.js` | Upgrades old saves (schema and content migrations). |
| `engine/saves.js` | Slots, autosave support, backups, export and import, profile. |
| `engine/content.js` | Flag registry, stats in story voice, pronouns and names, era aliases, origin variants, journal command. |
| `engine/content-check.js` | Registry, voice, people and variant checks used by `npm run check`. |
| `engine/looks.js`, `engine/creation.js` | Appearance options, suggestions and descriptions; which roles and paths fit which origins; the data the creation screen draws (docs/CREATION.md). |
| `engine/game.js` | Controller: loading chapters, chapter flow, autosave, load with repair, library and the three start options, the Velati journal at each book's end. |
| `engine/systems/` | Game systems: day and night, feeding, combat, Collis, Collesanto, coven and missions, bonds, originals, collection, sleep and steward (docs/SYSTEMS.md). |
| `engine/fetch-loader.js`, `node-loader.js` | Content loaders for browser and Node. |
| `app/` | Reader UI: library, character creation, book start options, Previously screen, story view, menu. |
| `content/` | `manifest.json` (all seven books), `stats.json`, `flags.json`, `voice.json`, `people.json`, `origins.json`, `migrations.js`, chapters, and the system catalogs: `rules.json`, `ventures.json`, `village.json`, `holdings.json`, `originals.json`, `collection.json`, `sleep.json`. |
| `tests/` | `node --test` suites. |
| `tools/check.js` | Content checker (`npm run check`). |

## Books

The manifest lists the seven books in order with city, era and accent colors. The Lost Centuries interludes are written as chapters at the end of The Burning City, and The Long Watch as chapters at the start of Unchained, so each stays inside its book's saves and unlock order. Developer books (`"dev": true`) appear only in developer mode (`?dev` in the address).

## Build plan progress

Engine, 4 sessions, then books. The full 85 session checklist with commands is in the "The Sixth Blood Build Sessions" doc.

- [x] Session 1: engine core, script format, saves, save versioning
- [x] Session 2: flags, story voice stats, pronouns and names, origin variants, library screen
- [x] Session 3: game systems
- [x] Session 4: player features, developer tools, look and feel, sample chapter
- [x] Sessions 5 to 9: character creation and the prologue, the Rome map, Book One chapters 1 to 6
- [x] Session 17: the Florence and Collesanto (1474) maps for Book Two
- [x] Sessions 18 and 19: Book Two chapters 1 to 4
- [x] Session 20: Book Two chapters 5 and 6
- [x] Session 21: Book Two chapters 7 and 8
- [x] Session 22: Book Two chapters 9 and 10
- [x] Session 23: Book Two chapters 11 and 12
- [x] Session 24: Book Two chapters 13 and 14
- [x] Session 25: Book Two chapters 15 and 16
- [x] Session 26: Book Two chapters 17 and 18
- [x] Session 27: Book Two chapters 19 and 20; Book Two is complete (journal, recap, sleep to Paris)
- [x] Session 28: the Paris and Collesanto (1788) maps for Book Three
- [x] Session 29: Book Three chapters 1 and 2
- [x] Session 30: Book Three chapters 3 and 4
- [x] Session 31: Book Three chapters 5 and 6
- [x] Session 32: Book Three chapters 7 and 8
- [x] Session 33: Book Three chapters 9 and 10
- [x] Session 34: Book Three chapters 11 and 12
- [x] Session 35: Book Three chapters 13 and 14
- [x] Sessions 10 to 16: Book One chapters 7 to 20; Book One is complete (journal, recap and first sleep in session 16)

### Session 1 notes (for the next session)

- The library screen, settings, fonts, book accents and the real app icon are not built. `app/` is a plain working shell for testing the engine on a phone.
- `content/stats.json` lists the stats from the design doc with placeholder ranges and starting values. Tune them in session 2 or 3 when the systems exist.
- Per person stats use wildcard names (`loyalty.*`, `bond.*`).
- The `engine-test` book in the manifest is flagged `"dev": true`. Session 2's library screen should hide dev books outside developer mode.
- Systems from session 3 plug in through `fns` and `commands` on the `Game` constructor, so they need no parser changes.
- Rewind last choice (a player feature) is not built. The state is one plain object, so keeping the previous state before each choice is straightforward.
- Hosting: turn on GitHub Pages for the repo (Settings, Pages, deploy from the `main` branch root). All paths are relative, so the project page URL works.

### Session 2 notes (for the next session)

- Schema is 2: state now has `decisions`, `journal` and `booksDone`. Library start options and carries are described in docs/SAVES.md.
- Systems plug in the same way as before (`fns`, `commands`), and `engine/content.js` shows the pattern for content driven functions that read `ctx.content`.
- `$ do journal(text, title)` is a placeholder Previously feed. Session 3's Velati journal should write its entries into `state.journal` so the Previously screen picks them up.
- Hero fields are `hero.name`, `hero.gender`, `hero.origin`, `hero.role`, `hero.path`, and `hero.look.*` for appearance. Session 5's character creation sets them; `game.heroVars()` and `game.suggestNames()` already fill defaults and name suggestions from `content/origins.json`.
- Love interests are added to `content/people.json` with their book; set their gender from the player's choice with `$ <id>.gender = "f"`.
- Each book's `recap` (one spoiler light paragraph shown only to players who quick start past it) and `quickstart.vars` (stat levels at the start of the book: age is a placeholder 1 to 7) should be written when the book before is finished.
- `content/voice.json` bands and the placeholder stat ranges in `stats.json` should be retuned when the session 3 systems decide real numbers (wealth especially). secrecy now starts at 70 and higher means better hidden; cunning_brutal runs negative for cunning, positive for brutal.
- Settings, fonts and the full look and feel are still session 4. The library cards already use each book's accent colors.

### Session 3 notes (for the next session)

- Schema is 3: state has `sys`. Every system is documented in docs/SYSTEMS.md with script examples; chapters use functions and `$ do` commands, and `npm run check` rejects misspelled ids and values in them.
- `$ do rest()` closes each chapter's play (income, missions, hunger, Secrecy and Humanity). Book chapters should call it before `=> next`.
- New stat: `injury` (wounds, with story voice). Wealth bands were retuned for era prices; quick start sets age, wealth and collesanto per book in the manifest. All numbers live in `content/rules.json` and the catalogs and can be retuned after playtesting.
- Company names for New Orleans and Chicago were left blank in the design doc, so `collis()` says "Collis" there until the story names them in `content/rules.json`.
- Quick start defaults for the originals in `content/originals.json` are placeholders for the book sessions to retune.
- Each book's Velati journal is a script named by `"journal"` in the manifest (see the engine-test-c book). Book sessions write theirs in `content/journal/` at the end of the book. Journal scripts have no choices.
- `game.systems()` is the data for session 4's People screen, codex and coven panel. Achievements can read `fed()`, `coven_size()`, `lone()` and `awake_count()` style functions.
- Coven members, keepers and love interests must be added to `content/people.json` (pronouns, and the checker's id checks).
- Developer book `engine-test-c` (Book Two rules via `"asBook": 2`) plays every system in one chapter; `tests/systems.test.js` covers them.

### Session 4 notes (for the next session)

- Schema is 4: state has `sys.lore` (codex entries found, family members known). Profile now holds `achievements` and `settings`. See docs/SAVES.md.
- Player screens live in the menu (tabs You, People, Family, Codex, Achievements, Settings, Saves, and Dev in developer mode). Data comes from `engine/screens.js`, drawn by `app/panels.js`.
- Settings (text size, theme night, dusk or parchment, font, content notes, rewind, developer mode) are defined in `engine/settings.js` and applied by `app/settings-ui.js`. Rewind is off by default and keeps one snapshot in memory only.
- Content files added: `codex.json`, `family.json`, `notes.json`, `achievements.json`. Formats are in docs/SYSTEMS.md. Book sessions fill them in as they write; `discover()` and `kin()` unlock entries from the script.
- Chapters can list content note ids in the manifest (`notes`); they show once before the chapter when the setting is on.
- Developer tools: `app/devpanel.js` and `engine/dev.js` (jump to a chapter, set flags and stats, snapshots, branch explorer). `npm run walk` runs the explorer from the command line.
- Quick starts and developer jumps earn no achievements.
- Fonts are in `fonts/` (all open licence, see fonts/README.md). The title art and icons are drawn in `app/art.js` and `icons/`.
- Sample content is the developer book `engine-test-d`.

### Session 5 notes (for the next session)

- Character creation is a five step screen (`app/creation.js`): who you are, name, life before, face, begin. Rules and data are in `engine/creation.js`, `engine/looks.js`, `content/looks.json` and `content/origins.json`; see docs/CREATION.md. Quick start now gets a varied suggested look too.
- Appearance is stored as `hero.look.*`. Story text reads it with `look()`, `marked()` and `look_sentence()`, and the You screen shows it. Use `hero.look.age` for the young looking and older looking gags.
- Book One is a work in progress: its manifest entry has `"incomplete": true` and its only chapter is the prologue (`"prologue": true`, chapter id `b1p`). The game pauses on "To be continued" after the last written chapter and carries on by itself when more is added. Session 7 adds chapters after the prologue (the prologue's `=> next` then leads into chapter 1) and the last Book One session removes `"incomplete"`.
- The prologue sets `wealth` and `collesanto` to the same values the Book One quick start uses, so a new game and a quick start begin chapter 1 alike. Retune both together.
- Prologue flags (`prologue.day`, `prologue.stand`, `prologue.answer`) and `hero.death` are registered with quick start defaults. `content/family.json` has no quick start status for the family yet: the Book One sessions set it when they know how each relative's story stands at the end of the book.
- The prologue plan is in `SPOILERS/`. Session 6 added the Map tab (below). Session 7 (Book One, Chapters 1 and 2) is next.
- Session 4 lives on the `session-4` branch and session 5 is built on top of it. Merge `session-5` to `main` to get both.

### Session 7 notes (for the next session)

- Book One, chapters 1 and 2 are built (`content/burning-city/ch01.tsb` and `ch02.tsb`, chapter ids `b1c01` and `b1c02`). The book is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 2 and carries on by itself when chapter 3 is added to the manifest.
- Both chapters use the day and night loop from docs/SYSTEMS.md (`phase`, `act`, `end_phase`, `rest`), the fight system and `send_home`. Chapter 1 ends with `rest()` and chapter 2 with `rest()` in its closing scene; chapter 3 should read hunger, injury and wealth as the player left them rather than reset them.
- New decision flags use the prefix `b1.` and are registered in `content/flags.json` with `book`, `major` and a quick start `default`. Later chapters and the Velati journal read them from `state.decisions`.
- New people (`content/people.json`): Domitia, Sextus, Quintus, Fuscus. New codex entries: the villa, the hunger, the sun, strix. Chapters 1 and 2 carry the content notes `blood`, `violence` and `grief`.
- `content/family.json` now has quick start statuses for the spouse and the children, so a quick start into Book Two finds the family as the chapters leave it.
- Scratch variables (`_fed`, `_vis`, `_early` and so on) only live inside a chapter. Anything a later chapter needs is a registered flag.
- `tests/book1.test.js` plays both chapters for every mortal role and down the branches that later chapters depend on. `tests/creation.test.js` now stops its prologue helper at the end of the prologue, and its pause test expects two written chapters. Update that count each session.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 8 notes (for the next session)

- Book One, chapters 3 and 4 are built (`content/burning-city/ch03.tsb` and `ch04.tsb`, chapter ids `b1c03` and `b1c04`). The book is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 4 and carries on by itself when chapter 5 is added to the manifest.
- Session 8 is built on the `session-7` branch (chapters 1 and 2 are not on `main` yet). Merge `session-7` and then `session-8` to get everything.
- Both chapters use the day and night loop (`phase`, `act`, `end_phase`, `rest`), the donor feeding type, the fight system and the codex. Chapter 4 ends with `rest()` and `=> next`; chapter 5 should read hunger, injury, wealth and standing as the player left them.
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`. New people (`content/people.json`): Tiro, Galerius, Hanno, plus a title and bio for Prisca. New codex entries: the Merchant line, the Veil, the Senate of Blood, the Lictors. Content notes: chapter 3 carries `blood` and `slavery`, chapter 4 carries `violence`.
- Nobody is recruited or sired in these chapters (coven timing: Book One only takes the hero in). Coven members are plain people with `bond.*` values until the stay or go decision near the end of the book.
- `tests/book1b.test.js` plays chapters 3 and 4 down their branches. `tests/creation.test.js` now expects four written chapters: update that count each session.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 9 notes (for the next session)

- Book One, chapters 5 and 6 are built (`content/burning-city/ch05.tsb` and `ch06.tsb`, chapter ids `b1c05` and `b1c06`). The book is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 6 and carries on by itself when chapter 7 is added to the manifest.
- Session 9 is built on the `session-8` branch (which sits on `session-7`; none of sessions 6 to 8 are on `main` yet). Merge `session-7`, `session-8` and then `session-9` to get everything.
- Chapter 5 starts Collis (the first venture is bought through `invest()` and the firm is named). Chapter 6 uses the feeding system and the vow about what he drinks; later chapters should read `animal_diet()` for fights rather than a flag. Both chapters use the day and night loop and end with `rest()`; chapter 5 ends with `=> next`.
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`. New people (`content/people.json`): Naevia, Lucrio, Vibia. New codex entries: Collis, the lesser cup. Content notes: chapter 5 carries `blood` and `slavery`, chapter 6 carries `blood`, `violence` and `grief`.
- Venture prices are fixed in `content/ventures.json`, so how much a hero can buy in chapter 5 depends on his purse and Prisca's backing. Retune the stakes in the chapter if the venture prices change.
- `tests/book1c.test.js` plays chapters 5 and 6 from the prologue down their branches, including each way chapter 6 can be reached. `tests/creation.test.js` now expects six written chapters: update that count each session.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 10 notes (for the next session)

- Book One, chapters 7 and 8 are built (`content/burning-city/ch07.tsb` and `ch08.tsb`, chapter ids `b1c07` and `b1c08`). The book is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 8 and carries on by itself when chapter 9 is added to the manifest.
- Session 10 is built on the `session-9` branch (which sits on sessions 6 to 8; none of them are on `main` yet). Merge `session-7`, `session-8`, `session-9` and then `session-10` to get everything.
- Chapter 7 sets the coven or lone path (`choose_path`) and recruits the house into the circle when he stays, so later chapters can read `in_circle("prisca")`, `coven_path()` and `lone()`. Chapter 8 uses the day and night loop, the fight system and two codex entries; each ends with `rest()` (chapter 8 plays one `rest()` at its close, chapter 9 should read hunger, injury and standing as the player left them).
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`. New people (`content/people.json`): Rufus, Flavus. New codex entries: the vigiles, the Igniferi. Content notes: chapter 7 carries `blood` and `violence`, chapter 8 carries `blood`, `violence` and `grief`.
- `tests/book1d.test.js` plays chapters 7 and 8 down their branches. `tests/creation.test.js` now expects eight written chapters: update that count each session.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 11 notes (for the next session)

- Book One, chapters 9 and 10 are built (`content/burning-city/ch09.tsb` and `ch10.tsb`, chapter ids `b1c09` and `b1c10`). The book is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 10 and carries on by itself when chapter 11 is added to the manifest.
- Session 11 is built on the `session-10` branch (which sits on sessions 6 to 9; none of them are on `main` yet). Merge `session-7`, `session-8`, `session-9`, `session-10` and then `session-11` to get everything.
- These two chapters break the usual shape on purpose: chapter 9 closes its phase with `end_phase()` and does not call `rest()`, chapter 10 opens a new night phase and calls `rest()` once at its close, so the tally of kills and witnesses for both lands together. Chapter 11 should read hunger, injury, standing and secrecy as chapter 10 left them.
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`. New codex entry: the Great Fire (places). Content notes: chapter 9 carries `blood` and `violence`, chapter 10 carries `blood`, `violence` and `grief`. No new people were needed.
- Chapter 10 is a hub of four places where only three can be reached. What he did not reach is decided by the flags and the fire, and the dawn scene reads them. Later chapters and the Velati journal should read the flags (`b1.saved_*`, `b1.fire_toll`, `b1.rufus_saw`, `b1.blame`) rather than recompute them.
- `tests/book1e.test.js` plays chapters 9 and 10 down their branches, and the `burned lots` offer is tested with a developer jump. `tests/creation.test.js` now expects ten written chapters: update that count each session. `tests/book1.test.js` gained a `stopAt` option so its wound test can stop as chapter 3 opens, since later chapters add wounds of their own.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 12 notes (for the next session)

- Book One, chapters 11 and 12 are built (`content/burning-city/ch11.tsb` and `ch12.tsb`, chapter ids `b1c11` and `b1c12`). The book is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 12 and carries on by itself when chapter 13 is added to the manifest.
- Session 12 is built on the `session-11` branch (which sits on sessions 6 to 10; none of them are on `main` yet). Merge `session-7`, `session-8`, `session-9`, `session-10`, `session-11` and then `session-12` to get everything.
- Chapter 11 spends two day actions, then a dusk and the council, and ends with `rest()`. Chapter 12 opens a fresh night phase of three actions and ends with `rest()`. Chapter 13 should read hunger, injury, standing and secrecy as chapter 12 left them.
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`. New people (`content/people.json`): Theron, Meritamun. New codex entries: the old quarry, the General line, the Scribe line. Content notes: chapter 11 carries `grief`, `violence` and `war`, chapter 12 carries `blood`, `violence`, `war` and `grief`.
- Later chapters should read `b1.war_terms`, `b1.cell`, `b1.reckoning`, `b1.farm`, `b1.clerk`, `b1.boy`, `b1.scribe`, `b1.ledger` and `b1.hill_known` rather than recompute them.
- `tests/book1f.test.js` plays chapters 11 and 12 down their branches, including the fights, with developer jumps for the paths that depend on earlier choices. `tests/creation.test.js` now expects twelve written chapters: update that count each session.
- Two script gotchas found while building: a `?if ... ?end` block wrapped around one choice of a set splits the set into two prompts (put the condition on the choice line instead: `* Text ?if cond`), and a `:label` placed directly before `?else` lets a jump into that label run the else branch. Avoid both.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 13 notes (for the next session)

- Book One, chapters 13 and 14 are built (`content/burning-city/ch13.tsb` and `ch14.tsb`, chapter ids `b1c13` and `b1c14`). The book is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 14 and carries on by itself when chapter 15 is added to the manifest.
- Session 13 is built on `main` (sessions 4 to 12 are merged), on the `session-13` branch.
- Chapter 13 is a night phase of three actions (the road) and then a day phase of three (the hill) and closes with `end_phase()` and `=> next`, with no `rest()`. Chapter 14 opens a new night phase of three actions and ends with `rest()`. Chapter 15 should read hunger, injury, standing and secrecy as chapter 14 left them.
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b1.company`, `b1.hill_warned`, `b1.column`, `b1.hill_ready`, `b1.aelia_talk`, `b1.hill_stand`, `b1.flavus_end`, `b1.remnant`, `b1.hill_toll`, `b1.survivor`. No new people or codex entries were needed. Content notes: chapter 13 carries `violence`, `blood` and `war`, chapter 14 carries `violence`, `blood`, `war` and `grief`.
- Chapter 14 can damage Collesanto (`village_harm`, scaled by `b1.hill_toll`) and calls `kin()` for Aelia and Felix, so later chapters and books can read `collesanto` and the family as the hill left them.
- `tests/book1g.test.js` plays chapters 13 and 14 down their branches, including the fights across several seeds. `tests/creation.test.js` now expects fourteen written chapters: update that count each session. `tests/book1b.test.js` and `tests/book1c.test.js` gained a `stopAt` argument, because their stat comparisons are clamped once later chapters run.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 14 notes (for the next session)

- Book One, chapters 15 and 16 are built (`content/burning-city/ch15.tsb` and `ch16.tsb`, chapter ids `b1c15` and `b1c16`). Book One is twenty chapters, so the book is still `"incomplete": true` and the game pauses on "To be continued" after chapter 16. Sessions 15 and 16 write chapters 17 to 20; the last of them removes `"incomplete"` and writes the recap, the quick start values and the Velati journal.
- Session 14 is built on the `session-13` branch (which sits on sessions 6 to 12; none of them are on `main` yet except through session 12). Merge `session-13` and then `session-14` to get everything.
- Chapter 15 spends two day actions, then a dusk and the meeting, and has no `rest()` (it closes with `=> next`). Chapter 16 opens a fresh night phase of three actions and ends with `rest()`. Chapter 17 should read hunger, injury, standing and secrecy as chapter 16 left them.
- `awaken("general", ...)` is called in chapter 16, so `original("general")` is `awake` and `original("general", "by")` says who woke the General. The hero's choice about the awakened General (`original_fate`) is not made yet: chapter 17 or 18 makes it, and it must be made before the book ends.
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`. New person (`content/people.json`): Tarrax. New codex entries: the bronze door (places) and Tarrax (people). Content notes: both chapters carry `violence`, `blood` and `war`.
- Later chapters should read `b1.door_side`, `b1.cordon`, `b1.tarrax_answer`, `b1.cedar`, `b1.door_read`, `b1.galerius_aid` and `b1.theron_door` rather than recompute them.
- Script gotcha found while building: `<~` only works in a scene that was called with `~>`. A choice that leaves a called scene by `-> other_scene` loses the way back, so use `~> other_scene` followed by `<~` instead.
- `tests/book1h.test.js` plays chapters 15 and 16 down their branches, including every stand and the fights over eight seeds. `tests/creation.test.js` now expects sixteen written chapters: update that count each session.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 15 notes (for the next session)

- Book One, chapters 17 and 18 are built (`content/burning-city/ch17.tsb` and `ch18.tsb`, chapter ids `b1c17` and `b1c18`). Book One is twenty chapters, so the book is still `"incomplete": true` and the game pauses on "To be continued" after chapter 18. Session 16 writes chapters 19 and 20; the last of them removes `"incomplete"` and writes the recap, the quick start values and the Velati journal.
- Session 15 is built on the `session-14` branch (which sits on `session-13`; only sessions through 12 are on `main`). Merge `session-13`, `session-14` and then `session-15` to get everything.
- Chapter 17 spends two day actions, then a dusk, and has no `rest()` (it closes with `=> next`). Chapter 18 opens a fresh night phase of three actions and ends with `rest()`. Chapter 19 should read hunger, injury, standing and secrecy as chapter 18 left them.
- Chapter 18 makes the choice about the General: `original_fate("general", ...)` is always set by its end, so later chapters, the journal and later books can read `original("general", "fate")`. The quick start default for the General in `content/originals.json` now includes a fate.
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b1.general_meal`, `b1.general_knows`, `b1.cedar_cell`, `b1.escort`, `b1.witnessed`, `b1.general_terms`, `b1.seal_kind`, `b1.senate_ruling`, `b1.tarrax_after`. New person (`content/people.json`): the General. New codex entries: the General and Surety. Content notes: chapter 17 carries `blood` and `war`, chapter 18 carries `violence`, `blood` and `war`.
- Later chapters and the Velati journal should read `b1.senate_ruling`, `b1.tarrax_after`, `b1.seal_kind`, `b1.general_terms` and `b1.general_meal` rather than recompute them.
- Chapter 17 introduces one new piece of world lore, the custom of surety, which gives the hero standing to decide the General's fate however he was woken. It is flagged to the owner in the session report.
- Script gotchas found while building: a scene reached with `->` cannot use `<~`, so a choice body in such a scene must jump with `->`; a `:label` inside an `?if` block is unsafe for a loop, so put a looping fight in its own scene and call it with `~>`; put a condition on each choice line of a set rather than wrapping the set.
- `tests/book1i.test.js` plays chapters 17 and 18 down their branches, including every way the General can be woken, every fate and the fight over eight seeds. `tests/creation.test.js` now expects eighteen written chapters: update that count each session. `tests/book1d.test.js` gained a `stopAt` argument, because its stat comparison is clamped once later chapters run.
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Session 16 notes (for the next session)

- Book One, chapters 19 and 20 are built (`content/burning-city/ch19.tsb` and `ch20.tsb`, chapter ids `b1c19` and `b1c20`). **Book One is finished at twenty chapters**: `"incomplete"` is removed from the manifest, so the book now ends, writes its journal, saves a carry slot and unlocks Book Two.
- The manifest entry for Book One now has `"journal": "journal/burning-city.tsb"` (the Velati journal, written in the voice of the watchman who begins the record, reading the book's decision flags) and a spoiler light `recap` for quick starts into Book Two. `quickstart.vars` for Book Two are unchanged.
- Chapter 19 spends two day actions out of four places, then the road and the hill, and has no `rest()` (it closes with `=> next`). Chapter 20 has no phases: it calls `rest()` once and then `sleep()`, and closes with `=> next`. The wake report is not shown in Book One; Book Two's opening reads `wake()`.
- Chapter 20 offers `rest_place`, `steward`, `orders` and `protection`. A steward is only offered if he is in the circle and active, or if the keepers were sworn in chapter 19; the bank is always offered, so a hero on any path can finish the sleep. Protections are priced by `content/rules.json` and each can be bought once; the choice can always be ended.
- New decision flags keep the `b1.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b1.velati_seed`, `b1.collis_legacy`, `b1.senate_peace`, `b1.theron_end`, `b1.keepers`, `b1.last_night`. The sleep itself is logged by the engine (`steward.burning-city`, `orders.burning-city`, `sleep.burning-city`). New codex entries: the watchers of the Aventine and the keepers of the hill. Content notes: chapter 19 carries `grief`, chapter 20 carries `slavery` and `grief`.
- Later books and the journals should read `b1.keepers` (whether Aelia and Felix are keepers, with `keeper("aelia")` and `keeper("felix")` set), `b1.collis_legacy`, `b1.senate_peace` and `b1.velati_seed` rather than recompute them. On the lone path the keepers also take the `keeper_oath` holding when he can afford it; on the coven path they are sworn without it.
- **For the Lost Centuries interlude sessions:** the sleep from Rome to Florence is resolved at the end of chapter 20 in one `sleep()`, and its gap in `content/sleep.json` is not marked `"split"`. The interludes are chapters added after chapter 20 in the manifest (chapter 20 closes with `=> next`, so they plug in). If an interlude should break the sleep, mark the gap `"split": true` and decide how the first `sleep()` and the early waking relate before writing it.
- Because Book One now ends, the older Book One tests no longer stop at a pause: they play the whole book. `tests/creation.test.js` has the end of Book One test (twenty chapters, journal, Book Two unlocked) and the other pause tests use synthetic books. `tests/book1c.test.js` and `tests/book1i.test.js` use `stopAt` for stat comparisons that later chapters would change. The `tests/book1.test.js` through `book1i.test.js` pause assertions are now "the book ends".
- `tests/book1j.test.js` plays chapters 19 and 20 and the journal down their branches (every place, steward, order, protection and the keepers' oath).
- Each Book One session adds its chapters to `SPOILERS/book-1.md` (plans) and keeps this file spoiler free.

### Interlude session A notes (for the next session)

- The Lost Centuries interludes begin. Three unnumbered chapters follow chapter 20 in the manifest, flagged `"interlude": true`: `lc01`, `lc02`, `lc03` (`content/lost-centuries/`). They are not counted in `chapterCount`, show "The Lost Centuries" as the kicker, and Book One now ends after `lc03`.
- Chapter 20 is `@version 2`: it now sleeps only the first segment (`rome_to_sack`). The old umbrella gap `rome_to_florence` is kept untouched for quick starts, which skip split gaps.
- Engine: sleep gaps can carry a `chain`. `applySleep` accumulates years, events and a `segments` count across a chain, so `wake()` reports the whole sleep. Book Two's opening should read the chained `wake()`.
- Engine: chapters may declare their own `journal` and `journalTitle` in the manifest. `composeChapterJournal` writes the entry at chapter end, after the book entry for the same book. `tools/check.js` validates chapter journals.
- New gaps in `content/sleep.json`: `rome_to_sack`, `sack_to_byzantium`, `byzantium_to_florence`. Interlude B split `byzantium_to_florence` into `byzantium_to_plague` and `plague_to_florence`.
- New flags use the `lc.` prefix, all registered with `major` and a quick start default (`lc.mason` is not major). New people, codex entries and one collection item are registered.
- Chapter journals: `content/journal/lc-410.tsb` and `lc-537.tsb`.
- `tests/interlude-a.test.js` covers the chain report, chapter journals, ordering and flags. `tests/book1j.test.js` uses `stopAt: 'lc01'` for chapter 20 checks.
- Plans for these chapters are in `SPOILERS/lost-centuries.md`.

### Interlude session B notes (for the next session)

- Two more unnumbered interlude chapters follow `lc03`: `lc04` and `lc05` (`content/lost-centuries/`). Book One now ends after `lc05`. `lc03` is `@version 2` and sleeps `byzantium_to_plague`; `lc05` sleeps the last segment, `plague_to_florence`. The chain now has four segments summing to 1410 years, and `wake()` reports the whole of it.
- New flags (all registered, `major`, with quick start defaults): `lc.village_1348`, `lc.sleeper_1348`, `lc.plague_road`.
- Aelia and Felix are now `"quick": "dead"` in `content/family.json`, so a quick start into Book Two finds the whole first family gone. Book Two's opening should read the chained `wake()`.
- `tests/interlude-b.test.js` covers the chain end and the chapter order; `tests/book1.test.js` first night checks use `stopAt: 'lc01'`.
- Plans are in `SPOILERS/lost-centuries.md`.

- Maps (session 6): the Map tab in the menu shows `app/maps/city.html` (procedural SVG: Rome and Collesanto, with an After the fire toggle) in an iframe and tells it which sites to show. Sites per map are listed in `engine/maps.js`; `roadhome`, the farm, square, villa and road start charted. Chapters add places with `$ do chart("rome.warehouse")` and can test `charted("rome.warehouse")`. Charted places live in `sys.lore.sites` (SCHEMA 5). Later books add their city to `engine/maps.js` and `city.html`; the approved standalone previews for Florence (done), Paris (done), New Orleans, London, Chicago and New York are kept outside the repo until their sessions.

### Session 17 notes (for the next session)

- The Rome map tab from session 6 had never been merged into `main`; session 17 merged it first, then added the Florence map.
- `app/maps/florence.html` draws Florence and Collesanto as it stands in 1474 (walled, unburned). `engine/maps.js` now gives each map a `page` (`city` or `florence`); the Map tab loads the page of the book the hero is in. New maps: `florence` (`bank`, `prisca`, `wool`, `bottega`, `haven`, `court`, `rooms`, `roadhome`) and `collesanto2` (`farm`, `square`, `villa`, `press`, `gate`, `crypt`, `road`), both for book `blood-and-gold`. Book Two chapters chart sites with `$ do chart("florence.bank")`.
- `sw.js` caches the new page (`VERSION` is `tsb-7`). Later city maps follow the same pattern: copy the page, list the sites in `engine/maps.js`.

### Session 28 notes (for the next session)

- `app/maps/paris.html` draws Paris and Collesanto as they stand in 1788 (walled Paris with its barrières, the Seine and both banks; the walled village). It is the Florence page with the approved Paris preview's drawing and sites. `engine/maps.js` gains `paris` (`presses`, `counting`, `land`, `valere`, `haven`, `rebels`, `court`, `roadhome`) and `collesanto3` (`farm`, `square`, `villa`, `press`, `gate`, `crypt`, `road`), both for book `crown-of-ashes` on page `paris`. Book Three chapters chart sites with `$ do chart("paris.counting")`.
- The Paris press site is `presses`, not `press`, because the Map tab sends one flat list of visible site ids to the page and `collesanto3` already uses `press`. Keep site ids unique across the two maps of a book. A test checks this.
- `sw.js` caches the new page (`VERSION` is `tsb-8`). New Orleans, London, Chicago and New York follow the same pattern.

### Session 18 notes (Book Two, chapters 1 and 2)

- Book Two ("blood-and-gold") begins. Chapters `b2c01` and `b2c02` are in `content/blood-and-gold/` (`ch01.tsb`, `ch02.tsb`). The manifest entry is `"incomplete": true`, so the book pauses after chapter 2 until the next session adds more.
- Chapter 1 reads the chained `wake()` report (place, steward, outcome) and works for every combination, including the quick start report. Chapter 2 spends two day actions out of three and two night actions out of three, and reads `b1.keepers`, `lc.sleeper_1348`, `lc.hill` and `lc.village_1348`.
- New flags use the `b2.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`. New people, family members and codex entries are registered. Content notes: chapter 2 carries `blood` and `violence`.
- `tests/book2.test.js` covers every waking variant, the recorded decisions, and the no dashes and no braces rules.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 19 notes (Book Two, chapters 3 and 4)

- Book Two chapters 3 and 4 are built (`content/blood-and-gold/ch03.tsb` and `ch04.tsb`, chapter ids `b2c03` and `b2c04`). The manifest entry is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 4 and carries on by itself when chapter 5 is added.
- Session 19 is built on the `session-18-book-two-ch1-2` branch. Merge that branch first and then `session-19`.
- Chapter 3 is a night phase of three actions out of four and then the audience, and ends with `rest()` and `=> next`. Chapter 4 is a night phase of three actions out of four and then the terms at dawn, and ends with `rest()` and `=> next`, which pauses until chapter 5 exists. Chapter 5 should read hunger, injury, standing and secrecy as chapter 4 left them.
- New flags keep the `b2.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`. Decision flags a later chapter should read: `b2.oath`, `b2.sire_answer`, `b2.seat`, `b2.licence`, `b2.prisca_deal`, `b2.prisca_asked`, `b2.prisca_sun`, `b2.prisca_books`, with `b2.prisca_brief`, `b2.test`, `b2.prisca_past` and `b2.pazzi_heard` as smaller notes.
- New people (`content/people.json`): Gualtiero, Ottaviano, Vieri. New codex entries: the licence of the Purse, the Medici and the Pazzi, the Priestess line, the bank of the Merchant house. Content notes: chapter 3 carries `blood` and `violence`, chapter 4 carries `blood`.
- Chapter 3 starts a fight with `fight("fledgling", 2)` in its own scene and calls it with `~>`; `strike()` must never run before the fight starts (found while testing).
- `tests/book2b.test.js` plays both chapters down their branches, including the fight over eight seeds, every hunger variant and each earlier decision the chapters read. `tests/book2.test.js` now expects four chapters and stops chapter 2 at the start of chapter 3.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 20 notes (Book Two, chapters 5 and 6)

- Book Two chapters 5 and 6 are built (`content/blood-and-gold/ch05.tsb` and `ch06.tsb`, chapter ids `b2c05` and `b2c06`). The manifest entry is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 6 and carries on by itself when chapter 7 is added.
- Session 20 is built on `main` (session 19 is merged), on the `session-20` branch.
- Chapter 5 is a day phase of three actions out of four and then the noon signing and the ninth hour; it ends with `rest()` and `=> next`. Chapter 6 is a night phase of three actions out of four and then the terms at dawn; it ends with `rest()` and `=> next`, which pauses until chapter 7 exists. Chapter 7 should read hunger, injury, standing and secrecy as chapter 6 left them.
- New decision flags keep the `b2.` prefix and are registered in `content/flags.json` with `book`, `major` and a quick start `default`. Decision flags a later chapter should read: `b2.loan`, `b2.daylight`, `b2.captain`, `b2.watcher_terms`, `b2.watcher_bond` (and `romance_status("watcher")`), with `b2.wool_wages`, `b2.portrait`, `b2.watcher_meet`, `b2.watcher_book` and `b2.vieri_watch` as smaller notes.
- New people (`content/people.json`): the watcher (the Velati agent, gender opposite the hero, name Allegra or Matteo Bonsi), Ser Bartolo, Messer Raniero, Ser Nofri, Maestro Berto and the apprentice. New codex entries: the Banca del Colle and the Velati. Content notes: both chapters carry `blood`.
- The Velati agent's default name is a placeholder (the design doc leaves it open). The agent's gender follows the hero's, like the spouse.
- Chapter 4 is now `@version 2`: one passage uses the watcher's pronouns instead of a fixed "she".
- The painter's portrait from chapter 5 gives the collection piece `florence_portrait` only if he sat as himself (`b2.portrait` is `sat`).
- `tests/book2c.test.js` plays both chapters down their branches (every deal and sun bargain, both genders, hunger and an empty purse, each decision flag). `tests/book2.test.js` and `tests/book2b.test.js` now expect six chapters, and the chapter 4 test stops as chapter 5 begins.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 21 notes (Book Two, chapters 7 and 8)

- Book Two chapters 7 and 8 are built (`content/blood-and-gold/ch07.tsb` and `ch08.tsb`, chapter ids `b2c07` and `b2c08`). The manifest entry is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 8 and carries on by itself when chapter 9 is added.
- Session 21 is built on the `session-20` branch, which is not merged to `main` yet. Merge `session-20` first and then `session-21`.
- Chapter 7 opens with a supper (no phase), then a night phase of three actions out of four, then a long closing scene and the dawn; it ends with `rest()` and `=> next`. Chapter 8 is a day phase of three actions out of four and then the dusk; it ends with `rest()` and `=> next`, which pauses until chapter 9 exists. Chapter 9 should read hunger, injury, standing and secrecy as chapter 8 left them.
- New decision flags keep the `b2.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`. Decision flags a later chapter should read: `b2.supper`, `b2.roll`, `b2.prisca_sixth`, `b2.elder_witness`, `b2.answer`, `b2.berengaria_debt`, `b2.roll_told`, `b2.pazzi_paper`, `b2.trader_ledger`, `b2.trader_regard` and `b2.trader_coin`, with `b2.trader_loan`, `b2.trader_scale` and `b2.trader_answer` as smaller notes. A flag that can be skipped has an `unseen` value (or `refused` or `silent`) that its default uses.
- New people (`content/people.json`): Berengaria and Nanni. New codex entries: the roll of the lines, Berengaria and Nanni. New collection pieces: `remembrancers_tally` and `merchants_token`. Content notes: both chapters carry `blood`.
- `b2.trader_regard` is computed at the end of chapter 8 from this chapter's choices and from `b2.wool_wages`, `b2.captain` (and `b2.pazzi_paper`). Later chapters and the Velati journal should read the flag rather than recompute it.
- Script gotcha found while building: a scratch variable that is set by more than one action of a night phase also leaks into every later `?if` that reads it, so give each fact its own `_name`.
- `tests/book2d.test.js` plays both chapters down their branches (every earlier oath, seat, sire answer and Velati terms; both genders; hunger; each decision flag and gift; the hidden verdict in three bands). `tests/book2c.test.js` now stops chapter 6 as chapter 7 begins, and `tests/book2.test.js`, `tests/book2b.test.js` and `tests/book2c.test.js` expect eight chapters.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 22 notes (Book Two, chapters 9 and 10)

- Book Two chapters 9 and 10 are built (`content/blood-and-gold/ch09.tsb` and `ch10.tsb`, chapter ids `b2c09` and `b2c10`). The manifest entry is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 10 and carries on by itself when chapter 11 is added.
- Session 22 is built on the `session-21` branch, which is not merged to `main` yet. Merge `session-20`, then `session-21`, then `session-22`.
- Chapter 9 opens with a scene at the river (no phase), then a night phase of three actions out of four, then the dawn; it ends with `rest()` and `=> next`. Chapter 10 is one long supper scene with optional questions, then the road home and a dawn scene with the Prince; it ends with `rest()` and `=> next`, which pauses until chapter 11 exists. Chapter 11 should read hunger, standing and secrecy as chapter 10 left them.
- New decision flags, registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b2.clerk`, `b2.guccio`, `b2.ugolino`, `b2.agent_truth`, `b2.prisca_conspiracy`, `b2.faction`, `b2.faction_price` and `b2.prince_told`. Flags that can be skipped have an `unseen` value that the chapter sets on entry.
- New people: Ugolino, Ser Ormanno dell'Ancisa and Monsignor Tullio Savelli. New codex entry: the old mint. New collection pieces: `old_ducat` (only if the dead clerk's purse is quietly kept) and `gray_ring` (if he joined or pretended to join). Content notes: neither chapter adds a new note.
- Script gotcha found while building: a `?if` at the left margin between two `*` choices ends the first choice's menu, so the second choice runs after the first. Indent a conditional that belongs to a choice.
- `florence.mercenaries` is an investment, not a map site, so `chart()` cannot take it.
- `tests/book2e.test.js` plays both chapters down their branches (every court history, both genders, hunger, each decision flag, the optional questions, the ring and the old ducat). `tests/book2d.test.js` now stops chapter 8 as chapter 9 begins, and all the Book Two test files expect ten chapters.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 23 notes (Book Two, chapters 11 and 12)

- Book Two chapters 11 and 12 are built (`content/blood-and-gold/ch11.tsb` and `ch12.tsb`, chapter ids `b2c11` and `b2c12`). The manifest entry is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 12 and carries on by itself when chapter 13 is added.
- Session 23 is built on the `session-22` branch, which is not merged to `main` yet. Merge `session-20`, `session-21`, `session-22` and then `session-23`.
- Chapter 11 is a short opening scene, then a night phase of three actions out of four, then the dawn; it ends with `rest()` and `=> next`. Chapter 12 opens with an arrival, then a day phase of three actions out of four and a dusk scene; it ends with `rest()` and `=> next`, which pauses until chapter 13 exists. Chapter 13 should read hunger, standing and secrecy as chapter 12 left them.
- New decision flags, registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b2.paper`, `b2.guccio_fate`, `b2.savelli`, `b2.watcher_shield`, `b2.sire` and `b2.fiammetta_work`. Flags that can be skipped have an `unseen` value that the chapter sets on entry. `b2.sire` has no `unseen` value because the choice is always reached.
- New person: Messer Guccio (`content/people.json`). No new codex entries or collection pieces. Content notes: neither chapter adds a new note.
- Chapter 12 uses `sire()` for the first time. The option only shows when `can_sire()` is true, so later chapters should read `b2.sire` and `member()` rather than assume. Details are in `SPOILERS/`.
- `tests/book2f.test.js` plays both chapters down their branches (every faction answer, both genders, hunger, each decision flag, every arrival of the girl from the hill, each answer to her request, and the hidden option when he cannot sire). `tests/book2e.test.js` now lets chapter 10 run on into chapter 11, and all Book Two test files expect twelve chapters.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 24 notes (Book Two, chapters 13 and 14)

- Book Two chapters 13 and 14 are built (`content/blood-and-gold/ch13.tsb` and `ch14.tsb`, chapter ids `b2c13` and `b2c14`). The manifest entry is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 14 and carries on by itself when chapter 15 is added.
- Session 24 is built on `main` (session 23 is merged), on the `session-24` branch.
- Chapter 13 is a short opening scene, then a night phase of three actions out of four, then the dawn; it ends with `rest()` and `=> next`. Chapter 14 opens with a ride to Collesanto by day (no phase), then a day phase of three actions out of four and a dusk scene at the gate; it ends with `rest()` and `=> next`, which pauses until chapter 15 exists. Chapter 15 should read hunger, standing and secrecy as chapter 14 left them.
- New decision flags, registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b2.anselm`, `b2.fiammetta_night`, `b2.medici_paper`, `b2.watcher_night`, `b2.prisca_promise` (chapter 13) and `b2.shrine`, `b2.walls`, `b2.ginevra`, `b2.ridge`, `b2.ormanno_man` (chapter 14). Flags that can be skipped have an `unseen` value that the chapter sets on entry. `b2.prisca_promise` and `b2.ormanno_man` have no `unseen` value because those choices are always reached.
- New person: Brother Anselm (`content/people.json`). New collection piece: `sixth_border` (only if he asked the old brother the right question). No new codex entries. Content notes: chapter 13 carries `blood`, chapter 14 carries `violence`.
- Chapter 13 reads `b2.berengaria_debt` and clears it with `unflag` only when the debt is paid by asking the right question. Chapter 14 uses `build("walls")` when `can_build("walls")` is true and the player picks it, and uses the fight system for one exchange set at the gate.
- Tests: `tests/book2g.test.js` plays both chapters down their branches (every pointer to the old brother, all three answers to each decision, hunger, a woman hero, the walls with and without the money, the border piece and the debt, and things left unseen). All Book Two test files now expect fourteen chapters, and `tests/book2f.test.js` lets chapter 12 run on into chapter 13.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 25 notes (Book Two, chapters 15 and 16)

- Book Two chapters 15 and 16 are built (`content/blood-and-gold/ch15.tsb` and `ch16.tsb`, chapter ids `b2c15` and `b2c16`). The manifest entry is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 16 and carries on by itself when chapter 17 is added.
- Session 25 is built on the `session-24` branch, which is not merged to `main` yet. Merge `session-24` and then `session-25` to get everything.
- Chapter 15 is a short opening scene, then a night phase of three actions out of four, then the dawn; it ends with `rest()` and `=> next`. Chapter 16 is a short opening scene, then a day phase of three actions out of four and a dusk scene; it ends with `rest()` and `=> next`, which pauses until chapter 17 exists. Chapter 17 should read hunger, standing and secrecy as chapter 16 left them.
- New decision flags, registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b2.prince_plan`, `b2.company_day`, `b2.ring_task`, `b2.warning`, `b2.prisca_told` (chapter 15) and `b2.duomo`, `b2.nanni_eve`, `b2.agent_easter`, `b2.fiammetta_easter`, `b2.easter_stand` (chapter 16). Flags that can be skipped have an `unseen` value that the chapter sets on entry. `b2.prisca_told` and `b2.easter_stand` have no `unseen` value because those choices are always reached.
- No new people, codex entries, collection pieces or content notes beyond `blood` on both chapters. Neither chapter calls `sire()`, `build()` or the fight system.
- Later chapters should read `b2.easter_stand` and the other flags above rather than recompute them.
- Tests: `tests/book2h.test.js` plays both chapters down their branches (every answer to each decision, hunger, a woman hero, the skipped doors and the unseen values). All Book Two test files now expect sixteen chapters, and `tests/book2g.test.js` lets chapter 14 run on into chapter 15.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 26 notes (Book Two, chapters 17 and 18)

- Book Two chapters 17 and 18 are built (`content/blood-and-gold/ch17.tsb` and `ch18.tsb`, chapter ids `b2c17` and `b2c18`). The manifest entry is still `"incomplete": true`, so the game pauses on "To be continued" after chapter 18 and carries on by itself when chapter 19 is added.
- Session 26 is built on the `session-25` branch, which is not merged to `main` yet (nor is `session-24`). Merge `session-24`, `session-25` and then `session-26` to get everything.
- Chapter 17 has no phase and no `rest()`: an opening scene, then one of three scenes chosen by `b2.easter_stand`, then an aftermath scene, and it ends with `=> next`. Chapter 18 is a short opening scene, then a night phase of three actions out of four, then the dawn; it ends with `rest()` and `=> next`, which pauses until chapter 19 exists. Chapter 19 should read hunger, standing and secrecy as chapter 18 left them.
- New decision flags, registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b2.elevation`, `b2.agent_fall` (chapter 17) and `b2.hunt`, `b2.agent_end`, `b2.panic`, `b2.villa` (chapter 18), plus `b2.agent_turned`, which chapter 18 always sets. Flags that can be skipped have an `unseen` value that the chapter sets on entry.
- No new people, codex entries or collection pieces. Content notes: both chapters carry `violence` and `blood`. Chapter 17 uses the fight system for one optional exchange set.
- Tests: `tests/book2i.test.js` plays both chapters down their branches (every stand, plan, company, girl and clerk, the fight over eight seeds, hunger, a woman hero, each decision flag and the skipped door). All Book Two test files now expect eighteen chapters, and `tests/book2h.test.js` lets chapter 16 run on into chapter 17.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 27 notes (Book Two, chapters 19 and 20)

- Book Two chapters 19 and 20 are built (`content/blood-and-gold/ch19.tsb` and `ch20.tsb`, chapter ids `b2c19` and `b2c20`). **Book Two is finished at twenty chapters**: `"incomplete"` is removed from the manifest, so the book now ends, writes its journal, and unlocks Book Three (which has no chapters yet).
- Session 27 is built on the `session-26` branch, which sits on `session-25` and `session-24`; none of sessions 24 to 26 are on `main` yet. Merge `session-24`, `session-25`, `session-26` and then `session-27` to get everything.
- The manifest entry for Book Two now has `"journal": "journal/blood-and-gold.tsb"` (the Velati journal, written in the voice of the clerk of the Banca del Colle, reading the book's decision flags) and a spoiler light `recap` for quick starts into Book Three. `quickstart.vars` for Book Three are unchanged.
- Chapter 19 is an opening scene, a short hunger scene if he needs it, a day phase of three actions out of four, and a dusk scene; it closes with `=> next` and no `rest()`. Chapter 20 has no phases: it calls `rest()` once and then `sleep("florence_to_paris")`, and closes with `=> next`. The wake report is not shown in Book Two; Book Three's opening reads `wake()`.
- Chapter 20 offers `rest_place`, `steward` (the bank always; Prisca if active in the circle; the Valerio keepers if any of them are in the circle; Fiammetta if she is an active fledgling), `orders`, `protection` and the gap's own investments (`sleep_invest`). Protections are priced by `content/rules.json` at the Florence scale (8), so the story gates them at 80, 160 and 240 coin.
- New decision flags, registered in `content/flags.json` with `book`, `major` and a quick start `default`: `b2.merchant_stance`, `b2.merchant_learned`, `b2.prisca_maker`, `b2.court_end`, `b2.clerk_wake`, `b2.fiammetta_end`, `b2.merchant_fate` (chapter 19) and `b2.last_night`, `b2.agent_letter` (chapter 20). Flags that can be skipped have an `unseen` value that the chapter sets on entry. The Merchant's choice is also recorded by `original_fate("merchant", ...)`, so later books read `original("merchant", "fate")`.
- Later books and the journals should read `b2.merchant_fate`, `b2.clerk_wake`, `b2.fiammetta_end`, `b2.agent_letter`, `b2.court_end` and `b2.prisca_maker` rather than recompute them. The clerk's romance is ended as `turned` in chapter 19 (when the romance had begun), ready for Book Four's return.
- New codex entry: the Merchant (lore). No new people. Content notes: chapter 19 carries `blood` and `grief`, chapter 20 carries `slavery` and `grief`.
- Tests: `tests/book2j.test.js` plays both chapters down their branches (every Merchant tone, stance and answer, every door, the fate and the gift, hunger, a woman hero, every last night, steward, order, guard, investment and letter, the end of the book, the journal). All Book Two test files now expect twenty chapters and a finished book, and `tests/book2i.test.js` lets chapter 18 run on into chapter 19.
- Plans are in `SPOILERS/blood-and-gold.md`.

### Session 29 notes (Book Three, chapters 1 and 2)

- Book Three ("crown-of-ashes") begins. Chapters `b3c01` and `b3c02` are in `content/crown-of-ashes/` (`ch01.tsb`, `ch02.tsb`). The manifest entry is `"incomplete": true`, so the game pauses on "To be continued" after chapter 2 and carries on by itself when chapter 3 is added.
- Chapter 1 reads the chained `wake()` report (place, steward, outcome, who woke him) for every combination, including the quick start report, and the new `wake_invest("id")` function (true if the long sleep was put into that investment; docs/SYSTEMS.md). He wakes in Tuscany, so chapter 1 closes by setting out for Paris and chapter 2 opens on the road. Chapter 1 is a night phase of three actions out of four and ends with `rest()` and `=> next`. Chapter 2 is the road and an arrival (no phase), then a night phase of three actions out of four and a short dawn; it ends with `rest()` and `=> next`, which pauses until chapter 3 exists. Chapter 3 should read hunger, standing and secrecy as chapter 2 left them.
- New decision flags use the `b3.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`: `b3.trouble`, `b3.sugar`, `b3.crane_offer` (chapter 1) and `b3.valere`, `b3.press`, `b3.bread` (chapter 2), with `b3.first_feed`, `b3.king`, `b3.books`, `b3.street`, `b3.prisca_reply`, `b3.titles` and `b3.venture` as smaller notes. Flags that can be skipped have an `unseen` value that the chapter sets on entry.
- New people (`content/people.json`): Etienne, Adelaide and Baptiste Valere, Captain Aubry and Anselme Roux. The Valere are also in `content/family.json` (quick start status: living). New codex entries: the court at Paris, the Wall of the Farmers General and the book trade of the Latin quarter. Content notes: chapter 1 carries `blood`, `violence` and `slavery`, chapter 2 carries `blood`.
- Chapter 2 uses `invest()` for the first time in Book Three (`paris.printing` or `paris.wine`, only if the house can afford it) and charts `paris.valere`, `paris.presses`, `paris.counting` and `paris.court`; chapter 1 charts `collesanto3.crypt` or `collesanto3.road`. Prisca appears only as a letter in this book.
- Tests: `tests/book3.test.js` plays both chapters from nine kinds of waking, down every branch (each way out of being woken early, each way to eat, each answer to the king, the books, the street and Prisca's note; each use of the sleep's investments; every greeting, press, bread and venture choice; the family told or not told), and checks the no dashes and no braces rules.
- Plans are in `SPOILERS/crown-of-ashes.md`.

### Session 30 notes (Book Three, chapters 3 and 4)

- Chapters `b3c03` and `b3c04` are in `content/crown-of-ashes/` (`ch03.tsb`, `ch04.tsb`). The manifest entry stays `"incomplete": true`, so the game pauses on "To be continued" after chapter 4 and carries on by itself when chapter 5 is added.
- Both chapters open on a short scene with no phase (the drive and the Prince's house; the thaw), then one night phase of three actions out of four, then a closing scene. Each ends with `rest()`; chapter 3 ends with `rest()` and `=> next`, and chapter 4 the same. Chapter 5 should read hunger, standing and secrecy as chapter 4 left them. Each has a short hunger scene that only runs if `must_feed()` is true on entry.
- New decision flags use the `b3.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`: `b3.salon`, `b3.severin`, `b3.trial`, `b3.octave`, `b3.roll`, `b3.weapon`, `b3.price` (chapter 3) and `b3.presses_use`, `b3.abolition`, `b3.raid`, `b3.gallery`, `b3.paster` (chapter 4). Flags that can be skipped are set to their default on entry.
- New people (`content/people.json`): the Marquise de Serignan, Severin de Lasalle, Monsieur de Brezac and Inspector Garnier. New codex entries: the Peace, a Lictor in Paris, the Remembrancer's roll, the Estates General, the cahiers, the Friends of the Blacks and the quarries. Content notes: chapter 3 carries `blood` and `violence`, chapter 4 carries `blood` and `slavery`.
- Chapter 3 uses the fight system once (an optional bout, `fight("elder")`, with a first blood version) and charts `paris.court`. Chapter 4 offers `acquire("hidden_chamber")` for the quarry chamber if the house can afford it, and charts `paris.haven` and `paris.rebels`.
- Tests: `tests/book3b.test.js` plays both chapters down every choice and every flag value, for every press, venture and hunger state, and checks the no dashes and no braces rules. `tests/book3.test.js` now expects four written chapters: update that count each session.
- Plans are in `SPOILERS/crown-of-ashes.md`.

### Session 31 notes (Book Three, chapters 5 and 6)

- Chapters `b3c05` and `b3c06` are in `content/crown-of-ashes/` (`ch05.tsb`, `ch06.tsb`). The manifest entry stays `"incomplete": true`, so the game pauses on "To be continued" after chapter 6 and carries on by itself when chapter 7 is added.
- Both chapters open on a short scene with no phase, then one night phase of three actions out of four, then a dawn. Each ends with `rest()` and `=> next`. Each has a short hunger scene that only runs if `must_feed()` is true on entry. Chapter 7 should read hunger, standing and secrecy as chapter 6 left them.
- New decision flags use the `b3.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`: `b3.cadets`, `b3.list`, `b3.galerius`, `b3.grain`, `b3.aubry` (chapter 5) and `b3.riot`, `b3.veil`, `b3.wounded`, `b3.council` (chapter 6). Flags that can be skipped are set to their default on entry (`b3.list` is `unseen` unless the Prince's paper was read).
- Chapter 5 offers a fourth action that depends on an earlier choice: the Prince's paper if `b3.weapon` is `accepted`, otherwise Aubry's drill.
- New people (`content/people.json`): Clemence Roche and Thibault Marchand. New codex entries: the Cadets and the Reveillon riot. Content notes: chapter 5 carries `blood`, chapter 6 carries `blood` and `violence`.
- Chapter 5 charts `paris.rebels`, `paris.counting`; chapter 6 charts `paris.rebels` and `paris.court`. No new engine behavior, so no new schema or migration.
- Tests: `tests/book3c.test.js` plays both chapters down every choice and flag value, for every earlier state that they read, and checks the no dashes and no braces rules. `tests/book3.test.js` now expects six written chapters: update that count each session.
- Plans are in `SPOILERS/crown-of-ashes.md`.

### Session 32 notes (Book Three, chapters 7 and 8)

- Chapters `b3c07` and `b3c08` are in `content/crown-of-ashes/` (`ch07.tsb`, `ch08.tsb`). The manifest entry stays `"incomplete": true`, so the game pauses on "To be continued" after chapter 8 and carries on by itself when chapter 9 is added.
- Chapter 7 opens on a short scene with no phase, then one night phase of three actions out of four, then a dawn, a day scene (he cannot see it) and a dusk, and ends with `rest()` and `=> next`. Chapter 8 opens on a short scene with no phase, then one night phase of three actions out of four and a dawn, and ends with `rest()` and `=> next`. Each has a short hunger scene that only runs if `must_feed()` is true on entry. Chapter 9 should read hunger, standing and secrecy as chapter 8 left them.
- New decision flags use the `b3.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`: `b3.barrier`, `b3.file`, `b3.night`, `b3.broadsheet` (chapter 7) and `b3.granary`, `b3.greve`, `b3.lictor`, `b3.muskets` (chapter 8). Flags that can be skipped are set to their default on entry.
- No new people. New codex entries: the Bastille and the Great Fear. Content notes: both chapters carry `blood` and `violence`.
- Chapter 7 charts `paris.rebels`, `paris.presses` and `paris.court`; chapter 8 charts `paris.counting`, `paris.rebels` and `paris.court`. Chapter 8 can call `invest("paris.arms")` (only if the house can afford it) and `earn()` for the granary. No new engine behavior, so no new schema or migration.
- Tests: `tests/book3d.test.js` plays both chapters down every choice and flag value, for every earlier state that they read, and checks the no dashes and no braces rules. `tests/book3.test.js` now expects eight written chapters (update that count each session). `tests/book3c.test.js` gained a `stopAt` for its chapter 5 run, because chapter 6 now leads on.
- Plans are in `SPOILERS/crown-of-ashes.md`.

### Session 33 notes (Book Three, chapters 9 and 10)

- Chapters `b3c09` and `b3c10` are in `content/crown-of-ashes/` (`ch09.tsb`, `ch10.tsb`). The manifest entry stays `"incomplete": true`, so the game pauses on "To be continued" after chapter 10 and carries on by itself when chapter 11 is added.
- Chapter 9 opens on a short scene with no phase, then one night phase of three actions out of four, then a fixed closing scene that every player plays, then a dawn. Chapter 10 opens on a short scene with no phase, then one night phase of three actions out of four and a dawn. Each ends with `rest()` and `=> next`, and each has a short hunger scene that only runs if `must_feed()` is true on entry. Chapter 11 should read hunger, standing and secrecy as chapter 10 left them.
- New decision flags use the `b3.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`: `b3.rights`, `b3.exodus`, `b3.boy`, `b3.protest`, `b3.hunt` (chapter 9) and `b3.versailles`, `b3.courier`, `b3.vault`, `b3.march` (chapter 10). Flags that can be skipped are set to their default on entry, so a chapter that sets a flag in its own night phase cannot be seeded with that flag from a test.
- No new people. New codex entries: the Declaration, the Innocents, the October days, the Avignon account and the third cellar. Content notes: both chapters carry `blood` and `violence`.
- Chapter 9 uses the fight system once (`fight("lictor", 3)`) and charts `paris.presses`, `paris.rebels` and `paris.court`. Chapter 10 charts `paris.court`, `paris.rebels` and `paris.counting`, and can call `earn()`. No new engine behavior, so no new schema or migration.
- Tests: `tests/book3e.test.js` plays both chapters down every choice and flag value, for every earlier state that they read, runs the fight across forty seeds, and checks the no dashes and no braces rules. `tests/book3.test.js` now expects ten written chapters (update that count each session). `tests/book3d.test.js` now checks that chapter 8 leads on to chapter 9.
- Plans are in `SPOILERS/crown-of-ashes.md`.

### Session 34 notes (Book Three, chapters 11 and 12)

- Chapters `b3c11` and `b3c12` are in `content/crown-of-ashes/` (`ch11.tsb`, `ch12.tsb`). The manifest entry stays `"incomplete": true`, so the game pauses on "To be continued" after chapter 12 and carries on by itself when chapter 13 is added.
- Chapter 11 opens on a short scene with no phase, then one night phase of three actions out of four and a dawn. Chapter 12 opens on a short scene with no phase, then one night phase of three actions out of four, a morning scene, a fixed closing scene that every player plays, and an aftermath. Each ends with `rest()` and `=> next`, and each has a short hunger scene that only runs if `must_feed()` is true on entry. Chapter 13 should read hunger, standing and secrecy as chapter 12 left them.
- New decision flags use the `b3.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`: `b3.nationals`, `b3.charter`, `b3.senate`, `b3.federation` (chapter 11) and `b3.flight`, `b3.republic`, `b3.coup`, `b3.garnier`, `b3.champ` (chapter 12). Flags that can be skipped are set to their default on entry, so a chapter that sets a flag in its own night phase cannot be seeded with that flag from a test.
- No new people. New codex entries: the national lands, the Declaration of the Blood, the Senate's letter, the Champ de Mars, the flight to Varennes, the word Republic, Inspector Garnier and the seventeenth of July. Content notes: chapter 11 carries `blood`, chapter 12 carries `blood` and `violence`.
- Chapter 11 charts `paris.counting`, `paris.rebels` and `paris.court`, and can call `earn()` for the convent. Chapter 12 charts `paris.court`, `paris.rebels`, `paris.presses` and `paris.counting`, and can add `injury`. No fights, no new engine behavior, so no new schema or migration.
- The hero cannot see the day, so the daytime events in both chapters are told to him at dusk rather than shown.
- Tests: `tests/book3f.test.js` plays both chapters down every choice and flag value, for every earlier state that they read, and checks the no dashes, no braces and no daylight rules. `tests/book3.test.js` now expects twelve written chapters (update that count each session). `tests/book3e.test.js` now stops at chapter 11 where it used to rely on the pause after chapter 10.
- Plans are in `SPOILERS/crown-of-ashes.md`.

### Session 35 notes (Book Three, chapters 13 and 14)

- Chapters `b3c13` and `b3c14` are in `content/crown-of-ashes/` (`ch13.tsb`, `ch14.tsb`). The manifest entry stays `"incomplete": true`, so the game pauses on "To be continued" after chapter 14 and carries on by itself when chapter 15 is added.
- The design doc has no list for these two chapters beyond the book outline, so they were planned in `SPOILERS/crown-of-ashes.md` from the hooks chapter 12 left. Check the plan against your own intentions for chapters 15 to 20 before building them.
- Chapter 13 opens on a short scene with no phase, then one night phase of three actions out of four, an autumn told at dusk and a fixed closing scene every player plays. Chapter 14 opens on a short scene with no phase, then one night phase of three actions out of four, a day told at dusk and a fixed closing scene every player plays. Each ends with `rest()` and `=> next`, and each has a short hunger scene that only runs if `must_feed()` is true on entry. Chapter 15 should read hunger, standing and secrecy as chapter 14 left them.
- New decision flags use the `b3.` prefix and are registered in `content/flags.json` with `book`, `major` where later chapters care, and a quick start `default`: `b3.key`, `b3.cadets_home`, `b3.journal`, `b3.aubry_post`, `b3.war` (chapter 13) and `b3.brezac`, `b3.faubourg`, `b3.palace`, `b3.baptiste`, `b3.slate` (chapter 14). Flags that can be skipped are set to their default on entry, so a chapter that sets a flag in its own night phase cannot be seeded with that flag from a test.
- No new people. New codex entries: the key to the third cellar, the Constitution of 1791, the war of 1792, the Swiss Guard, the tenth of August and the second line. Content notes: chapter 13 carries `blood`, chapter 14 carries `blood`, `violence` and `war`.
- Chapter 13 charts `paris.court`, `paris.rebels`, `paris.presses` and `paris.counting`, and calls `earn()`. Chapter 14 charts `paris.court`, `paris.rebels` and `paris.presses`. No fights, no new engine behavior, so no new schema or migration.
- The hero cannot see the day, so the daytime events in both chapters are told to him at dusk rather than shown. The Cadets sit out the assault on the palace because it happens in daylight.
- Tests: `tests/book3g.test.js` plays both chapters down every choice and flag value, for every earlier state that they read, and checks the no dashes, no braces and no daylight rules. `tests/book3.test.js` now expects fourteen written chapters (update that count each session). `tests/book3f.test.js` now stops at chapter 13 where it used to rely on the pause after chapter 12.
- Plans are in `SPOILERS/crown-of-ashes.md`.
