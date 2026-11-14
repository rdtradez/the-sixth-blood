// Session 56: Book Five, chapters 11 and 12. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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


for (const chapter of ['b5c11', 'b5c12']) {
  test(`${chapter} plays through hungry and fed, with and without a coven`, async () => {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play(chapter, {}, { ...START, hunger }, [], { sys: circle ? coven : null, stopAt: chapter === 'b5c11' ? 'b5c12' : null });
        clean(run);
        assert.match(run.text, /\S/);
        if (chapter === 'b5c12') assert.equal(run.frame.wait, 'book_end');
      }
    }
  });
}

test('chapter 11 takes each choice and records it', async () => {
  const sets = [
    ['b5.hand', [['shielded', /left to the family's care/], ['exposed', /stand witness/], ['quiet', /own house/]], /Go to Mayfair/, null],
    ['b5.mabbott', [['allied', /stand with you/], ['warned', /had better wait/], ['against', /keep out of Spitalfields/]], /green door/, null],
    ['b5.vigil', [['all', /go down with you, all of it/], ['few', /a few will go down/], ['alone', /go down alone/]], null, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c11', {}, START, night ? [night, re] : [re], { sys, stopAt: 'b5c12' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 11 lets him muster several houses and build and invest in several things', async () => {
  const many = await play('b5c11', {}, START, [/Go to the young houses/, /Ropewalk/, /Nine Elms/, /Pall Mall/, /That will do/], { sys: coven, stopAt: 'b5c12', flags: { 'b5.club': 'allied' } });
  assert.equal(many.vars['b5.muster'], 'all');
  clean(many);
  const house = await play('b5c11', {}, START, [/Stay at the house/, /hall in the warehouse/, /front business/, /blood network/, /electric light/, /Underground/, /insurance/, /Send one of the family/], { sys: coven, stopAt: 'b5c12' });
  clean(house);
});

test('chapter 12 takes each choice and records it', async () => {
  const sets = [
    ['b5.stair', [['court', /Give her the door/], ['held', /keep the stair/], ['opened', /Turn her away/]], /north door/, coven],
    ['b5.roofs', [['allies', /Walk the ring/], ['alone', /Take the high leads/], ['club', /Give the roofs to Lord Hesketh/]], /Go up on the roofs/, null],
    ['b5.order', [['stood', /Stand in front/], ['parleyed', /come and see for himself/], ['fought', /take the lane/]], /south door/, coven],
    ['b5.sat', [['sat', /Sit with him/], ['spoke', /Speak to him/], ['left', /Do not stay/]], /sit with the sleeper/, null],
    ['b5.waking', [['gave', /Open your own wrist/], ['family', /give beside you/], ['sealed', /Refuse the cup/]], null, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c12', {}, START, night ? [night, re] : [re], { sys, stopAt: null, flags: { 'b5.club': 'allied' } });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});
