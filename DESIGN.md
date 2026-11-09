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
- [x] Sessions 5 to 7: character creation and the prologue, the Rome map, Book One chapters 1 and 2 (Book One is in progress)

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
