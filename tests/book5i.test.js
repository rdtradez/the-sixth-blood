// Session 59: Book Five, chapters 17 and 18. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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



const cs = ['b5c17', 'b5c18'];
for (const chapter of cs) {
  test(`${chapter} plays through hungry and fed, with and without a coven`, async () => {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play(chapter, {}, { ...START, hunger }, [], { sys: circle ? coven : null, stopAt: chapter === 'b5c17' ? 'b5c18' : null });
        clean(run);
        assert.match(run.text, /\S/);
        if (chapter === 'b5c18') assert.equal(run.frame.wait, 'book_end');
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

test('chapter 17 takes each choice and records it', async () => {
  await branches('b5c17', [
    ['b5.square', [['aid', /among the wounded/], ['roofs', /Take the roofs/], ['bought', /Inspector Lamb a very good reason/]], /Trafalgar Square/, coven],
    ['b5.chair', [['surety', /Stand surety/], ['alone', /Refuse the surety/], ['ours', /Fiammetta's charter/]], /Go to Mayfair/, coven],
    ['b5.watcher', [['turned', /Make him an offer/], ['court', /Hand him to the Court/], ['letter', /carry it to the post/]], /Club's cellar/, coven],
    ['b5.letter', [['read', /read it aloud/], ['burned', /Burn it, unread/], ['lisle', /Carry it down to Lisle/]], null, coven],
  ], { 'b5.seat': 'seat', 'b5.client': 'signed', 'b5.arm': 'west', 'b5.cass': 'trusted' }, 'b5c18');
});

test('chapter 17 offers ventures several at once, builds the house and sets the lead', async () => {
  const run = await play('b5c17', {}, START, [/firm's books/, /telephone/, /cables/, /great shops/, /Build out the house/, /vault/, /escape tunnel/, /training hall/, /front business/, /blood network/, /second room/, /enough building/, /business lead to work/, /That is the lot/], { sys: coven, stopAt: 'b5c18' });
  clean(run);
  assert.match(run.text, /to buy a voice/);
  assert.match(run.text, /so easy to be wrong/);
  const poor = await play('b5c17', {}, { ...START, wealth: 0 }, [/firm's books/], { stopAt: 'b5c18' });
  assert.doesNotMatch(poor.text, /to buy a voice/);
});

test('chapter 18 takes each choice and records it', async () => {
  await branches('b5c18', [
    ['b5.trap', [['trap', /Set the family in the walls/], ['table', /Lay the long table/], ['bare', /Empty the house/]], /Lime Street, and make ready/, coven],
    ['b5.witness', [['court', /Take the Court's three/], ['silver', /Court's silver instead/], ['young', /Bring the young houses/]], /Go to Mayfair/, coven],
    ['b5.reading', [['told', /ask him everything/], ['one', /one thing only/], ['scholar', /Court's scholar in the cellar/]], /ask Lisle/, coven],
    ['b5.terms', [['burned', /Burn the card/], ['court', /Lay it on the Court's table/], ['terms', /condition of your own/]], null, coven],
  ], { 'b5.chair': 'ours', 'b5.sitting': 'told', 'b5.letter': 'read', 'b5.client': 'followed' }, null);
});

test('chapter 18 council sends the family, offers ventures and builds the house', async () => {
  const run = await play('b5c18', {}, START, [/long table/, /Set Prisca/, /Send Hanno/, /Keep Fiammetta/, /business lead to hold/, /firm's books/, /telephone/, /cables/, /electric light/, /insurance/, /That is the lot/, /Build up the house/, /vault/, /escape tunnel/, /training hall/, /front business/, /blood network/, /second room/, /enough building/, /all that the house can settle/], { sys: coven });
  clean(run);
});
