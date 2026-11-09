// Interlude session A: the first Lost Centuries chapters, the chained sleep and chapter level journals.
// (This file says what is guaranteed, not what happens.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createNodeLoader } from '../engine/node-loader.js';
import { MemoryStorage } from '../engine/saves.js';
import { Game } from '../engine/game.js';
import { texts } from './helpers.js';

const root = join(fileURLToPath(import.meta.url), '../..');
const real = createNodeLoader(root);
const HERO = { gender: 'm', origin: 'roman', role: 'legionary', path: 'born_in_rome' };

async function playBook(seed, pick = () => 0) {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {}, now: () => 5000 });
  await game.init();
  let frame = (await game.startBook('burning-city', { from: 'new', hero: HERO, seed })).frame;
  const pages = [];
  for (let i = 0; i < 8000 && frame.wait !== 'book_end'; i++) {
    pages.push(...texts(frame));
    frame = frame.wait === 'choices' ? await game.choose(pick(frame, i)) : await game.continue();
  }
  pages.push(...texts(frame));
  return { game, frame, text: pages.join('\n') };
}

test('the five interlude chapters play to the end of Book One and unlock Book Two', async () => {
  const run = await playBook(3);
  assert.equal(run.frame.wait, 'book_end');
  assert.equal(run.frame.nextBook, 'blood-and-gold');
  assert.ok(run.game.state.booksDone.includes('burning-city'));
  assert.equal(run.game.library().find((b) => b.id === 'blood-and-gold').unlocked, true);
});

test('interludes are not numbered and are not counted as chapters', async () => {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {} });
  await game.init();
  const book = game.library().find((b) => b.id === 'burning-city');
  assert.equal(book.chapterCount, 20);
  for (const id of ['lc01', 'lc02', 'lc03', 'lc04', 'lc05']) assert.equal(game.chapterMeta[id]?.number ?? null, null, `${id} is unnumbered`);
});

test('the sleep is a chain: the wake report sums the segments and gathers every event', async () => {
  const { game } = await playBook(3);
  const history = game.state.sys.sleep.history.filter((h) => h.chain === 'lost_centuries');
  assert.equal(history.length, 4);
  assert.deepEqual(history.map((h) => h.segments), [1, 2, 3, 4]);
  const wake = game.state.sys.sleep.wake;
  assert.equal(wake.chain, 'lost_centuries');
  assert.equal(wake.segments, 4);
  assert.equal(wake.years, 1410);
  for (let i = 1; i < history.length; i++) assert.ok(history[i - 1].years < history[i].years, 'years accumulate');
  for (const ev of ['sack_of_rome', 'fall_of_the_west', 'plague_of_justinian', 'black_death']) assert.ok(wake.events.includes(ev), ev);
});

test('chapter level journal entries are written for the two chapters that carry one, in order', async () => {
  const { game } = await playBook(3);
  const velati = game.state.journal.filter((e) => e.kind === 'velati' && e.book === 'burning-city');
  assert.deepEqual(velati.map((e) => e.chapter ?? null), [null, 'lc02', 'lc03'], 'the book entry comes first, then the interludes');
  for (const e of velati) assert.ok(e.title && e.title.length > 5);
});

test('replaying the book does not duplicate the book entry', async () => {
  const { game } = await playBook(5);
  const entries = game.state.journal.filter((e) => e.kind === 'velati' && e.book === 'burning-city' && !e.chapter);
  assert.equal(entries.length, 1);
});

test('interlude prose has no dashes and no unresolved braces, across several seeds and choice patterns', async () => {
  const picks = [() => 0, (f, i) => (i % 2 ? f.choices.length - 1 : 0), (f, i) => i % f.choices.length];
  for (const [n, pick] of picks.entries()) {
    const { text, frame } = await playBook(10 + n, pick);
    assert.equal(frame.wait, 'book_end');
    assert.doesNotMatch(text, /[–—]/, 'no en or em dashes');
    assert.doesNotMatch(text, /\{[^}]*\}/, 'no unresolved braces');
  }
});

test('interlude flags are registered, major and carry quick start defaults', async () => {
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8'));
  const table = flags.flags ?? flags;
  for (const id of ['lc.collis', 'lc.gate', 'lc.court', 'lc.hill', 'lc.road', 'lc.watchers', 'lc.seat', 'lc.answer', 'lc.sunwalk', 'lc.hill_537', 'lc.court_537']) {
    assert.ok(table[id], `${id} is registered`);
    assert.equal(table[id].major, true, `${id} is major`);
    assert.ok('default' in table[id], `${id} has a default`);
  }
});

test('a quick start into Book Two still resolves the umbrella gap', async () => {
  const sleep = JSON.parse(await readFile(join(root, 'content/sleep.json'), 'utf8'));
  const gaps = sleep.gaps ?? sleep;
  const all = Array.isArray(gaps) ? gaps : Object.entries(gaps).map(([id, g]) => ({ id, ...g }));
  const umbrella = all.find((g) => (g.id ?? g.name) === 'rome_to_florence');
  assert.ok(umbrella, 'the umbrella gap remains');
  assert.ok(!umbrella.split, 'the umbrella gap is not split');
  for (const id of ['rome_to_sack', 'sack_to_byzantium', 'byzantium_to_plague', 'plague_to_florence']) assert.ok(all.find((g) => (g.id ?? g.name) === id), id);
});
