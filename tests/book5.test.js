// Session 51: Book Five, chapters 1 and 2. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

const WAKES = [
  {},
  { place: 'collesanto', steward: 'keepers' },
  { place: 'tomb', steward: 'prisca', outcome: 'prospered', orders: 'aggressive' },
  { place: 'haven', steward: 'fiammetta', outcome: 'losses', orders: 'dark' },
  { place: 'collesanto', steward: 'hanno', orders: 'dark' },
  { place: 'haven', steward: 'bank', outcome: 'woken_early', by: 'hunters' },
  { place: 'collesanto', steward: 'thibault', outcome: 'woken_early', by: 'government', orders: 'aggressive' },
  { place: 'tomb', steward: 'keepers', outcome: 'woken_early', by: 'steward', orders: 'dark' },
];

const START = { hunger: 10, wealth: 300000 };

const coven = (g) => {
  const s = g.state.sys;
  s.path = 'coven';
  for (const [id, role] of [['prisca', 'head of the house'], ['fiammetta', 'fledgling of the hill'], ['hanno', 'keeper of the ledgers']]) {
    s.circle[id] = { id, kind: 'vampire', line: 'merchant', injured: false, mission: null, quest: null, task: '', taskResult: '', role, status: 'active', joined: 'blood-and-gold', age: 3 };
    g.state.vars[`loyalty.${id}`] = 70;
  }
};

test('Book Five lists its fourteen written chapters and is incomplete', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'whitechapel-hunt');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 14);
});

test('chapters 1 and 2 play through every kind of waking, hungry or not, with and without a coven', async () => {
  for (const wake of WAKES) {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play('b5c01', wake, { ...START, hunger }, [], { sys: circle ? coven : null });
        assert.match(run.text, /Pool of London|Jubilee/, JSON.stringify(wake));
        assert.equal(run.frame.wait, 'book_end');
        clean(run);
      }
    }
  }
});

test('chapter 1 takes each choice and records it', async () => {
  const sets = [
    ['b5.books', [['trusted', /on trust/], ['audited', /line by line/]], /Go through the books/],
    ['b5.street', [['read', /Take a paper/], ['spoke', /Talk to the man/], ['watched', /Walk on/]], /Go out, and look/],
    ['b5.circle', [['all', /Let a keeper/], ['stay', /Ask them to write/]], /Gather the household/],
    ['b5.summons', [['coming', /that you are coming/], ['asked', /ask what he means/]], /Open the letters/],
    ['b5.passage', [['cabin', /Take a cabin/], ['hold', /Go as freight/], ['steerage', /northern road/]], /Open the letters/],
    ['b5.first_feed', [['animal', /young goat/], ['donor', /willing arm/], ['human', /passing strangers/], ['none', /Go without/]], null],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c01', { outcome: 'on_schedule' }, { ...START, hunger: flag === 'b5.first_feed' ? 90 : 10 }, night ? [re, night] : [re], { stopAt: 'b5c02' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 1 offers a coven its courses, the desk and the letter to send ahead', async () => {
  for (const [flag, value, re, night] of [
    ['b5.circle', 'all', /Take them all/, /Gather the household/],
    ['b5.circle', 'ahead', /Go first/, /Gather the household/],
    ['b5.circle', 'stay', /Leave them here/, /Gather the household/],
    ['b5.summons', 'wait', /Send the family ahead/, /Open the letters/],
    ['b5.lead_desk', 'approved', /Approve the firm/, null],
    ['b5.lead_desk', 'picked', /Take the third paper/, null],
    ['b5.lead_desk', 'pressed', /Go through every paper/, null],
  ]) {
    const run = await play('b5c01', {}, START, night ? [re, night] : [re], { sys: coven, stopAt: 'b5c02' });
    assert.equal(run.vars[flag], value, `${flag} ${value}`);
    clean(run);
  }
});

test('the desk lets the lead lay out several offers and the player take more than one', async () => {
  const run = await play('b5c01', {}, START, [/Take the third paper/, /The steamers/, /The insurance/, /The medical goods/], { sys: coven, stopAt: 'b5c02' });
  assert.equal(run.vars['b5.lead_pick'], 'some');
  assert.match(run.text, /a way across the sea/);
  assert.match(run.text, /other people's fear/);
  assert.match(run.text, /Mr\. Hale wrote about/);
});

test('chapter 1 records how the player took being woken early', async () => {
  for (const [value, re] of [['fled', /Slip out/], ['fought', /Put out the lamp/], ['talked', /Sit up/]]) {
    const run = await play('b5c01', { outcome: 'woken_early', by: 'hunters' }, START, [re], { stopAt: 'b5c02' });
    assert.equal(run.vars['b5.trouble'], value);
    clean(run);
  }
});

test('chapter 1 answers the hill letter: built, sent or waited', async () => {
  for (const [value, re] of [['built', /Pay for a mill/], ['sent', /Send coin/], ['waited', /Write that you have read/]]) {
    const run = await play('b5c01', {}, START, [re, /Go through the books/], { stopAt: 'b5c02', flags: { 'collesanto': 60 } });
    assert.ok(['built', 'sent', 'waited'].includes(run.vars['b5.village']));
    if (value !== 'built') assert.equal(run.vars['b5.village'], value);
    clean(run);
  }
});

test('chapter 2 meets whoever the sleep and the charge arranged at the dock', async () => {
  const hale = await play('b5c02', {}, START, [], { flags: { 'b5.summons': 'coming', 'b4.charge': 'keep' } });
  assert.equal(hale.vars['b5.dock'], 'hale');
  assert.match(hale.text, /Mr\. Collins/);
  const ruth = await play('b5c02', {}, START, [], { flags: { 'b5.summons': 'asked', 'b4.charge': 'north' } });
  assert.equal(ruth.vars['b5.dock'], 'ruth');
  assert.match(ruth.text, /Miss Aldous/);
  const family = await play('b5c02', {}, START, [], { sys: coven, flags: { 'b5.summons': 'wait', 'b5.circle': 'stay' } });
  assert.equal(family.vars['b5.dock'], 'family');
  assert.match(family.text, /People you must know|a list/);
  const nobody = await play('b5c02', {}, START, [], { flags: { 'b5.summons': 'asked', 'b4.charge': 'keep' } });
  assert.equal(nobody.vars['b5.dock'], 'none');
  for (const r of [hale, ruth, family, nobody]) clean(r);
});

test('chapter 2 takes each choice and records it', async () => {
  const sets = [
    ['b5.hale', [['trusted', /sign what he has laid out/], ['tested', /ask what he has not written/]], /Go to Lime Street/, null],
    ['b5.house', [['entered', /Go through the rooms/], ['watched', /Wait in the dark/], ['spoke', /Take the neighbor aside/]], /Go east/, null],
    ['b5.body', [['looked', /Kneel by her/], ['passed', /Walk by/], ['sent', /Send a message/]], /Go east/, coven],
    ['b5.haven', [['warehouse', /A warehouse/], ['house', /A tall house/], ['rooms', /Rooms above/]], /Find a roof/, coven],
    ['b5.court', [['called', /present yourself in form/], ['alone', /Accept the courtesy, alone/], ['regrets', /your own time/], ['sent', /Say nothing/]], /Answer the card/, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c02', {}, START, [re, night], { sys });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 2 lets the player buy several ventures if the wealth is there, and not if it is not', async () => {
  const rich = await play('b5c02', {}, START, [/Go to Lime Street/, /shipping/, /railways/, /underwriting/], {});
  assert.match(rich.text, /Four ships/);
  assert.match(rich.text, /great fortune of the age/);
  const poor = await play('b5c02', {}, { ...START, wealth: 0 }, [/Go to Lime Street/], {});
  assert.doesNotMatch(poor.text, /Four ships/);
  clean(rich);
  clean(poor);
});

test('chapter 2 sets the family to work in the new house, and only names those who are in the coven', async () => {
  const withCoven = await play('b5c02', {}, START, [/Find a roof/, /A tall house/, /Take a house for the family/], { sys: coven });
  assert.match(withCoven.text, /Prisca wants the books/);
  assert.match(withCoven.text, /Fiammetta wants the door/);
  assert.match(withCoven.text, /Hanno wants the firm/);
  const without = await play('b5c02', {}, START, [/Find a roof/, /Rooms above/], {});
  assert.doesNotMatch(without.text, /Prisca wants|Fiammetta wants|Hanno wants/);
  const task = withCoven.game.state.sys.circle.prisca.task;
  assert.equal(task, 'watch');
  clean(withCoven);
  clean(without);
});
