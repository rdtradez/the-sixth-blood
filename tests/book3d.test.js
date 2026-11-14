// Session 32: Book Three, chapters 7 and 8. Played down their branches. (This file says what is guaranteed, not what happens.)

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
      let at = Math.max(0, frame.choices.findIndex((c) => /^(That is the whole of it|That is the nine boats settled)/.test(c.text)));
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

async function play(chapter, wake, vars, wants = [], { stopAt = null, seed = 3 } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'collesanto', steward: 'bank', outcome: 'on_schedule', years: 310, invest: [], ...wake };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt);
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
};

const START = { hunger: 10, wealth: 40000 };

const ch7 = (hub, branch) => [branch, hub];

test('chapter 7 plays through for every state of the book so far, and reaches chapter 8', async () => {
  for (const cadets of ['sworn', 'heard', 'refused']) {
    for (const weapon of ['accepted', 'refused']) {
      for (const hunger of [10, 90]) {
        for (const veil of ['covered', 'silenced', 'left']) {
          const run = await play('b3c07', {}, { ...START, hunger, 'b3.cadets': cadets, 'b3.weapon': weapon, 'b3.veil': veil, 'b3.council': 'cadets', 'b3.aubry': 'drilled' }, [], { stopAt: 'b3c08' });
          assert.equal(run.game.state.chapter, 'b3c08', `${cadets} ${weapon} ${hunger} ${veil}`);
          assert.match(run.text, /key/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 7 takes each choice at the wall, the files, the court and the shop', async () => {
  for (const [key, re] of [['joined', /Go into the fire/], ['kept', /keep the peace between/], ['watched', /Stay on the roadside/]]) {
    for (const aubry of ['drilled', 'left']) {
      const run = await play('b3c07', {}, { ...START, 'b3.aubry': aubry }, ch7(/Barrière du Trône/, re), { stopAt: 'b3c08' });
      assert.equal(run.vars['b3.barrier'], key, `${key} ${aubry}`);
      clean(run);
    }
  }
  for (const [key, re] of [['burned', /put it into the stove/], ['kept', /Take it from him, and keep it/], ['left', /Let him do as he likes/]]) {
    const run = await play('b3c07', {}, START, ch7(/rue de Jérusalem, where/, re), { stopAt: 'b3c08' });
    assert.equal(run.vars['b3.file'], key);
    clean(run);
  }
  for (const [key, re] of [['warned', /Tell the Cadets/], ['between', /stand in the way of the watch/], ['brezac', /Ride with the watch/]]) {
    for (const council of ['cadets', 'court', 'silent']) {
      const run = await play('b3c07', {}, { ...START, 'b3.council': council, 'b3.veil': 'silenced' }, ch7(/Answer the silence/, re), { stopAt: 'b3c08' });
      assert.equal(run.vars['b3.night'], key, `${key} ${council}`);
      clean(run);
    }
  }
  for (const press of ['quiet', 'licensed', 'underground']) {
    for (const [key, re] of [['named', /house's name at the foot/], ['unnamed', /with no imprint/], ['refused', /will not print it/]]) {
      const run = await play('b3c07', {}, { ...START, 'b3.press': press }, ch7(/Baptiste is setting type/, re), { stopAt: 'b3c08' });
      assert.equal(run.vars['b3.broadsheet'], key, `${press} ${key}`);
      clean(run);
    }
  }
});

test('chapter 7 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c07', {}, START, [], { stopAt: 'b3c08' });
  for (const k of ['b3.barrier', 'b3.file', 'b3.night', 'b3.broadsheet']) assert.ok(run.vars[k] !== undefined, k);
  const done = ['b3.barrier', 'b3.file', 'b3.night', 'b3.broadsheet'].filter((k) => ({ 'b3.barrier': 'watched', 'b3.file': 'left', 'b3.night': 'between', 'b3.broadsheet': 'refused' })[k] !== run.vars[k]);
  assert.ok(done.length <= 3);
  clean(run);
});

test('chapter 8 plays through for every state of the book so far', async () => {
  for (const grain of ['hoarded', 'relieved', 'exposed', 'ignored']) {
    for (const cadets of ['sworn', 'refused']) {
      for (const hunger of [10, 90]) {
        for (const veil of ['covered', 'silenced', 'left']) {
          const run = await play('b3c08', {}, { ...START, hunger, 'b3.grain': grain, 'b3.cadets': cadets, 'b3.veil': veil, 'b3.galerius': 'senate', 'b3.file': 'kept', 'b3.aubry': 'drilled' }, []);
          clean(run);
          assert.match(run.text, /fifth of August/, `${grain} ${cadets} ${hunger} ${veil}`);
        }
      }
    }
  }
  for (const g of ['senate', 'own', 'court']) {
    const run = await play('b3c08', {}, { ...START, 'b3.galerius': g }, [/Climb the stair/]);
    clean(run);
  }
});

test('chapter 8 takes each choice at the granary, the square, the Lictor and the muskets', async () => {
  for (const grain of ['hoarded', 'relieved', 'exposed', 'ignored']) {
    for (const [key, re] of [['opened', /Open the doors/], ['defended', /Stand in the door/], ['burned', /Let it burn/]]) {
      const run = await play('b3c08', {}, { ...START, 'b3.grain': grain, 'b3.aubry': 'drilled' }, [re, /post horse for Corbeil/]);
      assert.equal(run.vars['b3.granary'], key, `${grain} ${key}`);
      clean(run);
    }
  }
  for (const cadets of ['sworn', 'heard', 'refused']) {
    for (const [key, re] of [['stopped', /take the boys out of the square/], ['allowed', /let them drink/], ['left', /Leave them to it/]]) {
      const run = await play('b3c08', {}, { ...START, 'b3.cadets': cadets }, [re, /Place de Grève, where/]);
      assert.equal(run.vars['b3.greve'], key, `${cadets} ${key}`);
      clean(run);
    }
  }
  for (const veil of ['covered', 'silenced', 'left']) {
    for (const [key, re] of [['gave', /Give him the name/], ['hid', /Lie to him/], ['bargained', /Offer to take the boy in hand/]]) {
      const run = await play('b3c08', {}, { ...START, 'b3.veil': veil, 'b3.file': 'kept', 'b3.galerius': 'court' }, [re, /Climb the stair/]);
      assert.equal(run.vars['b3.lictor'], key, `${veil} ${key}`);
      clean(run);
    }
  }
  for (const [key, re] of [['sold', /Sell them/], ['lent', /Lend them/], ['refused', /does not deal in arms/]]) {
    for (const wealth of [40000, 100]) {
      const run = await play('b3c08', {}, { ...START, wealth }, [re, /deputation of the parish/]);
      assert.equal(run.vars['b3.muskets'], key, `${wealth} ${key}`);
      clean(run);
    }
  }
});

test('chapter 8 leads on to chapter 9', async () => {
  const run = await play('b3c08', {}, START, [], { stopAt: 'b3c09' });
  assert.equal(run.game.state.chapter, 'b3c09');
  assert.match(run.text, /thirty first/);
});
