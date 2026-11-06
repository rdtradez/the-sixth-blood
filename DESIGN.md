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
| `engine/game.js` | Controller: loading chapters, chapter flow, autosave, load with repair, library and the three start options. |
| `engine/fetch-loader.js`, `node-loader.js` | Content loaders for browser and Node. |
| `app/` | Reader UI: library, book start options, Previously screen, story view, menu (status and saves). |
| `content/` | `manifest.json` (all seven books), `stats.json`, `flags.json`, `voice.json`, `people.json`, `origins.json`, `migrations.js`, chapters. |
| `tests/` | `node --test` suites. |
| `tools/check.js` | Content checker (`npm run check`). |

## Books

The manifest lists the seven books in order with city, era and accent colors. The Lost Centuries interludes are written as chapters at the end of The Burning City, and The Long Watch as chapters at the start of Unchained, so each stays inside its book's saves and unlock order. Developer books (`"dev": true`) appear only in developer mode (`?dev` in the address).

## Build plan progress

Engine, 4 sessions, then books. The full 85 session checklist with commands is in the "The Sixth Blood Build Sessions" doc.

- [x] Session 1: engine core, script format, saves, save versioning
- [x] Session 2: flags, story voice stats, pronouns and names, origin variants, library screen
- [ ] Session 3: game systems
- [ ] Session 4: player features, developer tools, look and feel, sample chapter

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
