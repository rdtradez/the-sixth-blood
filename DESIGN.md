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
| `engine/game.js` | Controller: loading chapters, chapter flow, autosave, load with repair, library and the three start options, the Velati journal at each book's end. |
| `engine/systems/` | Game systems: day and night, feeding, combat, Collis, Collesanto, coven and missions, bonds, originals, collection, sleep and steward (docs/SYSTEMS.md). |
| `engine/fetch-loader.js`, `node-loader.js` | Content loaders for browser and Node. |
| `app/` | Reader UI: library, book start options, Previously screen, story view, menu (status and saves). |
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
