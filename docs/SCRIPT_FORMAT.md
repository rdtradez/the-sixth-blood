# Story script format (.tsb)

Every chapter is one plain text file in `content/`, listed in `content/manifest.json`. The format is line based, so writing a chapter is mostly writing prose. Run `npm run check` after editing; errors name the file and line.

## A small example

```
@chapter b1c01
@title The Road In
@book burning-city
@version 1
@next b1c02

# start
## Dusk
The road bends toward the gate.
Your hunger is {hunger > 60 ? "a fist in your gut" : "quiet"}.
---
The guard watches you come.
* Greet him
  $ standing += 2
  He nods and waves you through.
* Walk past in silence [once]
  $ cunning_brutal += 3
  He lets you pass, uneasy.
* Take the guard's coin ?if cunning_brutal > 20
  $ wealth += 5
  His purse is lighter by morning.
-> inside

# inside
The city opens ahead.
=> next
```

## Header (before the first scene)

| Line | Meaning |
| --- | --- |
| `@chapter id` | Required. Must match the id in the manifest. |
| `@title text` | Shown in the chapter bar and on save slots. |
| `@book id` | The book id (informational). |
| `@version n` | Whole number, starts at 1. **Bump it when you edit a released chapter.** See docs/SAVES.md. |
| `@start scene` | Scene to begin in. Default `start`. |
| `@next chapter_id` | Chapter after this one. Default: the next chapter in the manifest. |

## Scenes

`# name` starts a scene (letters, digits, underscore). A chapter is a set of scenes joined with `->`, `~>` and choices. **Every path through a scene must end** in `->`, `<~` or `=>`. A scene that runs off its end is an error at play time and a warning from the checker.

## Lines

| Line | Result |
| --- | --- |
| `plain text` | A paragraph. |
| `## text` | A heading. |
| `> text` | A quote (letters, journal entries). |
| `\text` | A paragraph that starts with a special character, for example `\* not a choice` or `\=> literally`. |
| `---` | Page break. The player taps Continue. Use it to pace long scenes. |
| `// note` | Comment. Ignored. |

`*italic*` and `**bold**` are supported in text and choices. A line that starts with `* ` (star, space) is a choice, so `*italic start*` is safe.

### Inserting values: `{expression}`

`Gold is {_gold}.` Use `\{` and `\}` for literal braces. A true or false value prints as yes or no. An unset variable reads as `0`. Pronouns and names have shorthand, see [Pronouns and names](#pronouns-and-names).

Stats are never printed as numbers in story text (the checker warns about `{hunger}`). Describe them with [story voice](#stats-in-story-voice): `{voice("hunger")}`.

## Commands (`$`)

```
$ gold = 5              set
$ gold += 3             also -=  *=  /=
$ name = "Livia"        strings work
$ flag met_cassian saw_fire     set flags to true
$ unflag saw_fire               remove a flag
$ do name(arg, arg)             call a command the game registered (new systems use this)
```

Declared stats (see `content/stats.json`) are clamped to their range on every change and start at their declared value. A name like `loyalty.*` there covers every variable starting `loyalty.`, so `$ loyalty.livia += 10` is clamped 0 to 100. Variables that are not declared are free: set them any time.

Flag and variable names: letters, digits, underscore, dots. `__proto__`, `constructor` and `prototype` are not allowed.

**Every variable must be registered** so typos are caught by `npm run check`: a declared stat (`content/stats.json`), an entry in the flag registry (`content/flags.json`), a person field (`livia.name`, `spouse.gender`, from `content/people.json`), or a scratch variable whose name starts with `_` (`$ _tries += 1`). See [The flag registry](#the-flag-registry).

## Conditions

```
?if gold >= 10 and not met_cassian
  text, commands, choices, anything
?elif hunger > 80
  ...
?else
  ...
?end
```

Blocks nest. Every `?if` needs a `?end`.

## Choices

```
* Text shown to the player
  $ standing += 1          the body is indented under the choice
  What happens next.
* Another option ?if gold > 5      only shown when the condition is true
  ...
* A one time option [once]         disappears after it is picked
  ...
After the choices.         NOT indented: where all options rejoin
```

- Indent a choice's body by at least one space (two is the convention).
- A choice whose body does not jump simply **rejoins**: play continues at the first unindented line after the whole set. Branches that end in `->` or `=>` do not rejoin.
- An empty body is fine and also rejoins.
- If no option is visible, the game logs a warning and continues past the set rather than getting stuck.
- Modifiers combine in this order: `* Text [once] ?if cond`. The `[once]` goes before the `?if`.

## Moving around

| Line | Meaning |
| --- | --- |
| `-> scene` | Go to a scene in this chapter. |
| `-> :label` | Jump to a label in this scene (loops). |
| `:label` | A label. Also an **anchor** for saves, see below. |
| `~> scene` | Call a scene like a subroutine. |
| `<~` | Return from a called scene. |
| `=> next` | End the chapter and start the next one. |
| `=> chapter_id` | End the chapter and jump to a specific chapter. |
| `=> endbook` | End the chapter and the book. The book is marked finished. |

### Labels as save anchors

A save stores where the story is waiting. When a chapter is edited after a save, the engine finds the same moment again (see docs/SAVES.md). You can make that exact by putting a label directly before a `---` or a choice set that matters, such as a big decision or a chapter climax:

```
:the_choice
* Spare him
* End him
```

If the text around it is rewritten later, a save at that moment still lands in the right place.

## Expressions

Numbers, strings (`"..."` or `'...'`), `true`, `false`, variables, `( )`, and:

`+ - * / %`   `== != < <= > >=`   `and or not` (also `&& || !`)   `cond ? a : b`

There is no way to run arbitrary code. Functions available everywhere:

| Function | Result |
| --- | --- |
| `min(a,b,...)` `max(...)` `abs(x)` `round(x)` `floor(x)` `ceil(x)` `clamp(x, lo, hi)` | Maths. |
| `has("name")` | True if the variable has ever been set. |
| `chance(0.25)` | True 25% of the time (seeded, see below). |
| `roll(6)` | A whole number from 1 to 6. |
| `visited("scene")` | How many times a scene in this chapter was entered. `visited("chapter.scene")` for another chapter. |
| `lower(s)` `upper(s)` `cap(s)` | Text case. |
| `voice("stat")` `voice("stat", "short")` `band("stat")` | Stats in story voice, below. |
| `name("who")` `alias("who")` `surname("who")` `pro("who", "their")` `g(m, f, x)` `pg("who", m, f, x)` `gender("who")` | Pronouns and names, below. |
| `variant("tag", ...)` or `[tag tag]` | Origin variants, below. |

Randomness is seeded per game and saved with it, so reloading a save does **not** reroll a roll.

## Stats in story voice

`content/voice.json` gives every stat ordered bands, each with an `id`, an `upTo` (inclusive, left out on the last band) and its texts:

| Write | Result (hunger 45) |
| --- | --- |
| `Right now {voice("hunger")}.` | Right now your hunger gnaws at you. |
| `{voice("hunger", "short")}` | hungry |
| `?if band("hunger") == "starving"` | condition on the band, never the number |

`say` is the default form (a clause for mid sentence), `short` is a word or two, `status` is the sentence shown in the menu's "How you are" section. Stats marked `hidden` (defiance, adjustment) never appear in the menu. Per person stats share bands: `{voice("loyalty.prisca")}`. Write your own lines with `band()` when the stock phrasing does not fit the moment.

## Pronouns and names

People live in `content/people.json`: a `gender` (`m`, `f`, `x`, or `opposite:hero`), a `name` or `names` by gender (the spouse is Livia or Marcus), and for the hero `aliases` and `surnames` by book. The story can override any of these: `$ spouse.gender = "m"`, `$ hero.name = "Brica"`, `$ hero.alias = "Signor del Colle"`.

Pronoun words are the **"they" words**, because they are never ambiguous ("his" could be "her" or "hers"):

| Shorthand | he / she / they |
| --- | --- |
| `{they}` | he / she / they |
| `{them}` | him / her / them |
| `{their}` | his / her / their |
| `{theirs}` | his / hers / theirs |
| `{themself}` | himself / herself / themself |
| `{are}` `{were}` `{have}` | is, was, has / are, were, have |
| `{s}` `{es}` | `walk{s}`: walks / walk |

Capitalize the word to capitalize the result: `{They} {are} here.` Put a person id in front for anyone else: `{cassian.They} {cassian.are} pale.`, `{spouse.their} cup`. Capitalize the word, not the person (`{spouse.They}`).

| Shorthand | Result |
| --- | --- |
| `{name}` `{livia.name}` `{Name}` | the hero's or a person's name |
| `{alias}` | the hero's business alias in this book's era, or the name if none |
| `{surname}` | the family name in this book's era (Valerius, Valerio, Valère, Valer) |
| `{g("man", "woman")}` | a word by the hero's gender (an optional third for they) |
| `{pg("spouse", "husband", "wife")}` | a word by anyone's gender |

These words are reserved in `{}`: a variable named `they` or `name` cannot be printed directly.

## Origin variants

The hero's origin, mortal role and arrival path (`hero.origin`, `hero.role`, `hero.path`) are tags, listed in `content/origins.json`: `roman gaul briton north_african egyptian judean parthian silk_road`, `gladiator legionary merchant physician_aide house_slave`, `born_in_rome captured freed auxiliary hostage trader exile wanderer`.

**A line for some origins only.** Start any line with tags in square brackets. Several tags mean any of them; `not` (or `!`) means none of them.

```
The legion marches past.
[briton gaul] You know those eagles. You watched them burn your home.
[roman] You grew up cheering them.
[not roman gaul briton] To you they are just another empire's soldiers.
[gladiator] $ standing += 2
```

A plain paragraph that really starts with lowercase words in brackets needs a backslash: `\[sic] ...`.

**Tags in conditions** work anywhere an expression does: `?if [judean] and humanity > 50`, or on a choice: `* Answer in Aramaic ?if [judean]`.

**A whole alternate version of a key moment.** Write the shared scene, then versions named `scene_<tag>`. Jump with the group in brackets; the hero's version is used if it exists, otherwise the shared one:

```
-> the_arrest [origin]      uses the_arrest_judean for a Judean hero, else the_arrest
~> memory_of_home [origin]  also works with calls
-> first_fight [role]       [role] and [path] work the same way
```

The shared scene is required. Variant scenes count as reachable for the checker.

## The flag registry

`content/flags.json` lists every story variable that is not a stat, a person field or an `_scratch` variable:

```json
"spared_igniferi": { "kind": "flag", "book": "burning-city", "major": true, "default": false },
"prisca_fate": { "kind": "enum", "values": ["stayed", "left"], "book": "burning-city", "major": true, "default": "stayed" },
"met.*": { "kind": "flag" }
```

- `kind`: `flag` (set with `$ flag`, true or unset), `enum` (one of `values`; `"@origins"`, `"@roles"`, `"@paths"` pull them from origins.json), `number`, or `text`.
- `book`: where it is decided. `major: true` puts it in the **decision log** (`state.decisions`), which journals and cross book callbacks read.
- `default`: what a **quick start** uses for this flag when it skips that book. A flag default of `false` simply stays unset.
- A name ending in `.*` covers a family (`met.prisca`, `met.cassian`).

`npm run check` rejects unregistered variables (a typo like `spared_igniferri` becomes an error instead of a silent `0`), enum values that are not listed (in `$` lines and `==` comparisons), `$ flag` on a non flag, unknown variant tags, unknown people, and `voice()` on a stat without bands. At play time an unlisted enum value logs a warning.

Changing a registered name or what a value means still needs a content migration (docs/SAVES.md).

## The journal

`$ do journal("text", "optional title")` adds an entry to the Previously screen shown when a book begins. Each book's Velati journal entry is written by a journal script at the end of the book; see [docs/SYSTEMS.md](SYSTEMS.md#the-velati-journal).

## Game systems

Phases, feeding, combat, Collis, Collesanto, the coven and missions, bonds, the originals, the collection and the long sleep are functions and `$ do` commands documented in [docs/SYSTEMS.md](SYSTEMS.md).

## Adding new systems (for later sessions)

New game systems register through the `Game` constructor:

- `fns: { name: (ctx, ...args) => value }` adds expression functions (for example pronouns or story voice helpers).
- `commands: { name: (ctx, ...args) => {} }` adds `$ do name(...)` commands. `ctx.state` is the live game state.

The parser rejects unknown functions at load time, and the checker rejects unknown commands, so typos are caught before play.
