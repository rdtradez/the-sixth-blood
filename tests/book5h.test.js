// Session 58: Book Five, chapters 15 and 16. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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



const cs = ['b5c15', 'b5c16'];
for (const chapter of cs) {
  test(`${chapter} plays through hungry and fed, with and without a coven`, async () => {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play(chapter, {}, { ...START, hunger }, [], { sys: circle ? coven : null, stopAt: chapter === 'b5c15' ? 'b5c16' : null });
        clean(run);
        assert.match(run.text, /\S/);
        if (chapter === 'b5c16') assert.equal(run.frame.wait, 'book_end');
      }
    }
  });
}

test('chapter 15 takes each choice and records it', async () => {
  const sets = [
    ['b5.cass', [['trusted', /Tell him everything/], ['written', /write down every word/], ['free', /Let him go where he likes/]], /leads, where Cassian/, null],
    ['b5.nell', [['keeper', /place in the house, as a keeper/], ['shop', /shop in Bethnal Green/], ['truth', /tell her the truth/]], /Cable Street/, null],
    ['b5.dark', [['sent', /Send one of the family/], ['warned', /Write to the Court/], ['kept', /Sit still, and watch/]], null, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c15', {}, START, night ? [night, re] : [re, /all that can be done/], { sys, stopAt: 'b5c16', flags: { 'b5.ward': 'left' } });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 15 lets him copy the map for the family and the Court, and build and invest at the firm', async () => {
  const map = await play('b5c15', {}, START, [/attic, where Lisle/, /copy it/, /Send a copy to the Court/, /enough for tonight/], { sys: coven, stopAt: 'b5c16' });
  assert.equal(map.vars['b5.map'], 'both');
  clean(map);
  const firm = await play('b5c15', {}, START, [/books and see to the firm/, /insurance/, /electric light/, /underground railways/, /Build out the house/, /vault/, /escape tunnel/, /training hall/, /front business/, /blood network/, /enough building/, /business lead to work/, /That is the lot/], { sys: coven, stopAt: 'b5c16' });
  clean(firm);
});

test('chapter 16 takes each choice and records it', async () => {
  const sets = [
    ['b5.sitting', [['told', /Tell the Court the whole/], ['half', /Tell it half/], ['silent', /on the day that the Court sits/]], /Mayfair/, null],
    ['b5.pall', [['allied', /Take the Club's hand/], ['truce', /plain and written one/], ['broke', /Call in the Club's notes/]], /master of the Gaslight Club/, coven],
    ['b5.lessons', [['together', /Sit with him, the whole hour/], ['court', /scholar of the Court/], ['guarded', /stand the stair/]], /wall, where Lisle/, coven],
    ['b5.client', [['signed', /Take the pen/], ['refused', /Refuse it/], ['followed', /follow him/]], null, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c16', {}, START, night ? [night, re] : [re], { sys, flags: { 'b5.dark': 'sent', 'b5.seat': 'seat', 'b5.vane': 'pleaded' } });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 16 council can send the family out and build the house', async () => {
  const run = await play('b5c16', {}, START, [/long table/, /Send Prisca west/, /Send Hanno to sit/, /Keep Fiammetta/, /business lead to guard/, /Build the house up/, /training hall/, /vault/, /escape tunnel/, /blood network/, /front business/, /second room/, /enough building/, /all that the house can settle/], { sys: coven });
  assert.equal(run.vars['b5.arm'], 'west');
  clean(run);
});
