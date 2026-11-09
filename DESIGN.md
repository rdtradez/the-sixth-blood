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
- The prologue plan is in `SPOILERS/`. Session 6 (Rome map) is next.
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
- New gaps in `content/sleep.json`: `rome_to_sack`, `sack_to_byzantium`, `byzantium_to_florence`. Interlude B should split the last one into two segments (532 to 1348, then 1348 to Florence).
- New flags use the `lc.` prefix, all registered with `major` and a quick start default (`lc.mason` is not major). New people, codex entries and one collection item are registered.
- Chapter journals: `content/journal/lc-410.tsb` and `lc-537.tsb`.
- `tests/interlude-a.test.js` covers the chain report, chapter journals, ordering and flags. `tests/book1j.test.js` uses `stopAt: 'lc01'` for chapter 20 checks.
- Plans for these chapters are in `SPOILERS/lost-centuries.md`.
