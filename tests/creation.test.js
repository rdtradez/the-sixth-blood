// Session 5: character creation (appearance, compatible roles and paths, hero variables), the
// prologue played as every hero the creation screen can make, and books that are still being written.

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createNodeLoader } from '../engine/node-loader.js';
import { MemoryStorage } from '../engine/saves.js';
import { Game } from '../engine/game.js';
import * as dev from '../engine/dev.js';
import { checkContentFiles } from '../engine/content-check.js';
import { lookCatalog, suggestLook, normalizeLook, optionIds, describeLook, seededRandom, LOOK_FIELDS } from '../engine/looks.js';
import { memoryLoader, makeGame, texts } from './helpers.js';

const root = join(fileURLToPath(import.meta.url), '../..');
const real = createNodeLoader(root);

async function realGame({ storage = new MemoryStorage() } = {}) {
  const game = new Game({ loader: real, storage, warn: () => {}, now: () => 5000 });
  await game.init();
  return game;
}

/** Every combination the creation screen offers. */
function combos(game) {
  const out = [];
  for (const o of game.creationOptions().origins) {
    for (const role of o.roles) for (const path of game.compatiblePaths(o.id, role)) out.push({ origin: o.id, role, path });
  }
  return out;
}

// ---- Appearance ---------------------------------------------------------------------------------

test('every origin and role gets a complete, valid look, and the same one every time', async () => {
  const game = await realGame();
  const looks = game.content.systems.looks;
  for (const c of combos(game)) {
    const look = suggestLook(looks, c);
    assert.deepEqual(Object.keys(look), looks.order);
    for (const f of LOOK_FIELDS) assert.ok(optionIds(looks, f, c.origin).includes(look[f]), `${c.origin}/${c.role}: ${f}=${look[f]}`);
    assert.deepEqual(suggestLook(looks, c), look);
  }
});

test('quick create is varied but repeatable from a seed, and always valid', async () => {
  const game = await realGame();
  const looks = game.content.systems.looks;
  const c = { origin: 'gaul', role: 'gladiator', path: 'captured' };
  const a = suggestLook(looks, c, seededRandom(7));
  assert.deepEqual(suggestLook(looks, c, seededRandom(7)), a);
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const look = suggestLook(looks, c, seededRandom(seed));
    seen.add(JSON.stringify(look));
    for (const f of LOOK_FIELDS) assert.ok(optionIds(looks, f, 'gaul').includes(look[f]), `seed ${seed}: ${f}=${look[f]}`);
  }
  assert.ok(seen.size > 10, 'seeds should give many different looks');
});

test('a gladiator is suggested an arena scar, and skin tones follow the origin', async () => {
  const game = await realGame();
  const looks = game.content.systems.looks;
  assert.equal(suggestLook(looks, { origin: 'gaul', role: 'gladiator' }).mark, 'scar_arena');
  assert.equal(suggestLook(looks, { origin: 'gaul', role: 'merchant' }).mark, 'none');
  assert.ok(!optionIds(looks, 'skin', 'briton').includes('deep_brown'));
  assert.ok(optionIds(looks, 'skin', 'north_african').includes('deep_brown'));
});

test('normalizeLook keeps valid choices and repairs unknown or out of range ones', async () => {
  const game = await realGame();
  const looks = game.content.systems.looks;
  const hero = { origin: 'briton', role: 'gladiator' };
  const fixed = normalizeLook(looks, hero, { height: 'very_tall', skin: 'deep_brown', eyes: 'purple', hair: 'red' });
  assert.equal(fixed.height, 'very_tall');
  assert.equal(fixed.hair, 'red');
  assert.notEqual(fixed.skin, 'deep_brown', 'skin outside the origin falls back to a fitting tone');
  assert.ok(optionIds(looks, 'eyes').includes(fixed.eyes));
  assert.deepEqual(normalizeLook(looks, hero, null), suggestLook(looks, hero));
});

test('describeLook writes the whole hero in the second person, mark last', async () => {
  const game = await realGame();
  const looks = game.content.systems.looks;
  const text = describeLook(looks, { height: 'tall', build: 'lean', age: 'prime', hair: 'black', hairstyle: 'tied', eyes: 'hazel', skin: 'olive', mark: 'scar_arena' });
  assert.equal(text, 'You are tall, with a lean frame. You look to be in the prime of life. Your hair is black, tied back. Your eyes are hazel. Your skin is olive. You carry a pale scar from the arena down your ribs.');
  assert.equal(describeLook(looks, { height: 'short', mark: 'none' }), 'You are short.');
  assert.equal(describeLook(looks, {}), '');
  assert.equal(describeLook(lookCatalog(null), { height: 'tall' }), '');
});

// ---- Creation rules -----------------------------------------------------------------------------

test('the creation screen only offers roles and paths that fit, and every origin has some', async () => {
  const game = await realGame();
  const opts = game.creationOptions();
  assert.equal(opts.origins.length, 8);
  assert.equal(opts.roles.length, 5);
  assert.equal(opts.paths.length, 8);
  for (const o of opts.origins) {
    assert.ok(o.roles.length >= 4, `${o.id} is offered ${o.roles.length} roles`);
    assert.ok(o.blurb && o.names.m.length && o.names.f.length, `${o.id} has blurb and names`);
    for (const role of o.roles) assert.ok(game.compatiblePaths(o.id, role).length >= 2, `${o.id} as ${role}`);
  }
  assert.ok(!opts.origins.find((o) => o.id === 'roman').roles.includes('house_slave'), 'a Roman citizen was never a slave');
  assert.ok(!game.compatiblePaths('roman', 'legionary').includes('captured'));
  assert.ok(!game.compatiblePaths('gaul', 'legionary').includes('captured'));
  assert.ok(game.compatiblePaths('gaul', 'gladiator').includes('captured'));
  assert.equal(game.compatiblePaths('gaul', 'gladiator')[0], 'captured', 'the origin suggestion comes first');
});

test('suggestHero fits role, path, name and look to the origin', async () => {
  const game = await realGame();
  const hero = game.suggestHero({ gender: 'f', origin: 'briton', role: 'merchant', path: 'captured' });
  assert.equal(hero.origin, 'briton');
  assert.ok(game.compatiblePaths('briton', hero.role).includes(hero.path), 'an impossible path is replaced');
  assert.ok(game.suggestNames('briton', 'f').includes(hero.name));
  assert.deepEqual(Object.keys(hero.look), game.content.systems.looks.order);
  const kept = game.suggestHero({ origin: 'roman', name: ' Livius ', look: { height: 'short' } });
  assert.equal(kept.name, 'Livius');
  assert.equal(kept.look.height, 'short');
  assert.equal(kept.look.skin, game.suggestHero({ origin: 'roman' }).look.skin, 'missing look fields are filled in');
});

test('heroVars stores the chosen look as hero.look.* and fills gaps for old style callers', async () => {
  const game = await realGame();
  const vars = game.heroVars({ gender: 'f', name: 'Brica', origin: 'briton', role: 'gladiator', path: 'captured', look: { height: 'tall', hair: 'red' } });
  assert.equal(vars['hero.name'], 'Brica');
  assert.equal(vars['hero.look.height'], 'tall');
  assert.equal(vars['hero.look.hair'], 'red');
  for (const f of LOOK_FIELDS) assert.equal(typeof vars[`hero.look.${f}`], 'string', f);
  const bare = game.heroVars({ origin: 'gaul' });
  for (const f of LOOK_FIELDS) assert.equal(typeof bare[`hero.look.${f}`], 'string', `bare ${f}`);
});

test('look(), marked() and look_sentence() read the hero in scripts', async () => {
  const src = '@chapter c1\n@title One\n@book b\n\n# start\nYou are {look("height")} and {look("hairstyle")}.\n?if marked()\n  Marked: {look("mark")}.\n?else\n  Unmarked.\n?end\n{look_sentence()}\n=> endbook\n';
  const loader = memoryLoader({ chapters: { c1: src } });
  loader.json = async (name) => (name === 'looks' ? JSON.parse(await readFile(join(root, 'content/looks.json'), 'utf8')) : null);
  const game = await makeGame(loader);
  const vars = { 'hero.look.height': 'tall', 'hero.look.hairstyle': 'braided', 'hero.look.mark': 'none' };
  const plain = await game.newGame({ book: 'b', vars });
  assert.deepEqual(texts(plain), ['You are tall and braided.', 'Unmarked.', 'You are tall.']);
  const marked = await game.newGame({ book: 'b', vars: { ...vars, 'hero.look.mark': 'scar_war' } });
  assert.deepEqual(texts(marked), ['You are tall and braided.', 'Marked: an old battle scar across your forearm.', 'You are tall. You carry an old battle scar across your forearm.']);
});

test('the checker rejects broken appearance and compatibility data', async () => {
  const game = await realGame();
  const input = (content) => ({ manifest: game.manifest, stats: game.statDefs, content });
  assert.deepEqual(checkContentFiles(input(game.content)).errors, []);
  const looks = JSON.parse(JSON.stringify(game.content.systems.looks));
  const origins = JSON.parse(JSON.stringify(game.content.origins));
  looks.skinByOrigin.gaul = ['no_such_tone'];
  looks.suggest.role.gladiator.mark = ['no_such_mark'];
  origins.role.find((r) => r.id === 'gladiator').paths = ['hostage_of_nowhere'];
  origins.role.find((r) => r.id === 'merchant').notFor = ['atlantis'];
  const broken = { ...game.content, origins, systems: { ...game.content.systems, looks } };
  const bad = checkContentFiles(input(broken)).errors.join('\n');
  assert.match(bad, /gaul lists unknown skin tone "no_such_tone"/);
  assert.match(bad, /role gladiator suggests unknown mark "no_such_mark"/);
  assert.match(bad, /role gladiator lists unknown path "hostage_of_nowhere"/);
  assert.match(bad, /role merchant is not for unknown origin "atlantis"/);
});

// ---- The prologue -------------------------------------------------------------------------------

test('the prologue plays without errors for every hero the creation screen can make', async () => {
  const game = await realGame();
  const list = combos(game);
  assert.ok(list.length > 100, `${list.length} combinations`);
  const reached = new Set();
  for (const [i, c] of list.entries()) {
    const gender = i % 2 ? 'f' : 'm';
    const base = game.quickState('burning-city', { hero: game.suggestHero({ ...c, gender }) });
    const report = await dev.explore(game, 'b1p', { base });
    assert.deepEqual(report.errors, [], `${c.origin}/${c.role}/${c.path}`);
    assert.equal(report.truncated, false);
    assert.equal(report.optionsTaken, report.optionsTotal, `${c.origin}/${c.role}/${c.path}: every option can be taken`);
    for (const s of Object.keys((await game.getChapter('b1p')).scenes)) if (!report.unreachedScenes.includes(s)) reached.add(s);
  }
  // Every scene, including each role's memory and ending, is played by some hero.
  // (The two shared fallback scenes exist only for heroes with a role that has no variant.)
  const all = Object.keys((await game.getChapter('b1p')).scenes);
  assert.deepEqual(all.filter((s) => !reached.has(s)), ['memory_of_work', 'the_end']);
});

async function playPrologue(hero, picks = []) {
  const game = await realGame();
  let { frame } = await game.startBook('burning-city', { from: 'new', hero, seed: 3 });
  const pages = [];
  let n = 0;
  // The prologue hands over to chapter 1, so stop at the first page that belongs to another chapter.
  for (let i = 0; i < 80 && frame.wait !== 'book_end' && game.state.chapter === 'b1p'; i++) {
    pages.push(...texts(frame));
    frame = frame.wait === 'choices' ? await game.choose(picks[n++] ?? 0) : await game.continue();
  }
  if (game.state.chapter === 'b1p') pages.push(...texts(frame));
  return { game, frame, pages, text: pages.join('\n') };
}

test('the prologue is written for the hero: name, family, pronouns, look and no leftovers', async () => {
  const man = await playPrologue({ gender: 'm', name: 'Hanno', origin: 'north_african', role: 'merchant', path: 'trader' });
  assert.match(man.text, /your wife/);
  assert.match(man.text, /Livia/);
  assert.match(man.text, /Aelia/);
  assert.match(man.text, /Felix/);
  assert.match(man.text, /You are [^\n]*, with [^\n]*\./, 'the hero sees their own reflection');
  const woman = await playPrologue({ gender: 'f', name: 'Brica', origin: 'briton', role: 'gladiator', path: 'captured' });
  assert.match(woman.text, /your husband/);
  assert.match(woman.text, /Marcus/);
  assert.match(woman.text, /arena/);
  for (const run of [man, woman]) {
    assert.doesNotMatch(run.text, /\{|\}|undefined|NaN|\[object|\bnull\b/);
    assert.doesNotMatch(run.text, /[–—]/, 'no dashes in the story text');
    assert.match(run.text, /after Rome\?/);
  }
  assert.equal(man.game.state.vars['hero.death'], 'fever');
  assert.equal(woman.game.state.vars['hero.death'], 'arena');
});

test('the mortal role decides which ending the prologue plays', async () => {
  const ends = {};
  for (const role of ['gladiator', 'legionary', 'merchant', 'physician_aide', 'house_slave']) {
    const origin = role === 'house_slave' ? 'briton' : 'gaul';
    const path = role === 'legionary' ? 'auxiliary' : 'captured';
    const run = await playPrologue({ origin, role, path });
    ends[role] = run.game.state.vars['hero.death'];
  }
  assert.deepEqual(ends, { gladiator: 'arena', legionary: 'execution', merchant: 'fever', physician_aide: 'fever', house_slave: 'execution' });
});

test('the prologue choices change stats, flags and later lines', async () => {
  const hero = { gender: 'm', origin: 'roman', role: 'legionary', path: 'born_in_rome' };
  // Choice order: the day, the square, the table, the end.
  const a = await playPrologue(hero, [0, 0, 0, 0]);
  const b = await playPrologue(hero, [1, 1, 1, 1]);
  const c = await playPrologue(hero, [2, 2, 2, 2]);
  const v = (run) => run.game.state.vars;
  assert.deepEqual([v(a)['prologue.day'], v(a)['prologue.stand'], v(a)['prologue.answer']], ['children', 'paid', 'yes']);
  assert.deepEqual([v(b)['prologue.day'], v(b)['prologue.stand'], v(b)['prologue.answer']], ['fields', 'stood', 'asked']);
  assert.deepEqual([v(c)['prologue.day'], v(c)['prologue.stand'], v(c)['prologue.answer']], ['boundary', 'looked_away', 'refused']);
  assert.ok(v(b).cunning_brutal > v(a).cunning_brutal, 'standing up is the brutal choice');
  assert.ok(v(b).defiance > v(a).defiance, 'standing up and asking raise defiance most');
  assert.equal(new Set([a, b, c].map((r) => v(r).defiance)).size, 3, 'each route leaves a different mark');
  assert.ok(v(a)['bond.aelia'] > v(b)['bond.aelia'] || v(a)['bond.felix'] > v(b)['bond.felix']);
  assert.notEqual(a.text, b.text);
  assert.match(a.text, /You said yes/);
  assert.match(b.text, /You asked what it would cost/);
  assert.match(c.text, /You said no/);
  // The decisions are in the log for later chapters and journals.
  const logged = a.game.state.decisions.map((d) => d.name);
  assert.ok(['prologue.day', 'prologue.stand', 'prologue.answer'].every((n) => logged.includes(n)), logged.join());
});

test('the prologue sets up the family, Collesanto and the starting purse like a quick start', async () => {
  const run = await playPrologue({ gender: 'm', origin: 'roman', role: 'merchant', path: 'born_in_rome' });
  const st = run.game.state;
  assert.equal(st.vars.wealth, 20);
  assert.equal(st.vars.collesanto, 15);
  assert.ok(['spouse', 'aelia', 'felix'].every((id) => st.sys.people[id]), 'family met');
  assert.deepEqual(['hero', 'spouse', 'aelia', 'felix'].filter((id) => !st.sys.lore.kin[id]), []);
  assert.ok(st.sys.lore.codex.collesanto, 'Collesanto is in the codex');
  const quick = await realGame();
  const q = quick.quickState('burning-city', { hero: { origin: 'roman' } });
  assert.equal(q.vars.wealth, 20);
  assert.equal(q.vars.collesanto, 15);
});

// ---- Books that are still being written ------------------------------------------------------------

test('finishing the written part of an unfinished book pauses it instead of ending it', async () => {
  const storage = new MemoryStorage();
  const game = await realGame({ storage });
  let { frame } = await game.startBook('burning-city', { from: 'new', hero: { origin: 'roman', role: 'legionary', path: 'born_in_rome' }, seed: 3 });
  assert.equal(game.chapterMeta.b1p.number, null, 'a prologue is not numbered');
  for (let i = 0; i < 400 && frame.wait !== 'book_end'; i++) frame = frame.wait === 'choices' ? await game.choose(0) : await game.continue();
  assert.equal(frame.wait, 'book_end');
  assert.equal(frame.pending, true);
  assert.equal(frame.nextBook, null);
  const book = game.library().find((b) => b.id === 'burning-city');
  assert.equal(book.completed, false, 'the book is not finished');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 10, 'the prologue is not counted as a chapter (chapters 1 to 10 are written)');
  assert.equal(book.reachedNumber, 10);
  assert.equal(game.library().find((b) => b.id === 'blood-and-gold').unlocked, false, 'the next book stays locked');
  assert.deepEqual(game.saves.listCarries(['burning-city']), [], 'no carry save is made');
  assert.deepEqual(game.state.booksDone, []);
  assert.deepEqual(game.state.journal, []);
  await assert.rejects(() => game.continueToNextBook(), /has not ended/);
  // The paused story is autosaved and loads back to the same place.
  const again = await realGame({ storage });
  const loaded = await again.loadSlot('auto');
  assert.equal(loaded.frame.pending, true);
});

test('a pause is not mistaken for the end of a book when starting the next one', async () => {
  const storage = new MemoryStorage();
  const loader = memoryLoader({ chapters: { c1: '@chapter c1\n@title One\n@book a\n\n# start\nHello.\n=> next\n' }, bookId: 'a' });
  const baseManifest = await loader.manifest();
  loader.manifest = async () => ({
    ...baseManifest,
    books: [
      { ...baseManifest.books[0], incomplete: true },
      { id: 'b', title: 'Second', chapters: [{ id: 'd1', file: 'd1.tsb', title: 'D' }] },
    ],
  });
  loader.files['d1.tsb'] = '@chapter d1\n@title D\n@book b\n\n# start\nHi.\n=> endbook\n';
  const game = await makeGame(loader, { storage });
  await game.newGame({ book: 'a' });
  const frame = await game.continue();
  assert.equal(frame.pending, true);
  game.saveToSlot('1');
  assert.deepEqual(game.startSaves('b'), [], 'a paused save does not count as finishing the first book');
  await assert.rejects(() => game.startBook('b', { from: 'slot', slot: '1' }), /unlocks when you finish/);
});

test('a paused book carries on by itself once its next chapter is written', async () => {
  const storage = new MemoryStorage();
  const one = '@chapter c1\n@title One\n@book a\n\n# start\nFirst.\n=> next\n';
  const two = '@chapter c2\n@title Two\n@book a\n\n# start\nSecond.\n=> endbook\n';
  const before = memoryLoader({ chapters: { c1: one }, bookId: 'a' });
  const m1 = await before.manifest();
  before.manifest = async () => ({ ...m1, books: [{ ...m1.books[0], incomplete: true }] });
  const game = await makeGame(before, { storage });
  await game.newGame({ book: 'a' });
  const paused = await game.continue();
  assert.equal(paused.pending, true);

  const after = memoryLoader({ chapters: { c1: one, c2: two }, bookId: 'a' });
  const m2 = await after.manifest();
  after.manifest = async () => ({ ...m2, books: [{ ...m2.books[0], incomplete: true }] });
  const later = await makeGame(after, { storage });
  const { frame, notices } = await later.loadSlot('auto');
  assert.equal(later.state.chapter, 'c2');
  assert.deepEqual(texts(frame), ['Second.']);
  assert.match(notices.join(' '), /carries on/);
});
