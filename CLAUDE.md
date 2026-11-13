# Working in this repo

The Sixth Blood is a choice game (vampire series, seven books) played as a PWA from GitHub Pages. Read `DESIGN.md` first, then `docs/SCRIPT_FORMAT.md` and `docs/SAVES.md` as needed. The full design and the 85 session build plan live in the claude.ai docs named in `DESIGN.md`.

## Spoiler policy (important)

The owner plays the game and wants to be surprised by chapter level choices and details.

- Never put chapter plans, choices, consequences or twists in chat replies, build reports, commit messages, PR text, `DESIGN.md`, or anything outside `SPOILERS/`.
- Chapter plans live in `SPOILERS/`. The owner does not open that folder. Each build session plans and writes from there.
- Build reports stay spoiler free, for example: "Book One, Chapters 3 and 4 done, about 8,000 words, ready to play".
- Anything that would change the big picture (killing a major character early, altering a core lore rule) is flagged to the owner first, in a spoiler light way.

## The coven (owner's design direction)

- The coven is a family, not a staff list. Write its members with warmth, history with the hero and their own wants.
- The coven is the hero's arm when he is not present: what they do while he is away or asleep should matter in the story, not only in the numbers.
- It is the only known coven of the sixth bloodline. That makes it rare and precious, and the world should treat it that way.
- Once a coven is started it is a significant part of the story in every later book. Keepers (sworn humans) are kept apart from the turned.
- The engine side exists (Coven tab, standing tasks, a report at each chapter start, missions). Book sessions should add scenes that use it.
- Front and center: each book's waking is voiced by the coven's business lead (`business_lead()`), who holds the lantern, gives the report and lays out the desk. The coven and the hero's human family are already in contact when he wakes, and the lead makes the introductions in each new city.
- Never write a scene that names a coven member without checking they are in the coven (`in_circle("name")` and an active status). A player's coven may be any mix of Prisca, Fiammetta, Hanno, Thibault, Tiro and the rest. Run `npm run coven-names` to find lines that do not check.
- Gifts: the hero and every member have named gifts (`has_gift`, `member_has_gift`, `gift_holder`). Every book should give them real moments.
- Each book opening carries a village beat: a letter from the hill with a build, send or wait choice.
- In every chapter plan, at least one coven member is in the chapter's main thread with their own want.

## Commands

- `npm test` runs the test suites. `npm run check` validates every chapter in the manifest. Run both before committing.
- Serve locally with any static server, for example `python3 -m http.server`, and open `index.html`.

## Rules for changes

- Engine code in `engine/` must not touch the DOM, `window` or `localStorage`. Browser code lives in `app/`.
- Changing the shape of game state: bump `SCHEMA` and add a schema migration (docs/SAVES.md).
- Every story variable is registered: a stat in `content/stats.json`, an entry in `content/flags.json`, a person field from `content/people.json`, or an `_scratch` name. Give decision flags a `book`, `major: true` if later chapters or journals care, and a quick start `default`.
- Stats are written in the story's voice (`voice()`, `band()`), never printed as numbers.
- Renaming or repurposing a flag or stat: bump `contentVersion` in `content/manifest.json` and add a content migration.
- Editing a released chapter: bump its `@version`.
- Every path through a scene ends in `->`, `<~` or `=>`. The checker warns about scenes that can run off their end.
- Add a test for every new engine behavior, especially anything that touches saves.
