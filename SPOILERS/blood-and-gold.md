# Book Two: Blood and Gold (Florence, 1474 to 1478)

Plans for each Book Two chapter, written before the chapter is built. Source: the design doc's Book Two list (waking, Collesanto, the court, Prisca, Banca del Colle, the watcher, the first answer, the Merchant original, the conspiracy, Easter Mass 1478).

## Chapter 1, "A Great Deal of Interest" (`b2c01`, session 18)

The fifth waking, in 1474, fourteen centuries after Rome. Reads the chained `wake()` report: place (cellar under the shrine, a haven in Florence, the tomb in the rock), steward (the bank of the Merchant line, or the Valerio keepers) and outcome (prospered, on schedule, losses, woken early). Woken early has its own opening (hunters, the Catasto notary, or the steward himself, who was paid by "a man whose face he cannot describe", a Cassian hint) and a short trouble scene (`b2.trouble`: fled, fought, talked).

Order: waking, hunger scene (`b2.first_feed`), the steward's report (Benedetto of the bank, or Tommaso Valerio), the emperor comedy beat (`b2.emperor`: bluffed, asked, blustered). Then one night phase of three actions out of four: the books (`b2.books`: trusted or audited; the books show a yearly line for the feast of the hill's saint, which seeds chapter 2), the street (`b2.street`: watched, spoke, printed), Prisca's letter and the answer (`b2.prisca_reply`: warm, formal, silent), and who knows (the steward's chain of secrecy; small Secrecy effects). Dawn ends the chapter with `rest()`.

World seeds: Constantinople fell in 1453 (the Great Church is a mosque; callback to `lc.sunwalk`), the Medici, printing, the Court "of the Prince" named only in Prisca's letter. The Senate of Blood is no longer called that. Prisca writes that a Prince keeps the court and she keeps the purse, and asks him to see her before he sees him.

## Chapter 2, "The Saint of the Hill" (`b2c02`, session 18)

Collesanto as the hero finds it: walled, run by the Valerio family (Ginevra the matriarch, her son Tommaso the factor, Tommaso's daughter Fiammetta, 17, the new descendant of the line). The village believes in a guardian saint who never ages (shaped by `lc.sleeper_1348`: denied, allowed, embraced) and keeps a shrine over the cellar where the hero slept. The villagers know the absentee landlord as "Signor del Colle", the hero's alias, and that name is how he is introduced.

Day phase, two of three: the square (what the village says), the walls with Tommaso (build chapel, vineyard, walls; Book Two buildings), the shrine by day (the painted saint has a face like his; `b2.saint`: kept, curbed, shaped). Dusk: the table (`b2.valerii`: sworn, trusted, distant; Fiammetta asks to come to Florence, `b2.fiammetta`: promised, refused, allowed). Night phase, two of three: the vigil for the saint's feast, the cellar, a hunt in the wood. Climax: Fra Ambrogio, a Dominican sent by the Archbishop to decide whether the cult is lawful, interviews the Signor del Colle at the shrine at midnight (`b2.friar`: charmed, paid, cowed, hidden). The legend, the shrine and the family are all exposed to what the hero does.

Hooks for later chapters: Fiammetta's request (a Florentine thread), the friar's report to the Archbishop (the court reads the same reports), the saint's image (a face to be recognised), the shrine's candles (money to Collesanto).

Flagged to the owner (spoiler light): the guardian saint legend is now a recognised thing the Church has an opinion about.

## Chapter 3, "The Hall of the Prince" (`b2c03`, session 19)

Three nights between the invitation and the audience. The court of Florence is the third list item of the design doc ("his strength draws stares"). The Prince is Gualtiero, of the Priestess line (people id `gualtiero`), with Messer Ottaviano as his seneschal (`ottaviano`). Prisca keeps the purse (the licences of blood within the walls), so the court has two centres, and the chapter shows both.

Night phase, three of four: Prisca's door (she asked to be seen first; the short briefing, `b2.prisca_brief`: heeded, scoffed, skipped, and a promise that the real talk waits until after the Prince, which is chapter 4); the street test (a young Salimbeni vampire, Vieri, tries the stranger in an alley; `b2.test`: bested, shown, declined; `fight("fledgling")`); the Licence Office (Benedetto walks him through the purse's blood licences, `b2.licence`: bought, refused, poached); the Ponte Vecchio at night (rumors of the Medici against the Pazzi and a vampire faction that likes the quarrel; flag `b2.pazzi_heard`). Hunger scene if `must_feed()`.

The audience: the hall behind the Bargello, sixty vampires, the Prince on a plain chair. Old blood is felt (the stares, the elder who goes silent). Three choices: the oath (`b2.oath`: sworn, courteous, refused), who made him (`b2.sire_answer`: unknown, lied, deflected; the Prince knows a lineage that "was supposed to have ended" and says only that a line like his was struck from the roll, which seeds the first answer, chapter 7), and a seat (`b2.seat`: sword or none; the Captain of the Night is offered, which would set him against the Purse and so feeds chapter 4). Ends with `rest()` and `=> next`.

Hooks: the Prince's wish for the Captaincy; Vieri (a recurring young face at court); the licence ledger (Prisca's leverage); the Pazzi rumor (the conspiracy of chapter 9).

## Chapter 4, "The Purse" (`b2c04`, session 19)

Prisca: partner or rival, the fourth list item. The long talk postponed in chapter 3, the night after the court. She reads him by what he did at court (`b2.oath`, `b2.seat`) and what he did at Rome's end (`lc.collis`, `b1.coven`, `b2.prisca_reply`).

Night phase, three of four: the strong room (the books of the bank, the real figures; Prisca shows him what the hill's money became; he may take it all at face value or press her; `b2.prisca_books`: pressed or taken), the counting floor after dark with Benedetto (what daytime dealings could mean for a man who can stand in the sun; `b2.prisca_sun`: she asks him to be the house's daylight, he agrees, bargains, or keeps it back), Prisca's private rooms (the personal scene: Rome, the fire, what she did in the fourteen centuries; `b2.prisca_past`: she tells it, he asks her not to, he asks for the truth). Fourth option, not taken in one pass: walk to the river alone.

Dawn: the decision `b2.prisca_deal`: partner (one house, one seal, shared risk), rival (the Banca del Colle stands as a separate firm and she lets it), quiet (her credit, his own books). Flag `b2.prisca_asked` records whether he agreed to find out who inside the court is moving against the Medici (the thread of chapter 9). Ends with `rest()` and `=> next`.

Does not decide Prisca's fate or her bloodline (the design doc leaves "Firstborn of the Merchant" open); she is written so that either reading holds.

Flagged to the owner (spoiler light): nothing that changes the big picture.

## Chapter 5, "The Third Hour to the Ninth" (`b2c05`, session 20)

The Banca del Colle opens in the Via Porta Rossa and rises through daylight dealings, the fifth list item of the design doc. The opening reads Prisca's terms from chapter 4 (`b2.prisca_deal`: one door with two seals, a house across the street from hers, or two rooms on her credit) and the sun bargain (`b2.prisca_sun`).

Day phase, three of four: the chair on the counting floor (`b2.loan`: the Medici factor Ser Bartolo and the Pazzi factor Messer Raniero each ask for a favored rate on letters of credit; he carries the Medici, the Pazzi, both or neither; then the banking venture), the Oltrarno wool workshop of Ser Nofri (`b2.wool_wages`: fair, hard or none; `florence.wool`), the bottega of Maestro Berto in the Via dei Servi (`b2.portrait`: sat, refused or disguised; sitting as himself gives the collection piece `florence_portrait`; `florence.patronage`; Berto's senior apprentice, id `apprentice`, is introduced and does nothing yet, a seed for the painter's apprentice of the design doc), and Ugolino at the side door, a condottiere's agent who pays in a very old ducat that smells of a house with no fire (`b2.captain`: funded, listened or refused; `florence.mercenaries`, the dark venture). The captain's backers are a prelate's household in Rome, a Florentine banker and a third who does not come to the door: the third is a vampire faction, which seeds chapter 9.

Noon: the Arte del Cambio requires a new bank's first great contract to be sworn in the open on the marble in the Mercato Nuovo (`b2.daylight`: open, shaded awning, or Benedetto swears for the house). Vieri, a man of the Bargello with clean hands, and a new clerk who was never engaged are in the crowd. Ninth hour: Prisca's reaction (read from `b2.daylight`), the dinner invitation from Ottaviano if `b2.prisca_asked` is agreed (the way into the court's quarrel for chapter 9), and the clerk at the corner nodding at him. Ends with `rest()`.

New people: Ser Bartolo, Messer Raniero, Ser Nofri, Maestro Berto, the apprentice, and the watcher. Codex: the Banca del Colle.

## Chapter 6, "The Little Book" (`b2c06`, session 20)

The watcher: the Velati agent, who is both the clerk and the figure he saw across the river in chapter 4 (chapter 4 is now `@version 2` and uses the watcher's pronouns). The agent is `watcher` in `content/people.json`, gender opposite the hero like the spouse, named Allegra or Matteo Bonsi on the clerks' roll. The design doc leaves the default name open, so this is a placeholder to confirm.

Night phase, three of four: Benedetto and the letter from Pisa (the seal carries the Velati mark, a closed eye; Prisca has always known they watch her house; `b1.velati_seed`), the clerk's rooms over a stationer's (the little book in the Aventine shorthand; `b2.watcher_book`: read, copied or left; reads `lc.watchers`; a note at the foot of the last page in another, older hand says to look also for the one who is looking at him, a Cassian hint), the river stair (`b2.watcher_meet`: spoke, caught or waited), and the lanes behind the Badia (Vieri wants the clerk's book; `b2.vieri_watch`: shielded, claimed or ignored).

Dawn on the roof of the bank: the clerk states the rule of the Velati (watch, record, do not interfere) and says they have been breaking it for three weeks. `b2.watcher_terms`: open, bargained (he may see the pages that go to Rome) or refused (the watch sends someone older). The sun comes up on his face and does nothing, and the clerk says they have wanted to see that. `b2.watcher_bond`: begun (`romance("watcher")`, bread on the step of Orsanmichele) or guarded.

Later chapters: the agent is turned by Cassian in the Pazzi Conspiracy (chapter 10), not killed. The little book is a source for the Merchant original's test and the first answer. Prisca's reaction to the watcher is left for chapter 7 or 8.

Flagged to the owner (spoiler light): the agent's default name is a placeholder; their gender follows the hero's, as the spouse's does.
