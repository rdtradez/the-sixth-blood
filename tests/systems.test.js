// Session 3 game systems: phases, feeding, combat, Collis, Collesanto, the circle and
// missions, bonds, originals, the collection, sleep and steward, the Velati journal, the
// checker's argument checks, and the schema 3 save upgrade.

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeLoader } from '../engine/node-loader.js';
import { MemoryStorage } from '../engine/saves.js';
import { SAVE_FORMAT } from '../engine/versioning.js';
import { Game } from '../engine/game.js';
import { SCHEMA, SCHEMA_MIGRATIONS, createState } from '../engine/state.js';
import { parseChapter } from '../engine/script.js';
import { checkChapterContent } from '../engine/content-check.js';
import { checkCatalog, checkCall, createSys, SYSTEM_COMMAND_NAMES } from '../engine/systems/index.js';
import { resolveSleep } from '../engine/systems/sleep.js';
import { fnv1a } from '../engine/util.js';
import { texts } from './helpers.js';

const root = join(fileURLToPath(import.meta.url), '../..');
const real = createNodeLoader(root);
const BOOKS = ['burning-city', 'blood-and-gold', 'crown-of-ashes', 'house-divided', 'whitechapel-hunt', 'relics-lost-god', 'unchained'];

/**
 * A game on the real content files, with test chapters. Each book listed gets the given
 * chapters (all chapters go in the first book unless `byBook` maps them).
 */
async function sysGame(chapters, { book = 'burning-city', byBook = null, warn = [], storage = new MemoryStorage(), journal = null } = {}) {
  const realManifest = await real.manifest();
  const files = {};
  for (const [id, src] of Object.entries(chapters)) files[`t/${id}.tsb`] = src;
  if (journal) files['t/journal.tsb'] = journal;
  const loader = {
    ...real,
    manifest: async () => ({
      ...realManifest,
      books: realManifest.books.filter((b) => !b.dev).map((b) => {
        const ids = Object.keys(chapters).filter((id) => (byBook?.[id] ?? book) === b.id);
        return { ...b, incomplete: false, chapters: ids.map((id) => ({ id, file: `t/${id}.tsb`, title: id })), ...(journal && b.id === book ? { journal: 't/journal.tsb' } : {}) };
      }),
    }),
    chapterSource: async (file) => files[file] ?? real.chapterSource(file),
  };
  const game = new Game({ loader, storage, warn: (m) => warn.push(m), now: () => 1000 });
  await game.init();
  game.setSetting('dev', true); // start any book directly
  return game;
}

const H = (id, book = 'burning-city') => `@chapter ${id}\n@title ${id}\n@book ${book}\n`;

/** Run one chapter that ends in a page break, return the game. */
async function run(body, opts = {}) {
  const book = opts.book ?? 'burning-city';
  const game = await sysGame({ t1: `${H('t1', book)}\n# start\n${body}\n---\n=> endbook\n` }, opts);
  if (book === 'burning-city') await game.newGame({ book, seed: opts.seed ?? 7, vars: opts.vars ?? {} });
  else await game.startBook(book, { from: 'quick', seed: opts.seed ?? 7 });
  return game;
}

const S = (game) => game.state.sys;
const V = (game) => game.state.vars;

// ---- Phases and feeding ------------------------------------------------------------------------

test('day and night phases count actions, and midday costs hunger in Rome', async () => {
  const game = await run('$ do phase("day")\n$ do act()\n$ do act(1, true)\nLeft {actions_left()} in {in_phase()}.');
  assert.equal(texts(game.frame)[0], 'Left 1 in day.');
  assert.equal(V(game).hunger, 10 + 6);
  assert.equal(S(game).unfed, 2);
});

test('acting outside a phase is an error that names the fix', async () => {
  const game = await sysGame({ t1: `${H('t1')}\n# start\n$ do act()\n---\n=> endbook\n` });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /no day or night phase has begun/);
});

test('feeding changes hunger and humanity by kind, and long fasting forces a feeding', async () => {
  const game = await run([
    '$ hunger = 80', '$ do feed("human")', 'A {hunger} {humanity}.',
    '$ do phase("night", 6)', '$ do act(5)', 'B {must_feed()}.', '$ do feed("animal")', 'C {must_feed()} {fed("human")} {fed("animal")} {animal_diet()}.',
  ].join('\n'));
  assert.deepEqual(texts(game.frame), ['A 35 78.', 'B yes.', 'C no 1 1 no.']);
});

test('day raids alarm the Senate once overused', async () => {
  const game = await run('$ do raid()\n$ do raid()\nA {senate_alarm()} {secrecy}.\n$ do raid()\nB {senate_alarm()} {secrecy} {standing}.');
  assert.deepEqual(texts(game.frame), ['A no 70.', 'B yes 65 -3.']);
});

test('rest raises hunger and settles secrecy and humanity from the chapter', async () => {
  const game = await run('$ do witness(2)\n$ do kill("human")\n$ do rest()\nA {hunger} {secrecy} {humanity} {rested("kills")}.\n$ do rest()\nB {secrecy}.');
  // witnesses 2 x 3 + kill 2 = 8 secrecy, kill costs 3 humanity, hunger +8; a quiet rest restores 2 secrecy.
  assert.deepEqual(texts(game.frame), ['A 18 62 77 1.', 'B 64.']);
});

// ---- Combat ------------------------------------------------------------------------------------

const FIGHT = (tier, approach, n = 3) => `$ do fight("${tier}", ${n})\n:x\n$ do strike("${approach}")\n?if not fight_over()\n  -> :x\n?end\nResult {fight_result()} {fight_wins()} {fight_losses()}.`;

test('humans are easy, originals cannot be beaten in a fight', async () => {
  let game = await run(FIGHT('human', 'brutal'));
  assert.match(texts(game.frame)[0], /^Result won 2 0\.$/);
  game = await run(`${FIGHT('original', 'power')}\nHurt {injury}.`);
  assert.equal(texts(game.frame)[0], 'Result lost 0 2.');
  assert.equal(texts(game.frame)[1], 'Hurt 70.');
});

test('talking or fleeing ends a fight early when it works; results are the same on every replay', async () => {
  const a = await run(FIGHT('human', 'talk'), { seed: 11 });
  const b = await run(FIGHT('human', 'talk'), { seed: 11 });
  assert.deepEqual(texts(a.frame), texts(b.frame));
  assert.match(texts(a.frame)[0], /^Result (talked|won|lost) /);
  const flee = await run(FIGHT('human', 'flee'));
  assert.equal(texts(flee.frame)[0], 'Result fled 0 0.');
});

test('striking with no fight under way is an error', async () => {
  const game = await sysGame({ t1: `${H('t1')}\n# start\n$ do strike("brutal")\n---\n=> endbook\n` });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /no fight is under way/);
});

// ---- Collis and holdings -----------------------------------------------------------------------

test('ventures cost wealth, level up, pay at rest, and dark ones cost humanity and Velati regard', async () => {
  const game = await run([
    '$ wealth = 300',
    '$ do invest("rome.wine")', '$ do invest("rome.wine")', '$ do invest("rome.gladiators")',
    'A {wealth} {venture_level("rome.wine")} {income()} {dark_ventures()} {can_invest("florence.banking")}.',
    '$ do rest()', 'B {wealth} {humanity} {velati_regard} {rested("income")}.',
    '$ do divest("rome.gladiators")', 'C {wealth} {owns("rome.gladiators")}.',
  ].join('\n'));
  // 300 - 30 - 60 - 90 = 120; income 4 x 2 + 14 = 22.
  assert.deepEqual(texts(game.frame), ['A 120 2 22 1 no.', 'B 142 78 -1 22.', 'C 187 no.']);
  assert.ok(game.state.decisions.some((d) => d.name === 'venture.rome.gladiators'));
});

test('a venture from a later book, or past its top level, is refused', async () => {
  let game = await sysGame({ t1: `${H('t1')}\n# start\n$ wealth = 99999\n$ do invest("florence.banking")\n---\n=> endbook\n` });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /belongs to a later book/);
  game = await sysGame({ t1: `${H('t1')}\n# start\n$ wealth = 99999\n$ do invest("rome.wine")\n$ do invest("rome.wine")\n$ do invest("rome.wine")\nTop {can_invest("rome.wine")}.\n$ do invest("rome.wine")\n---\n=> endbook\n` });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /already at its top level/);
});

test('holdings follow the chosen path and are priced for the era', async () => {
  const game = await run([
    '$ wealth = 1000',
    'A {can_acquire("safehouses")} {can_acquire("coven_house")}.',
    '$ do choose_path("lone")', '$ do acquire("safehouses")', '$ do acquire("vaults")',
    'B {lone()} {holds("safehouses")} {wealth} {can_acquire("coven_house")}.',
  ].join('\n'));
  assert.deepEqual(texts(game.frame), ['A no no.', 'B yes yes 870 no.']);
  assert.ok(game.state.decisions.some((d) => d.name === 'path' && d.value === 'lone'));
});

test('the company name follows the era', async () => {
  const game = await run('{collis()}');
  assert.equal(texts(game.frame)[0], 'Collis Trading');
});

// ---- Collesanto ------------------------------------------------------------------------------

test('Collesanto buildings need wealth, their book and what comes before them', async () => {
  const game = await run([
    '$ wealth = 200',
    'A {can_build("farms")} {can_build("walls")} {can_build("rebuilt_houses")}.',
    '$ do build("rebuilt_houses")', '$ do build("farms")', '$ do build("well")',
    'B {collesanto} {village_defense()} {wealth} {built("farms")}.',
    '$ do send_home(60)', 'C {collesanto} {wealth}.',
  ].join('\n'));
  assert.deepEqual(texts(game.frame), ['A no no yes.', 'B 18 1 110 yes.', 'C 21 50.']);
});

// ---- The circle and missions ------------------------------------------------------------------

const PEOPLE = '$ do keeper("prisca", "steward")';

test('no siring in Book One; from Book Two at most two a book', async () => {
  let game = await sysGame({ t1: `${H('t1')}\n# start\nA {can_sire()}.\n$ do sire("prisca")\n---\n=> endbook\n` });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /not before Book Two/);

  game = await sysGame({ b2: `${H('b2', 'blood-and-gold')}\n# start\n$ do sire("aelia", "scout")\n$ do sire("felix")\nA {can_sire()} {sired_this_book()} {coven_size()} {member_power("aelia")} {loyalty.aelia}.\n---\n=> endbook\n` }, { book: 'blood-and-gold' });
  await game.startBook('blood-and-gold', { from: 'quick', seed: 2 });
  assert.equal(texts(game.frame)[0], 'A no 2 2 2 70.');
  assert.equal(game.state.vars.hunger, 10 + 30 + 30); // siring with the old blood drains him
});

test('a sworn keeper can be sired and becomes a fledgling instead of erroring', async () => {
  const game = await sysGame({ b2: `${H('b2', 'blood-and-gold')}\n# start\n$ do keeper("aelia", "keeper in the making", 60)\n$ do sire("aelia", "fledgling")\nA {in_circle("aelia")} "{member("aelia", "kind")}" "{member("aelia", "sire")}" {coven_size()}.\n---\n=> endbook\n` }, { book: 'blood-and-gold' });
  await game.startBook('blood-and-gold', { from: 'quick', seed: 2 });
  assert.equal(texts(game.frame)[0], 'A yes "vampire" "hero" 1.');
});

test('a mission resolves at rest, reports once, and can be debriefed', async () => {
  const game = await run([
    PEOPLE, '$ do send("prisca", "scout", 1)', 'A {on_mission("prisca")} "{mission("prisca")}".',
    '$ do rest()', 'B {on_mission("prisca")} {rested("missions")} {mission("prisca") != ""}.',
    '$ do debrief("prisca")', 'C "{mission("prisca")}".',
  ].join('\n'));
  assert.deepEqual(texts(game.frame), ['A yes "".', 'B no 1 yes.', 'C "".']);
});

test('dangerous missions take two chapters, and a lost member is captured or dead', async () => {
  let lost = null;
  for (let seed = 1; seed < 40 && !lost; seed++) {
    const game = await run([PEOPLE, '$ loyalty.prisca = 0', '$ do send("prisca", "hunt", 3)', '$ do rest()', 'A {on_mission("prisca")}.', '$ do rest()', 'B {mission("prisca")}.'].join('\n'), { seed });
    assert.equal(texts(game.frame)[0], 'A yes.');
    if (texts(game.frame)[1] === 'B missing.') lost = game;
  }
  assert.ok(lost, 'a risky mission by a weak keeper should sometimes go missing');
  assert.equal(S(lost).circle.prisca.status, 'dead');
});

test('quests change loyalty; low loyalty acts alone', async () => {
  const game = await run([
    PEOPLE, '$ do quest("prisca", "lost_sister")', '$ do quest_answer("prisca", "refuse")', 'A {loyalty.prisca} {member("prisca", "quest")} {quest_state("prisca")}.',
    '$ loyalty.prisca = 20', 'B {acts_alone("prisca")}.', '$ do member_fate("prisca", "left")', 'C {in_circle("prisca")} {member("prisca", "status")} {member("cassian", "status")}.',
  ].join('\n'));
  assert.deepEqual(texts(game.frame), ['A 50 lost_sister refuse.', 'B yes.', 'C no left none.']);
});

// ---- Bonds ------------------------------------------------------------------------------------

test('romances begin, deepen and end one of four ways', async () => {
  const game = await run([
    '$ do romance("prisca")', '$ do romance("cassian", "together")', 'A {partner()} {romance_status("prisca")} {met("prisca")}.',
    '$ do romance_end("cassian", "turned")', 'B {partner()} {romance_ending("cassian")} {fate_of("cassian")} {romances_ended("turned")}.',
  ].join('\n'));
  assert.deepEqual(texts(game.frame), ['A cassian courting yes.', 'B prisca turned turned 1.']);
  assert.ok(game.state.decisions.some((d) => d.name === 'romance.cassian' && d.value === 'turned'));
});

// ---- Originals and the collection -------------------------------------------------------------

test('the originals tracker: woken, judged, revealed, named', async () => {
  const game = await run([
    'A {original("general")} {original("merchant")} {awake_count()}.',
    '$ do awaken("general", "hero")', '$ do original_fate("general", "bargain")',
    '$ do reveal("merchant")', '$ do original_fate("merchant", "allied")', '$ do learn_name("merchant")',
    'B {original("general")} {original("general", "by")} {original("general", "fate")} {original("merchant", "name")} {awake_count()} {allied_count()}.',
    '$ do original_fate("general", "sealed")', 'C {original("general")} {awake_count()}.',
  ].join('\n'));
  assert.deepEqual(texts(game.frame), ['A asleep hidden 0.', 'B awake hero bargain yes 2 2.', 'C sealed 1.']);
});

test('a wanderer cannot be awakened, and a sleeper cannot take a wanderer\'s fate', async () => {
  let game = await sysGame({ t1: `${H('t1')}\n# start\n$ do awaken("merchant", "hero")\n---\n=> endbook\n` });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /wanderer/);
  game = await sysGame({ t1: `${H('t1')}\n# start\n$ do awaken("general", "hero")\n$ do original_fate("general", "allied")\n---\n=> endbook\n` });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /use loosed, bargain, drunk, sealed/);
});

test('collection pieces are gained, shown and lost', async () => {
  const game = await run('$ do obtain("gladius")\n$ do display("gladius")\nA {has_item("gladius")} {displayed_count()}.\n$ do lose("gladius")\nB {has_item("gladius")} {item_count()}.');
  assert.deepEqual(texts(game.frame), ['A yes 1.', 'B no 0.']);
});

// ---- Sleep and steward ----------------------------------------------------------------------

const SLEEP_END = (setup) => `${H('end')}\n# start\n${setup}\n$ do sleep()\nWoke {wake("outcome")} by "{wake("by")}" after {wake("years")} years, richer {wake("richer")}.\n---\n=> endbook\n`;

test('a careful sleep prospers; ventures fold in, city holdings stay behind, the hero ages', async () => {
  const setup = [
    '$ wealth = 600', '$ do invest("rome.insulae")', '$ do choose_path("lone")', '$ do acquire("hidden_chamber")', '$ do acquire("vaults")',
    '$ loyalty.keepers = 100', '$ do rest_place("tomb")', '$ do steward("keepers")', '$ do orders("safe")',
    '$ do protection("traps")', '$ do protection("guardians")', '$ do hide_collis(true)',
  ].join('\n');
  const game = await sysGame({ end: SLEEP_END(setup) });
  await game.newGame({ book: 'burning-city', seed: 4 });
  assert.match(texts(game.frame)[0], /^Woke (prospered|on_schedule) by "" after 1410 years, richer yes\.$/);
  const s = S(game);
  assert.equal(V(game).age, 2);
  assert.equal(V(game).hunger, 60);
  assert.ok(s.ventures['rome.insulae'].legacy);
  assert.ok(!s.holdings.hidden_chamber && s.holdings.vaults);
  assert.equal(s.sleep.history.length, 1);
  assert.ok(V(game).wealth > 600);
  assert.ok(game.state.decisions.some((d) => d.name === 'sleep.burning-city'));
});

test('a corrupted steward with dark orders gets him woken early, poorer, by the steward', async () => {
  const setup = ['$ wealth = 600', '$ hunger = 0', '$ secrecy = 10', '$ do steward("bank")', '$ do orders("dark")', '$ do steward_corrupted()'].join('\n');
  const game = await sysGame({ end: SLEEP_END(setup) });
  await game.newGame({ book: 'burning-city', seed: 4 });
  assert.equal(texts(game.frame)[0], 'Woke woken_early by "steward" after 1410 years, richer no.');
  assert.equal(V(game).hunger, 90);
});

test('sleep results are worked out from the plan with a seeded roll', async () => {
  const game = await sysGame({ end: SLEEP_END('$ wealth = 100') });
  await game.newGame({ book: 'burning-city', seed: 1 });
  const st = createState({ book: 'burning-city', seed: 9 });
  st.vars.wealth = 100;
  const ctx = { state: st, vars: st.vars, content: game.content, rand: () => 0.99 };
  const best = resolveSleep(ctx);
  const ctx2 = { ...ctx, rand: () => 0 };
  const worst = resolveSleep(ctx2);
  assert.ok(best.margin > worst.margin);
  assert.equal(best.steward, 'bank');
  assert.deepEqual(best.events, ['sack_of_rome', 'plague_of_justinian', 'black_death']);
});

test('a sleep investment must belong to the gap he sleeps through', async () => {
  const game = await sysGame({ end: SLEEP_END('$ do sleep_invest("new_amsterdam")') });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /not an option when sleeping from "burning-city"/);
});

test('a steward must be in the circle', async () => {
  const game = await sysGame({ end: SLEEP_END('$ do steward("cassian")') });
  await assert.rejects(game.newGame({ book: 'burning-city' }), /not in the circle/);
});

// ---- Quick start ---------------------------------------------------------------------------

test('quick start gives skipped books a default history for the systems', async () => {
  const game = await sysGame({ q: `${H('q', 'crown-of-ashes')}\n# start\nA {original("general")} {original("merchant", "fate")} {original("priestess")} {wake("outcome")} {wealth}.\n---\n=> endbook\n` }, { book: 'crown-of-ashes' });
  await game.startBook('crown-of-ashes', { from: 'quick', seed: 1 });
  assert.equal(texts(game.frame)[0], 'A awake kept_secret asleep on_schedule 40000.');
  assert.equal(S(game).sleep.history.length, 2);
  assert.ok(game.state.decisions.some((d) => d.name === 'original.merchant' && d.quick));
});

// ---- The Velati journal ----------------------------------------------------------------------

const JOURNAL = `@chapter j\n@title j\n@book burning-city\n\n# start\n## The watchers' record\n> He was seen.\n?if owns("rome.wine")\n  He sells wine.\n?else\n  He sells nothing.\n?end\n---\nA second page.\n=> endbook\n`;

test('the Velati journal is written from his choices at the end of the book', async () => {
  const game = await sysGame({ t1: `${H('t1')}\n# start\n$ wealth = 100\n* Trade\n  $ do invest("rome.wine")\n* Do not\n:x\n---\n=> endbook\n` }, { journal: JOURNAL });
  await game.newGame({ book: 'burning-city', seed: 1 });
  await game.choose(0);
  await game.continue();
  const frame = await game.continue();
  assert.equal(frame.wait, 'book_end');
  const entry = game.state.journal.at(-1);
  assert.equal(entry.kind, 'velati');
  assert.equal(entry.title, "The watchers' record");
  assert.deepEqual(entry.paragraphs.map((p) => p.kind), ['quote', 'p', 'p']);
  assert.equal(entry.text, 'He was seen.\nHe sells wine.\nA second page.');
  // Writing it again replaces the entry rather than adding a second one.
  await game.composeJournal('burning-city');
  assert.equal(game.state.journal.filter((e) => e.kind === 'velati').length, 1);
  // The carry record holds the journal for the next book's Previously screen.
  assert.equal(game.journalIn('carry:burning-city').at(-1).title, "The watchers' record");
});

test('a journal script that offers a choice is reported, not fatal', async () => {
  const warn = [];
  const bad = `@chapter j\n@title j\n@book burning-city\n\n# start\n* Pick\n=> endbook\n`;
  const game = await sysGame({ t1: `${H('t1')}\n# start\nEnd.\n---\n=> endbook\n` }, { journal: bad, warn });
  await game.newGame({ book: 'burning-city' });
  await game.continue();
  const frame = await game.continue();
  assert.equal(frame.wait, 'book_end');
  assert.ok(warn.some((w) => /cannot offer choices/.test(w)));
});

// ---- Saves ----------------------------------------------------------------------------------

test('systems state survives a save and load mid mission', async () => {
  const storage = new MemoryStorage();
  const game = await sysGame({ t1: `${H('t1')}\n# start\n${PEOPLE}\n$ do send("prisca", "scout", 3)\n$ do rest()\nWait.\n---\n$ do rest()\nBack: {mission("prisca") != ""}.\n---\n=> endbook\n` }, { storage });
  await game.newGame({ book: 'burning-city', seed: 3 });
  game.saveToSlot('1');
  const fresh = await sysGame({ t1: `${H('t1')}\n# start\n${PEOPLE}\n$ do send("prisca", "scout", 3)\n$ do rest()\nWait.\n---\n$ do rest()\nBack: {mission("prisca") != ""}.\n---\n=> endbook\n` }, { storage });
  await fresh.loadSlot('1');
  assert.equal(fresh.state.sys.circle.prisca.mission.left, 1);
  const frame = await fresh.continue();
  assert.equal(texts(frame)[0], 'Back: yes.');
});

test('schema 2 saves upgrade to the current schema with empty systems', async () => {
  assert.equal(SCHEMA, 6);
  assert.deepEqual(SCHEMA_MIGRATIONS[2]({ vars: {} }).sys, createSys());
  const storage = new MemoryStorage();
  const src = { t1: `${H('t1')}\n# start\nOne.\n---\nTwo {coven_size()}.\n---\n=> endbook\n` };
  const game = await sysGame(src, { storage });
  await game.newGame({ book: 'burning-city' });
  const env = JSON.parse(storage.getItem('tsb:slot:auto'));
  const state = JSON.parse(env.payload);
  delete state.sys;
  const payload = JSON.stringify(state);
  storage.setItem('tsb:slot:auto', JSON.stringify({ ...env, format: SAVE_FORMAT, schema: 2, payload, checksum: fnv1a(payload) }));
  const fresh = await sysGame(src, { storage });
  await fresh.loadSlot('auto');
  const frame = await fresh.continue();
  assert.equal(texts(frame)[0], 'Two 0.');
});

// ---- The checker --------------------------------------------------------------------------

test('the checker rejects misspelled ids, wrong values and wrong argument counts', async () => {
  const game = await sysGame({});
  const src = `${H('c')}\n# start\n$ do invest("rome.wnie")\n$ do feed("cat")\n$ do build()\n?if original("generl")\n  x\n?end\n$ do sleep_invest(_x)\n=> endbook\n`;
  const { chapter } = parseChapter(src, { file: 'c.tsb' });
  const { errors } = checkChapterContent(chapter, { stats: game.statDefs, content: game.content });
  const msgs = errors.map((e) => e.message).join('\n');
  assert.match(msgs, /unknown venture "rome\.wnie"/);
  assert.match(msgs, /"cat" is not one of: human, human_kill, animal, donor, bank/);
  assert.match(msgs, /\$ do build\(\) takes 1 argument\(s\), got 0/);
  assert.match(msgs, /unknown original "generl"/);
  assert.equal(errors.length, 4); // a computed argument is checked at play time instead
});

test('the real catalogs pass their own checks and every command is reachable', async () => {
  const game = await sysGame({});
  const bookIds = new Set((await real.manifest()).books.map((b) => b.id));
  assert.deepEqual(checkCatalog(game.content.systems, { bookIds }), []);
  assert.deepEqual(checkCall('command', 'fight', [{ t: 'lit', v: 'lictor' }], game.content), []);
  assert.ok(SYSTEM_COMMAND_NAMES.includes('rest'));
  for (const b of BOOKS) assert.ok(bookIds.has(b));
});

test('the systems engine test book plays to the end with a journal and no warnings', async () => {
  const warnings = [];
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: (m) => warnings.push(m), now: () => 1 });
  await game.init();
  let frame = await game.newGame({ book: 'engine-test-c', seed: 3 });
  for (let i = 0; i < 40 && frame.wait !== 'book_end'; i++) frame = frame.wait === 'choices' ? await game.choose(0) : await game.continue();
  assert.equal(frame.wait, 'book_end');
  assert.equal(game.state.journal.at(-1).kind, 'velati');
  assert.equal(game.systems().circle.length, 2);
  assert.deepEqual(warnings, []);
});

// ---- Coven tasks and the Coven tab -------------------------------------------------------------

const B2 = { book: 'blood-and-gold' };

test('a member tasked to the business raises income, a mission stops it, and standing down ends it', async () => {
  const game = await run([
    '$ wealth = 500', '$ do invest("rome.insulae")', '$ do keeper("prisca", "steward", 80)',
    'A {income()}.', '$ do coven_task("prisca", "business")', 'B {income()} "{task("prisca")}".',
    '$ do send("prisca", "scout", 1)', 'C {income()}.', '$ do rest()', '$ do debrief("prisca")',
    '$ do coven_task("prisca", "none")', 'D {income()} "{task("prisca")}".',
  ].join('\n'));
  const [a, b, c, d] = texts(game.frame).map((t) => t.match(/\d+/)[0]);
  assert.ok(Number(b) > Number(a), 'the coven adds to income');
  assert.equal(c, a, 'away on a mission, they do not work the business');
  assert.equal(d, a);
  assert.match(texts(game.frame)[1], /"business"/);
});

test('a task cannot go to someone outside the circle or no longer active', async () => {
  await assert.rejects(run('$ do coven_task("prisca", "guard")'), /not in the circle/);
  await assert.rejects(run(['$ do keeper("prisca", "steward")', '$ do member_fate("prisca", "left")', '$ do coven_task("prisca", "guard")'].join('\n')), /not available/);
});

test('standing tasks run through the long sleep, are reported on waking, and stay set in the next book', async () => {
  const game = await sysGame({ end: SLEEP_END(['$ do keeper("prisca", "steward", 90)', '$ do coven_task("prisca", "watch")', '$ do steward("prisca")'].join('\n')) });
  await game.newGame({ book: 'burning-city', seed: 3 });
  assert.ok(['success', 'partial', 'failed'].includes(S(game).circle.prisca.taskResult));
  assert.equal(S(game).circle.prisca.task, 'watch');
  assert.equal(typeof S(game).sleep.wake.intel, 'number');
  assert.equal(S(game).sleep.wake.tasks[0].id, 'prisca');
});

test('guard lowers the danger of the sleep, and a member who acts alone ignores the task', async () => {
  const setup = (loyalty) => ['$ do keeper("prisca", "steward", ' + loyalty + ')', '$ do coven_task("prisca", "guard")'].join('\n');
  const margins = [];
  for (const [loyalty, task] of [[95, true], [95, false], [10, true]]) {
    const game = await sysGame({ t1: `${H('t1')}\n# start\n${setup(loyalty)}\n${task ? '' : '$ do coven_task("prisca", "none")'}\n---\n=> endbook\n` });
    await game.newGame({ book: 'burning-city', seed: 5 });
    const ctx = { state: game.state, vars: game.state.vars, content: game.content, rand: () => 0.5 };
    margins.push(resolveSleep(ctx, undefined));
  }
  assert.ok(margins[0].margin > margins[1].margin, 'a guard makes the sleep safer');
  assert.equal(margins[2].tasks[0].outcome, 'failed');
  assert.equal(margins[2].margin, margins[1].margin);
});

test('the Coven tab lists members, what they are doing and the task options, and the game saves a change', async () => {
  const game = await run('$ do keeper("prisca", "steward", 80)');
  game.setCovenTask('prisca', 'business');
  const view = game.coven();
  assert.equal(view.members.length, 1);
  assert.equal(view.members[0].task, 'business');
  assert.match(view.members[0].doing, /work the business/i);
  assert.deepEqual(view.tasks.map((t) => t.id), ['guard', 'business', 'watch']);
  assert.throws(() => game.setCovenTask('prisca', 'dance'), /unknown task/);
  game.setCovenTask('prisca', 'none');
  assert.equal(game.coven().members[0].task, '');
});

test('schema 5 saves gain empty task fields', () => {
  const s = SCHEMA_MIGRATIONS[5]({ sys: { circle: { a: { id: 'a' } } } });
  assert.equal(s.sys.circle.a.task, '');
  assert.equal(s.sys.circle.a.taskResult, '');
});
