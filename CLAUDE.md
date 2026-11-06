# Working in this repo

The Sixth Blood is a choice game (vampire series, seven books) played as a PWA from GitHub Pages. Read `DESIGN.md` first, then `docs/SCRIPT_FORMAT.md` and `docs/SAVES.md` as needed. The full design and the 85 session build plan live in the claude.ai docs named in `DESIGN.md`.

## Spoiler policy (important)

The owner plays the game and wants to be surprised by chapter level choices and details.

- Never put chapter plans, choices, consequences or twists in chat replies, build reports, commit messages, PR text, `DESIGN.md`, or anything outside `SPOILERS/`.
- Chapter plans live in `SPOILERS/`. The owner does not open that folder. Each build session plans and writes from there.
- Build reports stay spoiler free, for example: "Book One, Chapters 3 and 4 done, about 8,000 words, ready to play".
- Anything that would change the big picture (killing a major character early, altering a core lore rule) is flagged to the owner first, in a spoiler light way.

## Commands

- `npm test` runs the test suites. `npm run check` validates every chapter in the manifest. Run both before committing.
- Serve locally with any static server, for example `python3 -m http.server`, and open `index.html`.

## Rules for changes

- Engine code in `engine/` must not touch the DOM, `window` or `localStorage`. Browser code lives in `app/`.
- Changing the shape of game state: bump `SCHEMA` and add a schema migration (docs/SAVES.md).
- Renaming or repurposing a flag or stat: bump `contentVersion` in `content/manifest.json` and add a content migration.
- Editing a released chapter: bump its `@version`.
- Every path through a scene ends in `->`, `<~` or `=>`. The checker warns about scenes that can run off their end.
- Add a test for every new engine behavior, especially anything that touches saves.
