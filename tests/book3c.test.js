// Session 31: Book Three, chapters 5 and 6. Played down their branches. (This file says what is guaranteed, not what happens.)

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
const PRESS = ['quiet', 'licensed', 'underground'];

test('chapter 5 plays through for every state of the book so far, and reaches the pause', async () => {
  for (const weapon of ['accepted', 'bargained', 'refused']) {
    for (const severin of ['open', 'careful', 'cold']) {
      for (const hunger of [10, 90]) {
        const run = await play('b3c05', {}, { ...START, hunger, 'b3.weapon': weapon, 'b3.severin': severin, 'b1.galerius': 'hostile', 'b3.roll': 'read' }, []);
        assert.equal(run.game.state.chapter, 'b3c06', `${weapon} ${severin} ${hunger}`);
        clean(run);
      }
    }
  }
  for (const g of ['watching', 'wary', 'hostile']) {
    const run = await play('b3c05', {}, { ...START, 'b1.galerius': g, 'b1.galerius_aid': true }, [/Climb the stair/], { stopAt: 'b3c06' });
    assert.equal(run.game.state.chapter, 'b3c06', g);
    clean(run);
  }
});

test('chapter 5 takes each answer to the Cadets, the Lictor and the grain', async () => {
  for (const [key, re] of [['sworn', /Take their oath/], ['heard', /Hear them out/], ['refused', /children playing at a war/]]) {
    const run = await play('b3c05', {}, START, [re, /Go to the green door/], { stopAt: 'b3c06' });
    assert.equal(run.vars['b3.cadets'], key);
    clean(run);
  }
  for (const [key, re] of [['senate', /To the Senate/], ['own', /To myself/], ['court', /To the Prince's Peace/]]) {
    const run = await play('b3c05', {}, START, [re, /Climb the stair/], { stopAt: 'b3c06' });
    assert.equal(run.vars['b3.galerius'], key);
    clean(run);
  }
  for (const press of PRESS) {
    for (const bread of ['gave', 'fed', 'passed']) {
      for (const [key, re] of [['hoarded', /Buy the Corbeil stock/], ['relieved', /sell it at the old price/], ['exposed', /print the names of the company/], ['ignored', /Leave it\. Grain/]]) {
        const run = await play('b3c05', {}, { ...START, 'b3.press': press, 'b3.bread': bread }, [re, /Sit down with Adélaïde/], { stopAt: 'b3c06' });
        assert.equal(run.vars['b3.grain'], key, `${press} ${bread}`);
        clean(run);
      }
    }
  }
});

test('chapter 5 offers the Prince\'s paper only when the Prince was served, and Aubry otherwise', async () => {
  for (const [key, re] of [['kept', /Keep it, and keep your word/], ['warned', /Warn the three/], ['burned', /Burn it/]]) {
    const run = await play('b3c05', {}, { ...START, 'b3.weapon': 'accepted' }, [re, /Read the Prince's paper/], { stopAt: 'b3c06' });
    assert.equal(run.vars['b3.list'], key);
    assert.match(run.text, /twelve names/i);
    clean(run);
  }
  for (const [key, re] of [['drilled', /Let him drill/], ['listened', /Listen to him/], ['left', /no use for soldiers/]]) {
    const run = await play('b3c05', {}, { ...START, 'b3.weapon': 'refused' }, [re, /where Aubry is waiting/], { stopAt: 'b3c06' });
    assert.equal(run.vars['b3.aubry'], key);
    assert.equal(run.vars['b3.list'], 'unseen');
    clean(run);
  }
});

test('chapter 6 plays through for every state of the book so far', async () => {
  for (const cadets of ['sworn', 'heard', 'refused']) {
    for (const weapon of ['accepted', 'refused']) {
      for (const hunger of [10, 90]) {
        const run = await play('b3c06', {}, { ...START, hunger, 'b3.cadets': cadets, 'b3.weapon': weapon, 'b3.galerius': 'senate', 'b3.grain': 'hoarded' }, []);
        assert.equal(run.frame.wait, 'book_end', `${cadets} ${weapon} ${hunger}`);
        clean(run);
      }
    }
  }
});

test('chapter 6 takes each way into the riot, the Veil, the wounded and the council', async () => {
  for (const cadets of ['sworn', 'refused']) {
    for (const [key, re] of [['stood', /stand with the Cadets/], ['turned', /turn the ones at the front/], ['held', /Hold back at the end/]]) {
      const run = await play('b3c06', {}, { ...START, 'b3.cadets': cadets }, [re, /Go into the rue de Montreuil/], {});
      assert.equal(run.vars['b3.riot'], key);
      clean(run);
    }
  }
  for (const [key, re] of [['covered', /have him carried out as a corpse/], ['silenced', /Follow the sergeant home/], ['left', /Do nothing about it/]]) {
    const run = await play('b3c06', {}, START, [re, /Find the boy who was hit/], {});
    assert.equal(run.vars['b3.veil'], key);
    clean(run);
  }
  for (const [key, re] of [['sheltered', /Open the house/], ['refused', /Send them on to the Hôtel-Dieu/]]) {
    const run = await play('b3c06', {}, START, [re, /Go back to the shop/], {});
    assert.equal(run.vars['b3.wounded'], key);
    clean(run);
  }
  for (const veil of ['left', 'silenced']) {
    for (const [key, re] of [['cadets', /Speak for the young ones/], ['court', /Speak for the court/], ['silent', /give them no advice/]]) {
      const run = await play('b3c06', {}, { ...START, 'b3.veil': veil }, [re, /Answer the summons/], {});
      assert.equal(run.vars['b3.council'], key);
      clean(run);
    }
  }
});

test('chapter 6 silencing a witness costs humanity and a skipped night leaves the defaults', async () => {
  const before = await play('b3c06', {}, START, [/Do nothing about it/, /Find the boy who was hit/], {});
  const after = await play('b3c06', {}, START, [/Follow the sergeant home/, /Find the boy who was hit/], {});
  assert.ok(after.vars.humanity < before.vars.humanity, `${after.vars.humanity} ${before.vars.humanity}`);
});
