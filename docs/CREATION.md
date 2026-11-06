# Character creation and appearance

Built in session 5. The hero is made on the creation screen (`app/creation.js`) before Book One. Everything it draws comes from `engine/creation.js` and `content/`, so the rules are the same in a test as on a phone.

## What the player chooses

Gender (a man or a woman), homeland, name, mortal role, how the hero came to Rome, and an appearance. The finished hero is `{ gender, name, origin, role, path, look }` and goes to `game.startBook("burning-city", { from: "new", hero })`. Quick start takes the same object, built by `game.suggestHero(...)`.

Origins, roles and paths live in `content/origins.json` (see docs/SCRIPT_FORMAT.md, Origin variants). For the creation screen they also carry:

| Field | Meaning |
| --- | --- |
| `blurb` | The line shown when the option is selected. Origins, roles and paths all have one. |
| role `paths` | The arrival paths that fit the role. The screen offers only these. |
| role `notFor`, path `notFor` | Origins the option is not offered to (a Roman citizen was never a captive). |
| origin `roles`, `paths` | The suggested picks, offered first and used as defaults. |

Scripts and `heroVars()` accept any combination; only the screen is picky. `npm run check` fails if an origin has no role, a role has no path for an origin, or a suggestion cannot be offered.

Useful calls: `game.creationOptions()` (everything the screen draws), `game.compatiblePaths(origin, role)`, `game.lookChoices(origin)` (skin tones depend on the origin), `game.suggestHero(partial, random)` (fits role, path, name and look; pass a generator or seed for quick create's varied look), `game.describeLook(look)`, `game.heroLook()`.

## Appearance

`content/looks.json` lists the options for height, build, age at turning, hair color, hair style, eyes, skin tone and a mark. The choices are stored as `hero.look.<field>` (text variables, already in the flag registry) and are fixed for the whole series.

| In a script | Result |
| --- | --- |
| `{look("height")}` | `tall`. Fields: height, build, age, hair, hairstyle, eyes, skin, mark. |
| `{look("mark")}` | A phrase that follows "You carry", for example `a pale scar from the arena down your ribs`. Empty when there is no mark. |
| `?if marked()` | True when the hero has a mark. |
| `{look_sentence()}` | The whole description as one paragraph, in the second person. |
| `?if hero.look.age == "young"` | Compare the stored id when the story branches on it (a young looking hero mistaken for a teenager, an older looking one called sir). |

Option ids are in `content/looks.json`; the checker rejects `look()` on an unknown field. Skin tones are limited per origin (`skin_by_origin`). `suggest` gives fitting hair, eyes, styles, builds, heights and marks per origin and per role, first listed first (a gladiator is suggested an arena scar). Add an option by adding it to its field and, if it should be suggested, to `suggest`.

The You screen in the menu shows the hero's description.

## Books that are still being written

A book in the manifest can set `"incomplete": true`. When its last written chapter ends with `=> next`, the game pauses on a "To be continued" screen instead of finishing the book (no journal, no carry save, no unlock of the next book, no achievements for the book). The pause is saved. Once a later session adds the next chapter, loading that save carries straight on into it. Remove `"incomplete"` when the book's last chapter is written.

A manifest chapter can set `"prologue": true`. It is shown as "Prologue" and is not counted: the chapters after it are numbered from 1, and the library counts only numbered chapters.
