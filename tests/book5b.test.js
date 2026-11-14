// Session 52: Book Five, chapters 3 and 4. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

test('chapters 3 and 4 play through, hungry or not, with and without a coven, and only name the coven when it exists', async () => {
  for (const chapter of ['b5c03', 'b5c04']) {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play(chapter, {}, { ...START, hunger }, [], { sys: circle ? coven : null, stopAt: chapter === 'b5c03' ? 'b5c04' : 'b5c05' });
        assert.match(run.text, chapter === 'b5c03' ? /first week of June/ : /twenty first of June/);
        if (!circle) assert.doesNotMatch(run.text, /Prisca|Fiammetta|Hanno/);
        clean(run);
      }
    }
  }
});

test('chapter 3 takes each choice and records it', async () => {
  const sets = [
    ['b5.mortuary', [['porter', /Pay the porter/], ['surgeon', /Send word to Mr\. Hale/], ['walked', /Go in by yourself/]], /mortuary shed/, null],
    ['b5.crosses', [['warned', /Warn them/], ['court', /Take the plan to the Court/], ['watched', /Keep watch on the eight/]], /plan of the eleven crosses/, coven],
    ['b5.tuesday', [['met', /Say that you are the principal/], ['followed', /clerk follow/], ['missed', /Do not answer/]], /Go to Lime Street/, null],
    ['b5.gray', [['followed', /Follow him/], ['faced', /Step out ahead/], ['let', /Let him go by/]], /gray overcoat/, null],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c03', {}, START, [re, night], { sys, stopAt: 'b5c04' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 3 offers the new ventures, several at once, and none without the money', async () => {
  const rich = await play('b5c03', {}, START, [/Go to Lime Street/, /electric light/, /great shops/], { stopAt: 'b5c04' });
  assert.match(rich.text, /first night that you have ever seen without a shadow/);
  assert.match(rich.text, /front door that is open to everyone/);
  const poor = await play('b5c03', {}, { ...START, wealth: 0 }, [/Go to Lime Street/], { stopAt: 'b5c04' });
  assert.doesNotMatch(poor.text, /dozen shares/);
  clean(rich);
});

test('chapter 3 gives the coven its report and a post at the doors', async () => {
  const run = await play('b5c03', {}, START, [/plan of the eleven crosses/, /Keep watch/], { sys: coven, stopAt: 'b5c04' });
  assert.match(run.text, /Prisca has read the East End/);
  assert.match(run.text, /Fiammetta has walked the doors/);
  assert.match(run.text, /Hanno has the firm/);
  assert.equal(run.game.state.sys.circle.fiammetta.task, 'guard');
  clean(run);
});

test('chapter 4 takes each choice and records it', async () => {
  const sets = [
    ['b5.price', [['agreed', /bring him, if he can be found/], ['refused', /do not do the Court/], ['bargained', /Cassian comes first/]], /Go to the Court/, null],
    ['b5.feast', [['hosted', /Pay for the feast/], ['joined', /Take your place/], ['watched', /Stand at the edge/]], /Go to Stepney/, null],
    ['b5.physician', [['gave', /Give it freely/], ['refused', /Refuse, and say/], ['family', /Send for a member/]], /dispensary in Commercial Road/, coven],
    ['b5.doors', [['stopped', /take him by the arm/], ['followed', /let him go up/], ['left', /^$/]], /Watch the eight doors/, null],
    ['b5.cassian', [['seek', /find him tonight/], ['trade', /name a time/], ['wait', /take no step/]], null, null],
  ];
  for (const [flag, branches, night, sys] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b5c04', {}, START, night ? [re, night] : [re], { sys, stopAt: null });
      if (value !== 'left') assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 4 offers the landladies and builds them, and the family sits at the table', async () => {
  const run = await play('b5c04', {}, START, [/Go to Stepney/, /Take your place/, /Ask her to build it/], { sys: coven });
  assert.match(run.text, /paper hat on Hanno/);
  assert.match(run.text, /network of teapots/);
  clean(run);
});

test('chapter 4 ends the book at its pause after the closing letter', async () => {
  const run = await play('b5c04', {}, START, [], {});
  assert.equal(run.frame.wait, 'book_end');
  assert.match(run.text, /Quill/);
  clean(run);
});
