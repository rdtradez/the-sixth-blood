// Session 54: Book Five, chapters 7 and 8. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

for (const chapter of ['b5c07', 'b5c08']) {
  test(`${chapter} plays through hungry and fed, with and without a coven`, async () => {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play(chapter, {}, { ...START, hunger }, [], { sys: circle ? coven : null, stopAt: chapter === 'b5c07' ? 'b5c08' : null });
        clean(run);
        assert.match(run.text, /\S/);
      }
    }
  });
}

test('chapter 7 takes each choice and records it', async () => {
  const sets = [
    ['b5.hesketh', [['welcomed', /give him tea/], ['warned', /no tea/], ['shut', /must wait/]], /Pall Mall/, coven],
    ['b5.build', [['house', /break the wall/], ['safe', /Southwark/], ['hall', /hall in the warehouse/]], /Go to the house/, coven],
    ['b5.list', [['names', /Read the list/], ['house', /walk the house/], ['guest', /come to dinner yourself/]], /Gower Street/, null],
    ['b5.plan', [['guest', /come to dinner yourself/], ['family', /Bring the family/], ['cellar', /own way/]], /Gower Street/, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c07', {}, START, [night, re], { sys, stopAt: 'b5c08' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 7 lets the family build and invest in several things if the wealth is there', async () => {
  const rich = await play('b5c07', {}, START, [/Go to the house/, /break the wall/, /Southwark/, /hall in the warehouse/, /Go to Lime Street/, /shipping/, /insurance/], { sys: coven, stopAt: 'b5c08' });
  clean(rich);
});

test('chapter 8 takes each choice and records it', async () => {
  const sets = [
    ['b5.dispensary', [['asked', /name of the gentleman/], ['watched', /let the queue speak/]], /Cable Street/, null],
    ['b5.ashe', [['helped', /Give him a little/], ['warned', /whose hand/], ['left', /not trust him/]], /Commercial Road/, null],
    ['b5.cellar', [['walked', /Walk it/], ['family', /Call the family/], ['carried', /carry him out/]], null, coven],
    ['b5.chairman', [['faced', /between him and Frances/], ['named', /who has lit his lamp/]], null, coven],
    ['b5.venn', [['spared', /Let her speak/], ['shamed', /dispensaries are shut/], ['taken', /come with you/]], null, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c08', {}, START, night ? [night, re] : [re], { sys, stopAt: null });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 8 reaches each way into the house and ends at its pause', async () => {
  for (const [plan, way] of [['guest', 'key'], ['family', 'force'], ['cellar', 'key']]) {
    const run = await play('b5c08', {}, START, [], { sys: coven, flags: { 'b5.plan': plan, 'b5.frances': 'promised' } });
    assert.equal(run.vars['b5.way'], way, plan);
    assert.equal(run.frame.wait, 'book_end');
    assert.match(run.text, /ninth chair/i);
    clean(run);
  }
  const silver = await play('b5c08', {}, START, [], { flags: { 'b5.plan': 'cellar', 'b5.frances': 'refused' } });
  assert.equal(silver.vars['b5.way'], 'silver');
});
