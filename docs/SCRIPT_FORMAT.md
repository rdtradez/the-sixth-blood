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

`Your gold is {gold}.` `{he}` and friends arrive with the pronoun system. Use `\{` and `\}` for literal braces. A true or false value prints as yes or no. An unset variable reads as `0`.

Per the design doc, stats are described in the story's voice rather than printed as raw numbers. Prefer `{hunger > 60 ? "a fist in your gut" : "quiet"}` to `{hunger}`. Session 2 adds a helper for this.

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

Randomness is seeded per game and saved with it, so reloading a save does **not** reroll a roll.

## Adding new systems (for later sessions)

New game systems register through the `Game` constructor:

- `fns: { name: (ctx, ...args) => value }` adds expression functions (for example pronouns or story voice helpers).
- `commands: { name: (ctx, ...args) => {} }` adds `$ do name(...)` commands. `ctx.state` is the live game state.

The parser rejects unknown functions at load time, and the checker rejects unknown commands, so typos are caught before play.
