// Session 53: Book Five, chapters 5 and 6. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

test('chapters 5 and 6 play through, hungry or not, with and without a coven, and only name the coven when it exists', async () => {
  for (const chapter of ['b5c05', 'b5c06']) {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play(chapter, {}, { ...START, hunger }, [], { sys: circle ? coven : null, stopAt: chapter === 'b5c05' ? 'b5c06' : null });
        assert.match(run.text, chapter === 'b5c05' ? /first week of July/ : /middle of August/);
        if (!circle) assert.doesNotMatch(run.text, /Prisca|Fiammetta|Hanno/);
        clean(run);
      }
    }
  }
});

test('chapter 5 takes each choice and records it', async () => {
  const sets = [
    ['b5.quill', [['trusted', /bring his mistress/], ['pressed', /Press him/], ['watched', /think it over/]], /Go to Gower Street/, null],
    ['b5.club', [['allied', /ally with the Club/], ['played', /play the Club against/], ['refused', /not for sale/]], /Go to Pall Mall/, null],
    ['b5.vault', [['vaults', /Build vaults/], ['tunnels', /Dig a way out/]], /Go to the family, the firm/, coven],
    ['b5.errand', [['eight', /Send Fiammetta/], ['square', /Send Prisca/], ['firm', /Send Hanno/]], /Send the family out/, coven],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c05', {}, START, [night, re, /That will do for tonight/, /That is all of it/], { sys, stopAt: 'b5c06' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 5 offers the new ventures, several at once, and none without the money', async () => {
  const rich = await play('b5c05', {}, START, [/Go to the family, the firm/, /Put money into tea/, /underground railways/], { stopAt: 'b5c06' });
  assert.match(rich.text, /humblest money in London/);
  assert.match(rich.text, /A hole with a train in it|hole with a train in it/);
  const poor = await play('b5c05', {}, { ...START, wealth: 0 }, [/Go to the family, the firm/], { stopAt: 'b5c06' });
  assert.doesNotMatch(poor.text, /humblest money/);
  clean(rich);
});

test('chapter 5 gives the coven its report, a rival coven and errands that set standing missions', async () => {
  const run = await play('b5c05', {}, START, [/Send the family out/, /Send Fiammetta/, /Send Prisca/, /Send Hanno/], { sys: coven, stopAt: 'b5c06' });
  assert.match(run.text, /Gaslight Club/);
  assert.match(run.text, /Prisca has found the thing/);
  assert.match(run.text, /Hanno has had a visitor/);
  assert.notEqual(run.vars['b5.errand'], 'none');
  clean(run);
});

test('chapter 6 takes each choice and records it', async () => {
  const sets = [
    ['b5.fitzroy', [['roofs', /look down into the area|over the roofs/], ['watched', /watch it by relays/], ['bought', /buy the house next door/]], /Go to Fitzroy Square/, coven],
    ['b5.audience', [['given', /Tell her all of it/], ['pressed', /there is a man, and that you will bring him/], ['stalled', /not be its dog/]], /Go to the Court/, null],
    ['b5.squeeze', [['paid', /Pay it out/], ['fought', /Fight it in the City/], ['ceded', /Let the wharf lease go/], ['family', /let the house decide/]], /Go to Lime Street/, coven],
    ['b5.eight', [['moved', /Move the eight/], ['guarded', /Keep them where they are/], ['left', /own judgment/]], /Go to Stepney/, coven],
    ['b5.frances', [['promised', /promise her/], ['bargained', /cannot promise/], ['refused', /Refuse the key/]], null, null],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c06', {}, START, night ? [night, re] : [re], { sys, stopAt: null });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 6 ends the book at its pause after the closing scene and the key', async () => {
  const run = await play('b5c06', {}, START, [], {});
  assert.equal(run.frame.wait, 'book_end');
  assert.match(run.text, /Frances Venn/);
  clean(run);
});
