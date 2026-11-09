# Lost Centuries interludes

## Interlude A (chapters lc01 to lc03, ids `lc01`, `lc02`, `lc03`)

Chapter 20 now sleeps only the first stretch (`rome_to_sack`). The interludes wake the hero in the sack of 410, then in the Emperor's new city in 537, and each ends by lying down again.

lc01, "The Salarian Gate" (410 AD). Woken by the night the Goths take Rome. The hero feeds, learns the news, meets the circle, then spends the night across four places: the house (flag `lc.collis`), the gate (`lc.gate`), the court (`lc.court`) and the hill (`lc.hill`). Dawn closes it.

lc02, "The Third Day". The road out and the new seat: `lc.road`, `lc.watchers`, `lc.seat`. Rest place, steward, orders and protection are chosen again. Ends with `sleep("sack_to_byzantium")` (fall of the west). Chapter journal in the voice of Rufinus of the Aventine watch.

lc03, "The Second Rome" (537 AD). Woken in Constantinople. Flags: `lc.answer`, `lc.sunwalk`, `lc.hill_537`, `lc.court_537`, `lc.mason`. The cistern court, the dedication of the Great Church (collection item `great_church_tessera`). Ends with `sleep("byzantium_to_florence")`, which ends Book One. Chapter journal in the voice of a litter bearer at the western door.

## Lore seeds
The Collesanto "Sleeper" cult seed: villagers near the cellar may begin to treat the sleeper as a saint. Flagged to the owner, spoiler light.

## Open items for Interlude B
Split `byzantium_to_florence` into 532 to 1348 and 1348 to Florence segments (plague of Justinian and black death are the events carried now). Book Two's opening should read the chained `wake()`.
Aelia and Felix still have `"quick": true` in `content/family.json`. Decide whether they should be `"dead"` for quick starts.
