// Session 60: Book Five, chapters 19 and 20 (the end of the book). Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

async function play(chapter, wake, vars, wants = [], { sys = null, seed = 3, stopAt = null, flags = {} } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', orders: 'safe', years: 20, invest: [], ...wake };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  for (const [k, v] of Object.entries(flags)) dev.setVar(game, k, v);
  if (sys) sys(game);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt);
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
  assert.doesNotMatch(run.text, /in the sun\b|last of the sun|in the daylight/);
};

const START = { hunger: 10, wealth: 300000 };

const coven = (g) => {
  const s = g.state.sys;
  s.path = 'coven';
  for (const [id, role] of [['prisca', 'head of the house'], ['fiammetta', 'fledgling of the hill'], ['hanno', 'keeper of the ledgers']]) {
    s.circle[id] = { id, kind: 'vampire', line: 'merchant', sire: 'hero', injured: false, mission: null, quest: null, task: '', taskResult: '', role, status: 'active', joined: 'blood-and-gold' };
    g.state.vars[`loyalty.${id}`] = 70;
  }
};

const cs = ['b5c19', 'b5c20'];
for (const chapter of cs) {
  test(`${chapter} plays through hungry and fed, with and without a coven`, async () => {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play(chapter, {}, { ...START, hunger }, [], { sys: circle ? coven : null, stopAt: chapter === 'b5c19' ? 'b5c20' : null });
        clean(run);
        assert.match(run.text, /\S/);
      }
    }
  });
}

async function branches(chapter, sets, flags, stopAt) {
  for (const [flag, list, night, sys] of sets) {
    for (const [value, re] of list) {
      const run = await play(chapter, {}, START, night ? [night, re] : [re], { sys, stopAt, flags });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
}

test('chapter 19 takes each choice and records it', async () => {
  await branches('b5c19', [
    ['b5.trail', [['alone', /Follow it alone/], ['net', /Set the family out in a net/], ['hounds', /hunt beside the hounds/]], /Commercial Street, to the doorway/, coven],
    ['b5.master', [['court', /Take him to the Court yourself/], ['shield', /under the house's protection/], ['notes', /Call the Club's notes/]], /Pall Mall/, coven],
    ['b5.nights', [['surety', /stand surety for the girl/], ['grace', /give nothing for them but your word/], ['none', /Refuse the Court's terms/]], /Go to Mayfair/, coven],
    ['b5.maggie', [['ended', /End it, quickly/], ['ward', /ward of the family/], ['court', /Give her up to the Court/]], null, coven],
  ], { 'b5.chair': 'ours', 'b5.pall': 'allied', 'b5.cass': 'trusted' }, 'b5c20');
});

test('chapter 19 council sends the family, offers ventures and builds the house', async () => {
  const run = await play('b5c19', {}, START, [/Gather the house/, /Send Prisca/, /Send Hanno/, /Keep Fiammetta/, /business lead to hold/, /firm's books/, /telephone/, /cables/, /That is the lot/, /Build up the house/, /vault/, /training hall/, /coven house|second room/, /front business/, /blood network/, /enough building/, /all that the house can settle/], { sys: coven, stopAt: 'b5c20' });
  clean(run);
  assert.match(run.text, /pearl buttons/);
  assert.match(run.text, /Hanno takes a lantern/);
  const poor = await play('b5c19', {}, { ...START, wealth: 0 }, [/Gather the house/, /firm's books/], { stopAt: 'b5c20' });
  assert.doesNotMatch(poor.text, /talking to the machine again/);
});

const CH20 = { 'b5.maggie': 'ward', 'b5.master': 'notes', 'b5.chair': 'ours', 'b5.cass': 'trusted', 'b5.dark': 'sent', 'b5.arm': 'west' };

test('chapter 20 ends the book, sleeps to Chicago, writes the journal and finishes Book Five', async () => {
  const run = await play('b5c20', {}, { ...START, wealth: 900000, ...CH20 }, [], { sys: coven });
  assert.equal(run.frame.wait, 'book_end');
  clean(run);
  const wake = run.game.state.sys.sleep.wake;
  assert.equal(wake.gap, 'london_to_chicago');
  assert.equal(wake.years, 35);
  assert.equal(run.game.state.booksDone.includes('whitechapel-hunt'), true);
  assert.ok(run.game.state.journal.some((e) => e.kind === 'velati' && e.book === 'whitechapel-hunt'), 'the journal entry is written');
  const book = run.game.library().find((b) => b.id === 'whitechapel-hunt');
  assert.ok(!book.incomplete);
  assert.equal(book.chapterCount, 20);
});

test('chapter 20 plays every last night, answer, place, steward, order, guard, charge and letter', async () => {
  const nights = [[/sit with the whole of the house/, 'attic'], [/sit with Lisle/, 'wall'], [/sit in the back room with Cassian/, 'cass'], [/Sit with Maggie Tuck/, 'maggie']];
  for (const [re, value] of nights) {
    const run = await play('b5c20', {}, { ...START, ...CH20 }, [re], { sys: coven });
    assert.equal(run.vars['b5.last_night'], value);
    clean(run);
  }
  const answers = [[/the house is coming/, 'follow'], [/will wait, and watch/, 'hold'], [/Say nothing, and send nothing/, 'silent']];
  for (const [re, value] of answers) {
    const run = await play('b5c20', {}, { ...START, ...CH20 }, [re], { sys: coven });
    assert.equal(run.vars['b5.west'], value);
  }
  for (const [re, value] of [[/Keep the house/, 'keep'], [/Send a hand ahead/, 'west'], [/Scatter/, 'scatter']]) {
    const run = await play('b5c20', {}, { ...START, ...CH20 }, [re], { sys: coven });
    assert.equal(run.vars['b5.charge'], value);
  }
  for (const [re, value] of [[/Write a letter/, 'left'], [/Write nothing/, 'none']]) {
    const run = await play('b5c20', {}, { ...START, ...CH20 }, [re], { sys: coven });
    assert.equal(run.vars['b5.farewell'], value);
  }
  for (const re of [/cellar under the counting house/, /cellar under the great house/, /tomb in the old churchyard/]) {
    const run = await play('b5c20', {}, { ...START, ...CH20 }, [re], { sys: coven });
    assert.equal(run.frame.wait, 'book_end');
  }
  for (const re of [/Play it safe/, /Grow it aggressively/, /Take the dark ventures/]) {
    const run = await play('b5c20', {}, { ...START, wealth: 900000, ...CH20 }, [re], { sys: coven });
    assert.equal(run.frame.wait, 'book_end');
  }
  const lone = await play('b5c20', {}, { ...START, ...CH20, 'b5.circle': 'stay' }, [], { sys: (g) => { g.state.sys.path = 'lone'; } });
  assert.equal(lone.frame.wait, 'book_end');
  clean(lone);
});

test('chapter 20 lets the player sow in as many ventures as they like', async () => {
  const none = await play('b5c20', {}, { ...START, ...CH20 }, [/That will do/, /That will do/], { sys: coven });
  assert.equal(none.game.state.sys.sleep.wake.invest.length, 0);
  const some = await play('b5c20', {}, { ...START, ...CH20 }, [/electric companies/, /Detroit motor company/, /wireless/, /That will do/], { sys: coven });
  assert.equal(some.game.state.sys.sleep.wake.invest.length, 3);
});

test('chapter 20 only names coven members who are in the coven', async () => {
  const run = await play('b5c20', {}, { ...START, ...CH20 }, [/sit with the whole of the house/], { sys: null });
  assert.doesNotMatch(run.text, /Prisca|Fiammetta|Hanno/);
  clean(run);
});
