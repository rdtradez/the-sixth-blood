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

- The family quick statuses (spouse dead, Aelia and Felix living) are set in `content/family.json` (session 7). The Book One recap for quick starts into Book Two is still to write when the book ends.
- Use `prologue.stand` and `prologue.day` for callbacks (the boy and the goat can return in the village; the day spent decides whom the hero misses most in the Velati journal).
- Remove `"incomplete": true` from Book One in the manifest in the last Book One session.

## Chapter 1: "Dust and Heartbeats" (session 7, `content/burning-city/ch01.tsb`, chapter id `b1c01`)

Waking: hunger and the abandoned villa. Picks up from the prologue's last paragraph. Hunger starts at 78 (set in the chapter). Night phase, then a morning and a day phase, then dusk.

- Start: the hero sees in the dark, the death wound gone (by `hero.death`), no need to breathe. Cassian left a folded cloak, a purse of silver and an unsigned wax tablet: "Eat before the sun. Do not go down the hill hungry." The last line echoes `prologue.answer`. Choice `b1.tablet`: keep / scrape (scrape: defiance).
- Night hub (3 actions): search the villa (windowless cellar room with a bar on the inside, wine comes straight back up, no name anywhere, codex `the_villa`); test strength (lift a column drum = brutal, cross the terrace wall unheard = cunning); listen to the village (four nights since the death, the bier was empty at dawn after the vigil, light seen in the villa; spouse, Domitia, the children; hear it through = humanity and bond, shut it out = defiance); hunt the oak wood (boar, animal feed); go down to the road (the collector's man, Fuscus, asleep at the crossroads shrine).
- Road camp, `b1.collector`: spared / drained (human feed, he may wake: 35%, then he flees, `fled`, a witness) / killed (human_kill, optionally takes his strongbox, earn). If `prologue.stand` is looked_away the boy's goat is tethered at the cart: free it (it later returns to the boy).
- If the hero has not fed by the end of the night, hunger takes him: old Sextus the shepherd climbs the hill at dawn, the hero drinks from him and he survives (`b1.first_blood` = forced, a witness, Sextus is met and will tell the village he saw a ghost). `b1.first_blood` otherwise records the first feeding: animal / drained / killed.
- Dawn: the sun scene. The hero expects to burn. Three ways to meet it (hide, hand in the light, walk out) and a hiding hero is driven out by Aelia's voice at the wall at noon. The sun stings like fever and weakens him but does not burn: the daywalker surprise. Codex `the_sun`.
- Day hub (2 actions, midday costs hunger): walk the old boundary of the land (role relic; Quintus and the goat); watch from the ridge (eleven men in grey cloaks with a tended lamp and sealed jars camp in the oak wood north of the village: the Igniferi, never named). Choice `b1.warning`: followed (cunning, learns they come by night from the north and fire the thatch first) / warned (anonymous word to the boy at the well, a witness) / none.
- Ends at dusk after `rest()`; the hero walks down to the village.

## Chapter 2: "What the Village Keeps" (session 7, `content/burning-city/ch02.tsb`, chapter id `b1c02`)

Collesanto: the fire, his family, his first bond with the village.

- Evening hub (2 actions): watch your house from the dark (Aelia may see you, `b1.reveal` = aelia); knock at your own door (`b1.reveal` = spouse, the spouse takes it as a ghost and then not; the truth told or kept); the square (Sextus if `b1.first_blood` is forced, otherwise Quintus; first bond with the village).
- The fire: the Igniferi fire the thatch from the north and send a line of torches up the hill toward the villa. Night phase of 3 actions (4 if `b1.warning` is followed; with warned the village has a watch and fewer roofs burn): run for your house first, carry the old and sick out of the burning row, break the torchmen's line (`fight("human")`), organize the bucket line at the well. Each is seen by villagers and counts toward `b1.fire_seen` (seen, glimpsed, unseen), the seed of the guardian legend.
- The house: the spouse dies in every path (design doc). The children get out alive in every path (carried by the hero if he came first, otherwise by Domitia and the neighbors). `b1.spouse_fire` = went_in (injury) or held_back (fire kills vampires). Going in lets the hero hold the body, and by the light of the burning thatch he sees two small dark marks at the throat that he puts down to the fire (`b1.saw_marks`). THIS IS THE CLUE for Cassian's New Orleans confession. Never explain it before then.
- Aftermath: one torchman is taken alive by the village. `b1.prisoner`: village (questioned, left to the village's justice), killed, or fed (human_kill, heals). Dawn: the second funeral. The children are raised by Domitia's family (spouse's mother). `b1.farewell`: promise (to Aelia), truth, silent. The purse: send it all home, half, or keep it. `rest()` and on to chapter 3 (Rome by night; Prisca's coven finds him).
- Quick start statuses set in `content/family.json`: spouse dead, Aelia and Felix living.

## Threads left open for later chapters (session 7)

- `b1.saw_marks`: the hero may have seen two small marks at the spouse's throat. Cassian drained the spouse; the confession is in New Orleans (Book Four). Never explain it in Book One. A hero who did not go in never saw them.
- `b1.tablet`: kept or scraped. Cassian can remember either in a later scene.
- `b1.collector` (Fuscus), `b1.first_blood` (Sextus, if forced), `b1.goat` and Quintus can return in the village, in the guardian legend and in the Velati journal.
- `b1.reveal` and `b1.spouse_told`: who knew he was alive before the fire. Aelia's promise or truth (`b1.farewell`) can echo in Book Two's Valerio family.
- `b1.fire_seen` seeds the guardian saint legend. `b1.prisoner` is the first Igniferi man he has met: "others in the cities, and the fire does not forget" is all he learns.
- Hunger, injury and wealth leave chapter 2 as the player made them. Chapter 3 (Rome by night, Prisca's coven) has to deal with a hero who may be wounded, hungry, poor or flush.
