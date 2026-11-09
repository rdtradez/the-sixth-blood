// Session 18: Book Two, chapters 1 and 2. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeLoader } from '../engine/node-loader.js';
import { MemoryStorage } from '../engine/saves.js';
import { Game } from '../engine/game.js';
import * as dev from '../engine/dev.js';
import { texts } from './helpers.js';

const root = join(fileURLToPath(import.meta.url), '../..');
const real = createNodeLoader(root);
const HERO = { gender: 'm', origin: 'roman', role: 'legionary', path: 'born_in_rome' };

async function newGame() {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {}, now: () => 5000 });
  await game.init();
  return game;
}

async function drive(game, frame, wants = [], stopAt = null) {
  const pages = [];
  for (let i = 0; i < 3000 && frame.wait !== 'book_end' && !(stopAt && game.state.chapter === stopAt); i++) {
    pages.push(...texts(frame));
    if (frame.wait === 'choices') {
      let at = 0;
      for (const want of wants) {
        const hit = frame.choices.findIndex((c) => want.test(c.text));
        if (hit >= 0) { at = hit; break; }
      }
      frame = await game.choose(at);
    } else {
      frame = await game.continue();
    }
  }
  pages.push(...texts(frame));
  return { game, frame, text: pages.join('\n'), vars: game.state.vars };
}

async function play(chapter, wake, vars, wants = [], { stopAt = null, seed = 3 } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', years: 1410, ...wake };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt);
}

const WAKES = [
  {},
  { place: 'collesanto', steward: 'keepers' },
  { place: 'tomb', steward: 'prisca', outcome: 'on_schedule' },
  { place: 'haven', steward: 'hanno' },
];

test('Book Two is listed as incomplete with six chapters', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'blood-and-gold');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 6);
});

test('chapter 1 plays through for every kind of waking and reaches chapter 2', async () => {
  for (const wake of WAKES) {
    const run = await play('b2c01', wake, { 'b1.keepers': wake.steward === 'keepers' ? 'sworn' : 'spared' }, [], { stopAt: 'b2c02' });
    assert.equal(run.game.state.chapter, 'b2c02', JSON.stringify(wake));
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('chapter 2 plays through, reaches chapter 3, and is free of dashes and braces', async () => {
  for (const wake of WAKES) {
    const run = await play('b2c02', wake, { 'b1.keepers': 'sworn', wealth: 500 }, [], { stopAt: 'b2c03' });
    assert.equal(run.game.state.chapter, 'b2c03');
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
    assert.doesNotMatch(run.text, /\$ do /);
  }
});

test('chapter 2 records each decision', async () => {
  for (const [key, re] of [['kept', /Say nothing, and let the story stand/], ['curbed', /quietly ended/], ['shaped', /let it grow/]]) {
    const run = await play('b2c02', {}, { 'b1.keepers': 'spared' }, [/Climb to the shrine/, re], { stopAt: 'b2c03' });
    assert.equal(run.vars['b2.saint'], key);
  }
  const friar = await play('b2c02', {}, { 'b1.keepers': 'spared', wealth: 3000 }, [/Make the shrine a great gift/], { stopAt: 'b2c03' });
  assert.equal(friar.vars['b2.friar'], 'paid');
  const family = await play('b2c02', {}, { 'b1.keepers': 'spared' }, [/Tell him the truth|Tell her the truth/, /Say yes/], { stopAt: 'b2c03' });
  assert.equal(family.vars['b2.valerii'], 'sworn');
  assert.equal(family.vars['b2.fiammetta'], 'allowed');
});
