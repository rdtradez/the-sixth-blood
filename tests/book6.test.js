// Session 62: Book Six, chapters 1 and 2. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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
  { place: 'tomb', steward: 'prisca', outcome: 'prospered', orders: 'aggressive', invest: ['munitions', 'motor_company', 'wireless'] },
  { place: 'haven', steward: 'fiammetta', outcome: 'losses', orders: 'dark' },
  { place: 'collesanto', steward: 'hanno', orders: 'dark', invest: ['electric_light'] },
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

test('Book Six lists chapters one and two and is still incomplete', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'relics-lost-god');
  assert.ok(book.incomplete);
  assert.equal(book.chapterCount, 2);
});

test('chapters 1 and 2 play through every kind of waking, hungry or not, with and without a coven', async () => {
  for (const wake of WAKES) {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play('b6c01', wake, { ...START, hunger }, [], { sys: circle ? coven : null });
        assert.match(run.text, /LaSalle Street|Chicago/, JSON.stringify(wake));
        assert.equal(run.frame.wait, 'book_end');
        clean(run);
      }
    }
  }
});

test('chapter 1 takes each choice and records it', async () => {
  const sets = [
    ['b6.books', [['trusted', /on trust/], ['audited', /line by line/]], /Go through the books/],
    ['b6.street', [['read', /Take a paper/], ['spoke', /Talk to the man/], ['watched', /Walk on/]], /Go out, and look/],
    ['b6.crane', [['warm', /glad of the half/], ['cool', /inspect the half/], ['silent', /no answer/]], /Open the letters/],
    ['b6.passage', [['liner', /Take a cabin/], ['hold', /Go as freight/], ['steerage', /third class/]], /Open the letters/],
    ['b6.first_feed', [['animal', /young goat/], ['donor', /willing arm/], ['human', /passing strangers/], ['none', /Go without/]], null],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c01', { outcome: 'on_schedule' }, { ...START, hunger: flag === 'b6.first_feed' ? 90 : 10 }, night ? [re, night] : [re], { stopAt: 'b6c02' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 1 offers a coven its courses and the desk, and the London firm allows several answers', async () => {
  for (const [flag, value, re, night] of [
    ['b6.circle', 'all', /Take them all/, /Gather the household/],
    ['b6.circle', 'ahead', /Go first/, /Gather the household/],
    ['b6.circle', 'stay', /Leave them here/, /Gather the household/],
    ['b6.lead_desk', 'approved', /Approve the Exchange/, null],
    ['b6.lead_desk', 'pressed', /Go through every paper/, null],
    ['b6.lead_desk', 'thanked', /best house you have ever owned/, null],
  ]) {
    const run = await play('b6c01', {}, START, night ? [re, night] : [re], { sys: coven, stopAt: 'b6c02' });
    assert.equal(run.vars[flag], value, `${flag} ${value}`);
    clean(run);
  }
  const some = await play('b6c01', {}, START, [/Keep the Hales/, /Settle a pension/, /Move the firm's reserve/], { sys: coven, stopAt: 'b6c02' });
  assert.equal(some.vars['b6.london'], 'west');
  const pension = await play('b6c01', {}, START, [/Keep the Hales/, /Settle a pension/, /That will do/], { sys: coven, stopAt: 'b6c02' });
  assert.equal(pension.vars['b6.london'], 'pension');
});

test('chapter 1 gives the village letter a real choice', async () => {
  for (const [value, re] of [['built', /paved road/], ['sent', /Send coin to the hill/], ['waited', /you will think of it/]]) {
    const run = await play('b6c01', {}, START, [/Go through the books/, re], { sys: coven, stopAt: 'b6c02' });
    assert.equal(run.vars['b6.village'], value, value);
  }
});

test('chapter 2 takes each choice and records it', async () => {
  const sets = [
    ['b6.cab', [['bluff', /as if you had done it/], ['ask', /how it works/], ['gold', /Pay him in advance/]], null],
    ['b6.exchange', [['kept', /Say that he was/], ['pressed', /Go through every ledger/]], /LaSalle Street, and the Exchange/],
    ['b6.walk', [['bronzeville', /elevated train south/], ['pilsen', /go west, to Pilsen/i], ['yards', /Go to the Yards/]], /Walk the city/],
    ['b6.haven', [['brownstone', /brownstone/], ['tower', /floor of vaults/], ['keepers', /keeper house/]], /Find a roof/],
    ['b6.call', [['form', /Present yourself in form/], ['alone', /Go alone/], ['regrets', /Send regrets/]], /Answer the card/],
    ['b6.coin', [['kept', /Keep it/], ['melted', /melted down/], ['shown', /Show it to the family/]], null],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c02', {}, START, night ? [re, night] : [re], { sys: flag === 'b6.call' ? null : coven, stopAt: 'b6c03' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 2 lets the family stand in the room, and the ventures loop takes several', async () => {
  const fam = await play('b6c02', {}, START, [/Answer the card/, /Bring the family/], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c03' });
  assert.equal(fam.vars['b6.call'], 'family');
  const run = await play('b6c02', {}, { hunger: 10, wealth: 900000 }, [/Go to LaSalle Street/, /Real estate/, /The wireless/, /Motorcars/, /Community investment in Bronzeville/, /That will do/], { sys: coven, stopAt: 'b6c03' });
  const owned = run.game.state.sys.ventures;
  for (const id of ['chicago.realestate', 'chicago.radio', 'chicago.motorcars', 'chicago.bronzeville']) assert.ok(owned[id], id);
  clean(run);
});

test('no scene names a coven member who is not in the circle', async () => {
  for (const circle of [0, 1]) {
    const run = await play('b6c02', {}, START, [], { sys: circle ? coven : null, flags: { 'b6.circle': circle ? 'all' : 'stay' } });
    if (!circle) assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno/);
  }
});
