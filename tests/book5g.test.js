// Session 57: Book Five, chapters 13 and 14. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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



const cs = ['b5c13', 'b5c14'];
for (const chapter of cs) {
  test(`${chapter} plays through hungry and fed, with and without a coven`, async () => {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play(chapter, {}, { ...START, hunger }, [], { sys: circle ? coven : null, stopAt: chapter === 'b5c13' ? 'b5c14' : null });
        clean(run);
        assert.match(run.text, /\S/);
        if (chapter === 'b5c14') assert.equal(run.frame.wait, 'book_end');
      }
    }
  });
}

test('chapter 13 plays every waking, including the lid that fails', async () => {
  for (const [waking, lid, re] of [['gave', 'gave', null], ['family', 'gave', null], ['sealed', 'gave', /late and ashamed/], ['sealed', 'family', /Send for the family/], ['sealed', 'chairman', /Let the Chairman come/]]) {
    const run = await play('b5c13', {}, START, re ? [re] : [], { sys: coven, stopAt: 'b5c14', flags: { 'b5.waking': waking } });
    assert.equal(run.vars['b5.lid'], lid, `${waking} ${lid}`);
    clean(run);
  }
  const text = (await play('b5c13', {}, START, [], { sys: coven, stopAt: 'b5c14', flags: { 'b5.waking': 'gave' } })).text;
  assert.doesNotMatch(text, /silver gives/);
});

test('chapter 13 takes each choice and records it', async () => {
  const sets = [
    ['b5.lisle', [['guest', /guest of the house/], ['court', /house of his own/], ['hidden', /Keep him upstairs/]], /back bedroom/, null],
    ['b5.meeting', [['alone', /meet, alone/], ['between', /sit between/], ['apart', /will not meet/]], /attic/, null],
    ['b5.vane', [['pleaded', /Speak for him/], ['judged', /Sit in judgment/], ['silent', /Stay out of it/]], /Mayfair/, null],
    ['b5.first', [['agreed', /go with him/], ['scouted', /go first/], ['waited', /not to go until/]], null, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c13', {}, START, night ? [night, re] : [re], { sys, stopAt: 'b5c14' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 13 lets him build and invest in several things at the firm', async () => {
  const run = await play('b5c13', {}, START, [/books, and see to the firm/, /second room for the family/, /hidden chamber/, /safehouses/, /informants/, /enough building/, /shipping/, /railways/, /medical/, /great shops/, /tea/, /business lead to work/, /That is the lot/], { sys: coven, stopAt: 'b5c14' });
  clean(run);
});

test('chapter 14 takes each choice and records it', async () => {
  const sets = [
    ['b5.ward', [['healed', /old blood, and see/], ['transfused', /glass syringe/], ['left', /Sit with her/]], /Cable Street/, null],
    ['b5.seat', [['seat', /Go to the Court with them/], ['charter', /charter under the firm/], ['nothing', /debt is paid/]], /young houses, who have come/, coven],
    ['b5.report', [['letter', /Write your own letter/], ['seen', /what they saw, and no more/], ['hushed', /gentle/]], /green door/, null],
    ['b5.wall', [['looked', /Walk the street/], ['bought', /Buy the brewery/], ['sent', /Send the family over/]], /Bishopsgate/, coven],
    ['b5.peg', [['took', /Draw the cracked peg/], ['sealed', /set its silver/], ['left', /Let Lisle stay/]], null, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c14', {}, START, night ? [night, re] : [re], { sys, flags: { 'b5.first': 'waited', 'b5.vane': 'pleaded', 'b5.stair': 'court' } });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 14 gives Fiammetta her house and lets him keep the cedar peg', async () => {
  const run = await play('b5c14', {}, START, [/young houses, who have come/, /charter under the firm/, /Give her the charter/, /Draw the cracked peg/], { sys: coven });
  assert.equal(run.vars['b5.seat'], 'charter');
  assert.equal(run.vars['b5.peg'], 'took');
  assert.ok(run.game.state.sys.items.cedar_peg);
  clean(run);
});

test('chapter 14 lets him give the Dark Gift to the last bled woman', async () => {
  const run = await play('b5c14', {}, START, [/Cable Street/, /offer her the Dark Gift/], {});
  assert.equal(run.vars['b5.ward'], 'sired');
  assert.ok(run.game.state.sys.circle.nell, 'Nell joins the circle');
  assert.equal(run.game.state.sys.circle.nell.sire, 'hero');
  clean(run);
});
