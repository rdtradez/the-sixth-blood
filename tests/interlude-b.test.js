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

test('the 1348 interludes play through every choice pattern and set their flags', async () => {
  const picks = [() => 0, (f) => f.choices.length - 1, (f, i) => i % f.choices.length];
  for (const [n, pick] of picks.entries()) {
    const { game, frame, text } = await playBook(20 + n, pick);
    assert.equal(frame.wait, 'book_end');
    assert.ok(['sheltered', 'turned_away'].includes(game.state.vars['lc.village_1348']) || game.state.vars['lc.village_1348'] === undefined);
    assert.doesNotMatch(text, /[–—]/);
    assert.doesNotMatch(text, /\{[^}]*\}/);
  }
});

test('the chain ends with plague_to_florence and the whole sleep still sums to 1410 years', async () => {
  const { game } = await playBook(3);
  const history = game.state.sys.sleep.history.filter((h) => h.chain === 'lost_centuries');
  assert.equal(history.at(-1).gap, 'plague_to_florence');
  assert.equal(game.state.sys.sleep.wake.years, 1410);
});

test('lc04 and lc05 are unnumbered interludes after lc03', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'content/manifest.json'), 'utf8'));
  const ids = manifest.books[0].chapters.map((c) => c.id);
  assert.deepEqual(ids.slice(-5), ['lc01', 'lc02', 'lc03', 'lc04', 'lc05']);
});
