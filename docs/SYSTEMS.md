# Game systems

The systems from the design doc's Game mechanics section, built in session 3. Code is in `engine/systems/`, one file per system. Data and tuning are in `content/`. Each system keeps its state in `state.sys` (shape in `engine/systems/sys-state.js`).

Scripts use the systems through expression functions (in `{}`, `?if` and choice conditions) and `$ do` commands. Every id argument is checked: `npm run check` rejects a misspelled literal id or a wrong value (`$ do feed("cat")`), and play time rejects anything the checker could not see. Stats stay in the story's voice: describe results with `voice()` and `band()`, never print numbers.

| File | Holds |
| --- | --- |
| `content/rules.json` | All tuning: era cost scale, phase actions, sun hunger by book, feeding, power costs, raids, rest, combat tiers, Collis names, coven caps, sleep odds. Every key has a default in code. |
| `content/ventures.json` | Collis ventures by book, legitimate and dark, priced in each era's money. |
| `content/village.json` | Collesanto buildings. |
| `content/holdings.json` | Haven upgrades, networks, and the coven or lone path purchases. |
| `content/originals.json` | The six originals, their kind (sleeping or wandering), book, and quick start default. |
| `content/collection.json` | Pieces for the New York museum. Book sessions add pieces as they are written. |
| `content/sleep.json` | The long sleeps: years, growth, history events, and gap specific investments. |

Money: `wealth` is coin. Ventures are priced per era in their file. Holdings, buildings, `send_home`, `earn` and sleep protections are priced in Rome's coin and multiplied by `rules.scale` for the current book, so the same building costs more in Paris than in Rome.

## The chapter loop

A chapter's shape (design doc, Chapter structure) maps to:

```
# start
The chapter's problem.
$ do phase("day")
:day
* Meet the grain factor ?if actions_left() > 0
  $ do act()
  ...
* Send Lucia to watch the Lictors ?if actions_left() > 0 and in_circle("lucia") and not on_mission("lucia")
  $ do send("lucia", "scout", 2)
  $ do act()
* Go out at midday ?if actions_left() > 0
  $ do act(1, true)
  ...
* Let the day end
  $ do end_phase()
?if in_phase() != ""
  -> :day
?end
-> night
...
# climax
...
$ do rest()
?if rested("missions") > 0
  Your people come back with news.
?end
=> next
```

## Day and night (`life.js`)

| Use | Meaning |
| --- | --- |
| `$ do phase("day")`, `$ do phase("night", 2)` | Begin a phase; actions from rules unless given. |
| `$ do act()`, `$ do act(2)`, `$ do act(1, true)` | Spend actions. `true` acts at midday: extra hunger, strong in Rome and gone by New York. |
| `$ do end_phase()` | Close the phase (a random event interrupting it). |
| `in_phase()`, `actions_left()` | `"day"`, `"night"` or `""`; actions remaining. |
| `$ do feed("animal")` | `human`, `human_kill`, `animal`, `donor`, `bank`. Changes hunger and humanity. `human_kill` also counts a kill. |
| `fed("human")`, `animal_diet()` | Times fed that way, ever (achievements); whether recent feeding is mostly animal (he is weaker in fights). |
| `must_feed()` | Hunger is very high, or he has gone too many actions unfed: time for a hunger scene that can take control. |
| `$ do power("major")` | `minor`, `major`, `great`. Raises hunger; older heroes pay slightly more. |
| `$ do kill("human")`, `$ do witness(2)` | Tallied until rest, then cost Secrecy and Humanity. |
| `$ do raid()`, `raids()`, `senate_alarm()` | Day raids on sleeping vampires. Past the limit each raid costs Secrecy and Standing. |

## Rest

`$ do rest()` ends a chapter's play: ventures pay (dark ones cost Humanity and Velati regard), missions count down and come home, hunger rises, witnesses and kills cost Secrecy and Humanity, and a quiet chapter lets rumors fade a little. `rested("income")`, `rested("kills")`, `rested("witnesses")` and `rested("missions")` read what the last rest did.

## Combat (`combat.js`)

```
$ do fight("lictor")
:exchange
* Feint toward the stair
  $ do strike("cunning")
* Break his guard
  $ do strike("brutal")
* Let the blood loose ?if not must_feed()
  $ do strike("power")
* Talk him down
  $ do strike("talk")
* Run
  $ do strike("flee")
?if not fight_over()
  ?if last_strike() == "hit"
    He gives ground.
  ?else
    His blade finds you.
  ?end
  -> :exchange
?end
?if fight_result() == "won"
  ...
?end
```

Tiers: `human`, `fledgling`, `elder`, `lictor`, `ancient`, `original`. Three exchanges by default (`$ do fight("human", 2)` for two); winning most of them wins. `talk` and `flee` end the fight at once when they work (`"talked"`, `"fled"`). Score is age, the approach's bonus (cunning or brutal from the slider, power for a hunger cost, talk from standing and humanity), a seeded roll, minus starving, wounds and an animal diet. Originals cannot be beaten in a fight. Lost exchanges add `injury` (a stat with story voice) and hunger. Losing is never game over; the chapter writes the cost. `$ do heal()` clears wounds.

## Collis (`collis.js`)

| Use | Meaning |
| --- | --- |
| `$ do invest("rome.wine")` | Buy a venture or raise its level (cost x level). Refused if from a later book, at its top level, or unaffordable: test `can_invest()` first. |
| `$ do divest("rome.wine")` | Sell for half its cost. |
| `owns()`, `venture_level()`, `income()`, `dark_ventures()` | |
| `collis()` | The company name in this era. |
| `$ do hide_collis(true)`, `collis_hidden()` | Hide the link back to Collesanto. Removes the paper trail risk from the next sleep. The story writes any reputation cost. |
| `$ do earn(40)` | A one off gain or loss, in Rome's coin scaled to the era. |
| `$ do choose_path("lone")`, `lone()`, `coven_path()` | The coven or lone path. |
| `$ do acquire("vaults")`, `holds()`, `can_acquire()` | Holdings. Some are for one path only. City holdings stay behind when he sleeps. |

Ventures keep paying until he sleeps. In the long sleep they are folded into the fortune and become legacy.

## Collesanto (`village.js`)

`$ do build("well")`, `built()`, `can_build()` (book, prerequisites and wealth), `$ do send_home(50)` (prosperity grows with the money), `village_defense()`, and `$ do village_harm(10, "walls")` for raids and fires. The `collesanto` stat is size and prosperity. The village grows in every long sleep, more with the keepers as stewards.

## The circle: coven, keepers and missions (`circle.js`)

Every member is a person in `content/people.json`; loyalty is `loyalty.<id>`.

| Use | Meaning |
| --- | --- |
| `$ do sire("lucia", "scout")` | Give the Dark Gift. Not before Book Two, at most 2 a book, coven of at most 10. Drains hunger, alarms the Velati. Add `true` for a rare daywalker. Test `can_sire()`. |
| `$ do recruit("orsino", "merchant", 2)` | A vampire of another line joins at an age tier. |
| `$ do keeper("tullia", "steward")` | A sworn human keeper (the lone path's people). |
| `$ do assign_role()`, `$ do member_fate("lucia", "left")` | Roles are free text. Fates: active, left, dead, captured, betrayed. |
| `in_circle()`, `member("lucia", "status")`, `member_power()`, `daywalker()`, `coven_size()`, `circle_size()`, `sired_this_book()` | `member()` fields: status, role, line, kind, sire, joined, quest. |
| `$ do send("lucia", "scout", 2)` | Missions: scout, protect, negotiate, hunt, retrieve; risk 1 to 3. One chapter, two for risk 3 or retrieve. |
| `on_mission()`, `mission("lucia")`, `$ do debrief()` | Outcome after rest: success, partial, injured, missing. Missing members are captured or dead (`member(id, "status")`). |
| `$ do quest("lucia", "lost_brother")`, `$ do quest_answer("lucia", "join")`, `$ do quest_done("lucia")`, `quest_state()` | Their own missions. Approve, refuse or join changes loyalty. |
| `acts_alone("lucia")` | Loyalty is low (or his own fledgling, middling loyalty, and his defiance runs high): they act behind his back. |

Member power is their age tier when they joined plus one per book since, plus one if he sired them (the old blood), plus training.

## Bonds (`bonds.js`)

`$ do meet()`, `met()`, `$ do fate("prisca", "dead")`, `fate_of()` for the People screen. Romances: `$ do romance("lucia")`, `$ do romance("lucia", "together")`, `$ do romance_end("lucia", "turned")` (turned, left_behind, lost, parted), `romance_status()`, `romance_ending()`, `partner()`, `romances_ended("turned")`. Bond strength is `bond.<id>`.

## The originals (`originals.js`)

| Use | Meaning |
| --- | --- |
| `$ do awaken("general", "hero")` | Sleeping originals: woken by bloodline, hero or faction. |
| `$ do original_fate("general", "bargain")` | For one he woke: loosed, bargain, drunk, sealed. |
| `$ do reveal("merchant")`, `$ do original_fate("merchant", "allied")` | Wanderers: revealed, then kept_secret, exposed, allied. |
| `$ do learn_name("merchant")` | He learns their true name. |
| `original("general")`, `original("general", "by")`, `original("general", "fate")`, `original("general", "name")` | State: asleep, awake, sealed, hidden, revealed. |
| `awake_count()`, `allied_count()` | Awake or revealed (moves the god's clock in Book Seven); bound to him. |

## The collection (`collection.js`)

`$ do obtain("gladius")`, `$ do lose()`, `$ do display()`, `has_item()`, `displayed()`, `item_count()`, `displayed_count()`.

## Sleep and stewards (`sleep.js`)

In the book's last chapter, let the player choose, then resolve:

```
$ do rest_place("collesanto")        collesanto, haven, tomb
$ do steward("keepers")              a circle member, keepers, or bank
$ do orders("safe")                  safe, aggressive, dark
$ do protection("traps")             traps, bribes, guardians (any of them; bribes and guardians cost coin)
$ do sleep_invest("new_amsterdam")   only the gap's own options (content/sleep.json)
$ do sleep()
```

`$ do steward_corrupted()` marks a steward secretly turned or bribed. Outcomes: `prospered`, `on_schedule`, `losses`, `woken_early` (by `hunters`, `government` or `steward`). Safety is the steward's skill and loyalty, protections, the hiding place (Collesanto's walls, a tomb, the haven's holdings) and a seeded roll; danger is the orders, the history of the gap, an unhidden Collis paper trail, low Secrecy, risky investments and a corrupted steward. On waking: age rises one tier, hunger is high (very high if woken early), wounds are healed, adjustment is low, ventures become legacy, city holdings are gone, the village has grown. Woken early he is broke.

The next book's opening reads `wake("outcome")`, `wake("by")`, `wake("steward")`, `wake("orders")`, `wake("place")`, `wake("gap")`, `wake("richer")`, `wake("years")` and `wake_event("black_death")`.

A gap marked `"split": true` in `content/sleep.json` can be broken into several sleeps by interlude chapters (`$ do sleep("gap_id")`); quick start skips split gaps.

## The Velati journal

Each book can name a journal script in the manifest: `"journal": "journal/burning-city.tsb"`. It is written in the chapter format, without choices, and runs at the end of the book on a copy of the state, so its `?if` blocks can read every flag, stat and system. A first `## heading` becomes the entry's title; `> quotes` stay quotes. The entry (`kind: "velati"`) goes into `state.journal` and opens the next book's Previously screen on parchment. Ending the same book again replaces its entry. Quick start still uses each skipped book's `recap`.

## Quick start

Skipped books get the originals' `quick` defaults from `content/originals.json`, an uneventful sleep for every gap, and the book's `quickstart.vars` (age, wealth, collesanto) from the manifest.

## Screens

`game.systems()` returns a plain summary for the menus (Collis, ventures, holdings, village, circle, people met, originals the hero has learned of, the collection, the last wake report). Session 4's People screen and codex read it.
