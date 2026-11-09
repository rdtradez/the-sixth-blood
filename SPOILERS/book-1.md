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

## Chapter 3: "The Merchant's House" (session 8, `content/burning-city/ch03.tsb`, chapter id `b1c03`)

Rome by night: taken in by Prisca's Merchant line coven. Three night actions, then the house, then dawn. Reads hunger, injury and wealth as chapter 2 left them.

- Arrival: night, the city of wheels (wagons are only allowed in the streets after dark), a hundred thousand heartbeats. Origin and role lines for first impressions.
- Night hub (3 actions): feed (`b1.rome_feed` = market / drunk / hunted: the cattle pens by the river, a sleeper in a doorway, a man leaving a gambling den); find a roof before dawn (cost depends on wealth; a poor hero sleeps under a bridge and is found); follow the feeling of being watched (Tiro on the rooftops).
- Tiro finds him in every path: young, funny, a house slave's son turned at nineteen, a bookkeeper who was never any good at it. If the hero is starving he stops a killing and steers him to a safer meal (fail forward). Tiro says Prisca felt a new one in the city "like a bell rung in the wrong key". `bond.tiro` rises with warmth.
- The house: a wine and oil warehouse in the Emporium by the Tiber; the counting rooms above, the sleeping vaults below. Hanno (very old, Carthaginian, keeps the ledgers and says almost nothing). Codex: the Merchant house, the Veil.
- Prisca interviews him in the counting room (patient, dry, buys everything; does not give her age). She asks who made him. `b1.maker_told` = told (he cannot describe the face, only the question) / withheld / lied. She goes still on "told", and says to tell no one else.
- Her terms: keep the Veil; no kill inside the walls without her leave; present himself to the Senate's census when the Lictors come. `b1.prisca_terms` = accepted / bargained (cunning, standing) / defied (brutal, defiance; she keeps him anyway: "an unregistered one is a dead one").
- Dawn: the coven sleeps. `b1.sun_known` = none (he lies down with them and lies awake) / tiro (Tiro sees him awake at the grate with the light on his hands) / prisca (he tells her or lets her see). Tiro keeps the secret if he likes the hero.
- Ends with `rest()`. Chapter 4 follows after some nights.

## Chapter 4: "The Senate's Eye" (session 8, `content/burning-city/ch04.tsb`, chapter id `b1c04`)

The Lictor, Galerius, and the question: who made you.

- Opens some nights later. Night hub (3 actions): learn the rooftops and the rules with Tiro (the Veil in practice, Tiro's comic dread of the Senate, bond); Hanno's ledgers (the Merchant house moves money through men who work by day and have no faces, and Hanno lets slip that they lack a mortal with the nerve to deal: the seed for Collis in chapter 5); the cup (the coven keeps willing donors, `b1.cup` = accepted / refused / hunts alone; humanity and secrecy); the Senate's quarter (the Forum at night, the Lictors' red cords; codex the Senate of Blood and the Lictors).
- The summons: Galerius arrives with two Lictors, fasces tied with red cord. Courteous, scholarly, patient menace; assigned to watch him. Prisca receives him in the atrium and sponsors the hero.
- The question: name, when he died, who made him, who gave leave. `b1.maker_answer` = truth (a stranger whose face will not stay in the mind; Galerius goes completely still and writes nothing) / vague / lie (names a dead vampire; Prisca covers it at a cost) / refuse. Refusing in a brutal way opens a short `fight("lictor")` that cannot be won cleanly: a win earns Galerius's cold respect and a long enmity, a loss is Prisca paying for him (standing down).
- `b1.galerius` = watching (courteous default) / wary / hostile. "I am to watch you. It is not personal. Everything is personal."
- If `b1.sun_known` is prisca or tiro, whoever knows keeps it from the Lictors; Prisca names the price. A daywalker is proof the Senate's history is a lie (the Lictors must never learn it).
- Dawn debrief with Prisca. Ends with `rest()` and `=> next` (chapter 5: Collis begins, a daytime deal).

## Threads left open (session 8)

- `b1.maker_told` and `b1.maker_answer` are what Prisca and Galerius each believe about Cassian. They can disagree and the story can use it. The fear reaction to the maker is saved for the end of the book.
- `b1.sun_known`: Prisca knowing makes her the one who will want him in daylight (Collis, chapter 5). Tiro knowing makes Tiro the friend who dies in the Great Fire holding a secret.
- `b1.prisca_terms` pays off at the coven's offer (stay or go alone).
- Galerius's file on him begins here and runs to Paris.

## Chapter 5: "A Name in the Sun" (session 9, `content/burning-city/ch05.tsb`, chapter id `b1c05`)

Collis begins. Opens at dusk the night after chapter 4 ends (Prisca promised to talk about "what a man can do in the sun"). Reads `b1.sun_known`, `b1.prisca_terms`, `b1.galerius`, `b1.cup`, role and path.

- The offer, on the warehouse roof. The house is rich but cannot deal by day; Hanno's ledger of mortal factors who steal is the problem. Prisca wants a firm with a mortal face that can never be traced to the roof. If `b1.sun_known` is prisca she asks outright and says what the sun is "worth" (she has thought of little else); if tiro, she says she noticed he is not asleep at dawn and that Tiro did not tell her (Tiro is at the foot of the stair, agonizing); if none, she says she has noticed he does not sleep quite as the rest do and does not ask why. She never learns more than she is told.
- `b1.collis_terms` = partner (stake 110, she takes a share, bond and standing up) / loan (stake 60, cleanest, a very small hand in the ledger) / alone (no stake, only offered if he can afford the cheapest ventures; standing down, defiance up, "I shall tell you the price of a mistake afterward"). Hanno gives him a bronze token stamped with a six petaled flower that opens doors in Ostia and the Subura (not yet the third, in the Argiletum).
- Dawn: he slips out through the cellar grate (a bar oiled on the inside if Prisca knows, a clean tunic and a note from Tiro if Tiro knows). Role and path lines for the first daylight walk. Day phase of 3 actions, midday costs hunger.
- Day hub, four leads, three actions: Naevia's wine shop in the Subura (oil from Collesanto, `rome.wine`, honest price sends money home via `send_home(8)`; a freedwoman, bond with him; the Etruscan oil grower is dead); the Ostia road at noon (a shipowner, Vettius, whose partner died with half the money; `rome.shipping`; the sun is a weight the whole way; a starving hero steps back from the shipowner's throat); the grain factor Lucrio from Hanno's book (he skims a tenth of a cart a day through the Horrea Galbae; token on the table); the burned lots below the Esquiline (`rome.insulae`; an auctioneer; a bald man's quiet partner offers a gladiator school share and "the other kind of property", `rome.gladiators` and `rome.slaves`, with origin lines for gladiator, house slave and freed heroes).
- `b1.collis_start` = none / wine / shipping / lending / insulae / gladiators / slaves: the first deal that closes sets it. If the day passes with no deal Hanno hands him a jar of Etruscan oil and wine is bought for him (a gift that costs a little).
- `b1.factor` = exposed (Prisca's house; Lucrio "retires to a farm in Campania") / bound (works for Collis openly and stops stealing; offers the debts, which opens `rome.lending`) / spared (a second chance; the house loses a tenth of a cart a day) / unmet. Lucrio is the first man who will ever work for Collis.
- Dusk: a hunger scene if he must feed (cup, cattle or a drunk by `b1.cup`). Prisca asks the name: "Collis", a hill. `b1.collis_name` = tribute (the link to Collesanto stays) / hidden (`hide_collis(true)`, standing -2, secrecy up: "a firm with no story is a firm with a secret"). Codex: Collis.
- End: `rest()` pays the first coin. A hand delivered, unsealed note from Galerius reads by `b1.galerius` (hostile: he has noted a new mortal agent of remarkable vigor; wary: he will call "at an hour convenient to him"; watching: an interested congratulation). Prisca points out that the man of business has never been seen at the house.

## Chapter 6: "The Price of the Cup" (session 9, `content/burning-city/ch06.tsb`, chapter id `b1c06`)

The breaking point: the moment he may swear off human blood. Six weeks after chapter 5. Reads how he has fed (`fed("human_kill")`, `fed("human")`) and the chapter 1 to 5 flags.

- Day hub (2 actions): the books (Lucrio or the replacement factor; a letter from Aelia that comes down with the first oil jars, wording by `b1.farewell`; the first deal's progress), the firm's ground (insulae: the well he insisted on; shipping: the scarred eyebrow crewman; the dark ventures: he stops at the gate and does not go in, `humanity` -1; otherwise Naevia's shop, a child sweeping), the street (a young man with a ruptured gut on the corner; a physician's aide knows what to do and saves him; anyone else gets a stool and a runner; or watch from the window).
- Dusk: three breaking points by history. Kin (any human kill): Vibia, a widow with two children, comes to the counting house to ask whether Collis finds missing men; the husband is the gambler from the Via Sacra (`b1.rome_feed` hunted), Fuscus the collector's man (`b1.collector` killed) or a river porter, and she wants only to know where to put a coin. `b1.vibia` = told (truth, secrecy -4, humanity +3; she calls him a very kind liar and says she will not forget his face) / helped (a stranger's body dredged up and buried as her husband at the firm's cost) / paid. Drained (human feeding, no kill): the man he left alive is wasting, flinching from the dark; he is Vibia's husband Marcus; `b1.vibia` = helped (hired as a day watchman) / met. Clean (animals and the cup only): a street ambush in the alley behind the Basilica while he is weak; Tiro in danger, a wounded thief at his feet; he can drink (heals him, humanity down, Tiro: "Oh. I see.") or bind the arm and send for the watch (humanity up) or walk away.
- The vow, on the warehouse roof with Tiro (who says most of the made never decide, that the old ones go over to cattle, and that he once tried it and was sick on a priest). The prologue answer echoes: yes, asked, refused. `b1.vow` = animal (swear off the living; humanity +4, cunning down, Tiro bond) / donor (only the willing and never to the end; the cup) / human (swear nothing, take what he needs and own it; humanity -2, heals). Codex: the lesser cup.
- The lean nights (night phase of 2 actions): the cattle pens at the Forum Boarium or the cup room or a hunt in the city; hunting with Tiro (a hen in a tavern yard, the worst thing either has eaten); a word with Prisca (animal: slower, hungrier, worse fighter, "a house of farmers"; donor: "sustainable"; human: "strength is a debt paid in noise").
- The test, on the fourth night (animal and donor vows): a drover bleeds in an empty street and the hero is starving. Bind the arm and take him to a physician (no relapse, humanity up) / drink (`b1.relapse` true, humanity -3) / cross the street. A hero who swore nothing meets Hanno instead, with a note that he has counted a river man, a drover and a cabbage seller with a bite on her neck: "the Lictors can count too".
- Ends with `rest()`; the diet leaves him slower in fights (`animal_diet()`), and the closing line before `=> next` is Prisca asking what he means to be (the coven's offer, chapter 7, with her answer wanted at the dark of the moon).

## Threads left open (session 9)

- `b1.vibia` and Vibia's family are a human thread the Velati journal can use (a woman who sees his face and says she will not forget it). If `b1.vibia` is told, she knows what he is, or something near it, and can return.
- `b1.vow` and `b1.relapse` decide the diet the rest of Book One plays with. A hero on `animal` is weaker in the chapter 9 and 10 fights; a relapse can be voiced by Tiro later. Later chapters should read `animal_diet()` rather than the flag for fights.
- `b1.collis_start` is the venture the firm began with; the dark ones (gladiators, slaves) cost Velati regard and can be raised in the Velati journal and in Book Two's Banca del Colle.
- `b1.collis_name` and `hide_collis` carry the paper trail question into the first sleep.
- `b1.factor`: Lucrio is Collis's first employee only if bound; exposed or spared he can return as a loose end.
- Galerius's note arrives unsealed and he is told the man of business is never seen at the house: he will try to see him by day, and cannot. This is the seed for the Lictors testing the daywalker secret in the later chapters.
- Tiro: the vow scene gives him his best moments so far. Do not kill him early. His death is the Great Fire.
- Chapter 7 (the coven's offer) reads `b1.prisca_terms`, `b1.collis_terms` and `b1.vow`: the house has been very patient and wants to know whether he stays or goes alone.

## Chapter 7: "The Dark of the Moon" (session 10, `content/burning-city/ch07.tsb`, chapter id `b1c07`)

The coven's offer: stay or go alone. Two night actions, the vault on the dark of the moon, dawn.

- Night hub (2 actions of 4): Tiro on the roof (honest about the house, bond; if `b1.sun_known` is tiro he mentions the secret); Hanno's ledger of names (what the house is: fourteen, a census, a Lictor who is fed; the terms by `b1.collis_terms`; "a man alone in Rome is not free, merely unwatched by friends"); a walk alone, followed by a thin clerk of Galerius's (lose him / let him follow / turn on him, who says Galerius pays on the first and asks whether the master of Collis comes out by day); Prisca plainly (why she wants him, by `b1.sun_known`; she will not hold him and will not be his enemy).
- The vault: lamps out, one flame in a dish of oil. Galerius attends as the Senate's witness. `b1.coven` = stayed / alone, `b1.oath` = full / reserved / none. Staying sets the coven path and recruits Prisca (tier 3), Hanno (tier 3) and Tiro (tier 1) into the circle; a reserved oath ("the only honest kind") is defiance up. Going alone sets the lone path, Prisca gives a cedar cloak "not a leash", a hidden sleeping place if he can pay for it (else Hanno offers the counting house cellar), and Galerius enters him in the census as unattached and says he will look in.
- Dawn: Tiro comes with a bundle (alone) or claps his shoulder three times (stayed). Hanno brings the seed of chapter 8: three burned buildings near the Circus, the Aventine foot and the Velabrum, all owed money to the house, and a watchman who saw a grey cloak with a lamp whose flame did not flicker. Prisca asks him to find out by day, quietly (asks, if he is alone).

## Chapter 8: "The Steady Flame" (session 10, `content/burning-city/ch08.tsb`, chapter id `b1c08`)

The Igniferi uncovered, nine days before the full moon of Julius. Three day actions, then the cellar, then the warning.

- Day hub (3 actions of 4, midday costs hunger for the Velabrum): the burned warehouse (Rufus the vigil, three roofs at once, grey cloaks that did not run and prayed; `b1.rufus` = trusted / none (a surveyor lie) / wary (pressed)); the Collis ledgers (pitch, tow, resin and sealed jars bought for cash; the lead differs by `b1.collis_start`; the name Flavus); the Subura (Naevia and the girl who sweeps; Vibia returns with the cellar's location if `b1.vibia` is told or helped); the lamp seller in the Velabrum (Flavus is gentle, lame, kind, says the village on the hill was "thoroughly" dealt with and that Julius will be "a very bright summer"; the jar's flame is heat on the hero's skin, the first time he feels fire as a danger; `b1.flavus` = spoke / struck (witness, secrecy down, Flavus promises to remember his face)).
- Dusk: if no lead was followed Tiro found the place himself. Tiro comes down either way.
- The cellar under the Aventine: an old cistern, 200 jars with wicks, 40 grey cloaks at a small altar, a charcoal map with red marks. Watching from the grate gives the whole plan (`b1.plan` full). Slipping down is a coin toss to a fight. Questioning a man at the stair is a fight. Fights are `fight("human", 2)`; a loss means the jar's heat burns him and Tiro hauls him out; `b1.plan` partial unless he wins.
- The plan Flavus speaks (if heard): the night of the full moon of Julius, wind from the river, the Circus first, then the Aventine foot, then the Emporium, second watch, every man with a lamp. "The fire does not forget. It has not forgotten the hill."
- Dawn: Rufus (if trusted) tells him which Aventine cisterns are good ("in case the Circus goes up"). Who to tell, `b1.igni_warned` = house (Prisca sets a house watch, says the Senate will hear it from somebody, "I should like to know what it does when it hears") / lictors (Galerius is not surprised: "I have a file on a certain lamp" and the Senate considers a great deal; "a fire in the old quarters is not a misfortune to every one of us") / both / none.

## Threads left open (session 10)

- Galerius and the Senate are quietly unbothered by the fire plan. That is the seed for the blame landing on the Christians: chapter 9 can show the Senate letting the fire come and steering what is said after. A hero who told the Lictors was heard and not acted on; one who did not is simply alone.
- `b1.flavus` struck: Flavus remembers his face. A hero who struck him can be named by the Igniferi in chapters 9 and 10 (Collis, Collesanto). Flavus is the Igniferi's leader and dies in the reckoning.
- `b1.rufus` is the vigil who founds the Velati. Trusted: he is in the fire scenes ready, and later the first journal. Wary: he suspects the hero of being one of the strange men. None: he does not remember.
- `b1.coven` and `b1.oath` decide how much of the house is at his back for the fire. Tiro is in the circle if he stayed; either way Tiro is at his side in chapter 9 and dies in the Great Fire.
- The jar's flame hurts him across a room: remember it when he fights Igniferi lamps in chapter 9.
- `b1.plan` decides whether the hero knows the order of the burning (Circus, Aventine foot, Emporium) in chapter 9.
- Chapter 9 opens nine days later, on the eve of the full moon, with `b1.igni_warned` deciding who has been prepared.
