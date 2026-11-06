# Book One: The Burning City (plans and notes)

Spoilers. The owner does not open this folder.

## Prologue: "The Last Quiet Day" (built in session 5, `content/burning-city/prologue.tsb`, chapter id `b1p`)

Built from the design doc's Book One prologue paragraph: origin and role, life in Collesanto with the spouse, Aelia and Felix, a hint of defiance, the dying, the stranger's question, waking in the villa.

Shape (scenes in order): start (morning, children running, spouse, own reflection via `look_sentence()`, role memory, path line) -> the_day (choice) -> the_square (tax collector's man takes a boy's goat; origin voice; the defiance hint; choice) -> the_evening (the story of before, told per origin; Aelia asks if you want to go back; spouse on the step) -> the_end (death by role) -> the_stranger (the question) -> the_waking.

Choices, all registered and logged as decisions (`major`):
- `prologue.day`: children (bonds with both children), fields (bond with spouse), boundary (defiance, and the first look at the villa wall).
- `prologue.stand`: paid (cunning, quiet), stood (brutal, defiance up), looked_away (defiance, guilt). Echoed in the evening and in the stranger scene.
- Aelia's question (not a flag): sometimes / this is home / another night. Moves `bond.aelia`, `humanity`, `secrecy`.
- `prologue.answer`: yes / asked what it would cost / refused. Echoed in the first lines of the waking. Intended for the maker to remember in the Cassian scenes: he says "most say yes, the ones who say no are the ones I most want" on a refusal, and "everything, eventually, but not today" on asking.

Death by role (`hero.death`): gladiator arena wound; legionary and house slave execution (a false charge); merchant and physician's aide fever. Callbacks possible later: the arena scar is already a suggested mark for gladiators.

The stranger is Cassian but is never named, and his face is hard to remember. Chapter 1 can have the hero recognize him later.

End state for chapter 1: the hero wakes on the mosaic floor of the shuttered villa above Collesanto, hears the village heartbeats, and feels hunger for the first time. `wealth` is 20 and `collesanto` 15, matching the quick start. Hunger is left at its default for chapter 1 to set.

## To do in later Book One sessions

- Chapter 1 starts at "Waking: hunger and the abandoned villa" and picks up directly from the prologue's last paragraph (`=> next` from `b1p` leads to the first chapter in the manifest after it).
- The family: the spouse dies in the Collesanto fire, the children are pulled out alive. Set `quick` statuses for `spouse` (dead), `aelia` and `felix` in `content/family.json` when the fire is written, and the Book One recap for quick starts into Book Two.
- Use `prologue.stand` and `prologue.day` for callbacks (the boy and the goat can return in the village; the day spent decides whom the hero misses most in the Velati journal).
- Remove `"incomplete": true` from Book One in the manifest in the last Book One session.
