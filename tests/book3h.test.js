// Session 36: Book Three, chapters 15 and 16. Played down their branches. (This file says what is guaranteed, not what happens.)

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
  return drive(game, frame, wants, stopAt ?? (chapter === 'b3c15' ? 'b3c16' : chapter === 'b3c16' ? 'b3c17' : null));
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
};

const START = { hunger: 10, wealth: 40000 };
const via = (hub, branch) => [branch, hub];

const EARLIER = { 'b3.nationals': 'bought', 'b3.slate': 'told', 'b3.garnier': 'bargained', 'b3.file': 'kept', 'b3.brezac': 'held', 'b3.palace': 'warned', 'b3.baptiste': 'went', 'b3.faubourg': 'marched', 'b3.cadets_home': 'sheltered', 'b3.key': 'held', 'b3.vault': 'read', 'b3.hunt': 'sworn', 'b3.senate': 'answered', 'b3.valere': 'sworn', 'b3.aubry_post': 'kept', 'b3.journal': 'backed', 'b3.coup': 'backed', 'b3.champ': 'stood' };

test('chapter 15 plays through for every state of the book so far, and reaches chapter 16', async () => {
  for (const nationals of ['bought', 'lent', 'refused']) {
    for (const slate of ['told', 'kept', 'rubbed']) {
      for (const garnier of ['turned', 'sheltered', 'bargained']) {
        for (const hunger of [10, 90]) {
          const run = await play('b3c15', {}, { ...START, ...EARLIER, hunger, 'b3.nationals': nationals, 'b3.slate': slate, 'b3.garnier': garnier }, []);
          assert.equal(run.game.state.chapter, 'b3c16', `${nationals} ${slate} ${garnier} ${hunger}`);
          assert.match(run.text, /Maillard/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 15 takes each choice at the convent, the Hôtel de Saint-Aubin, the Hôtel de Ville and the cellar', async () => {
  const markers = { cadets: /four persons in it/, priests: /fewer than there might have been/, watched: /a great deal of ash/ };
  for (const nationals of ['bought', 'lent', 'refused']) {
    for (const [v, re] of [['cadets', /Take the four out before the day/], ['priests', /Open the gate at three/], ['watched', /Stand in the garden, and do neither/]]) {
      const run = await play('b3c15', {}, { ...START, ...EARLIER, 'b3.nationals': nationals }, via(/where the Cadets sleep under the chapel/, re));
      assert.equal(run.vars['b3.carmes'], v, `${nationals} ${v}`);
      assert.match(run.text, markers[v]);
      clean(run);
    }
  }
  for (const slate of ['told', 'kept', 'rubbed']) {
    for (const brezac of ['none', 'held', 'rode']) {
      for (const [v, re] of [['pressed', /Ask him to put the court's eleven/], ['crossed', /See him over the river/], ['left', /Let him go, and do not follow/]]) {
        const run = await play('b3c15', {}, { ...START, ...EARLIER, 'b3.slate': slate, 'b3.brezac': brezac }, via(/a plain coach is waiting in the court/, re));
        assert.equal(run.vars['b3.crossing'], v, `${slate} ${brezac} ${v}`);
        clean(run);
      }
    }
  }
  for (const garnier of ['turned', 'sheltered', 'bargained']) {
    for (const file of ['kept', 'burned', 'left']) {
      for (const [v, re] of [['warned', /Go by the back stair to the families/], ['struck', /Pay a clerk to strike six names/], ['kept', /Copy the list, and say nothing of it/]]) {
        const run = await play('b3c15', {}, { ...START, ...EARLIER, 'b3.garnier': garnier, 'b3.file': file }, via(/Surveillance Committee is at its lists/, re));
        assert.equal(run.vars['b3.arrests'], v, `${garnier} ${file} ${v}`);
        clean(run);
      }
    }
  }
  for (const [v, re, after] of [['hid', /Hide him in the quarry/, /The abbé is in the quarry/], ['sent', /Put him on the Orléans coach/, /A note came from Étampes/], ['left', /Let him go back to his house/, /gave himself up at the gate/]]) {
    const run = await play('b3c15', {}, { ...START, ...EARLIER }, via(/Adélaïde is waiting at the head of the cellar stair/, re));
    assert.equal(run.vars['b3.priest'], v, v);
    assert.match(run.text, after);
    clean(run);
  }
});

test('chapter 15: the Abbaye can be met three ways, and each ends the chapter', async () => {
  for (const palace of ['watched', 'warned', 'carried']) {
    for (const baptiste of ['none', 'let', 'kept', 'went']) {
      for (const crossing of ['pressed', 'crossed', 'left']) {
        for (const [v, re] of [['spoke', /Go to the table, and speak for him/], ['took', /Take him out by the back stair/], ['stayed', /Stay in the street, and do not go in/]]) {
          const run = await play('b3c15', {}, { ...START, ...EARLIER, 'b3.palace': palace, 'b3.baptiste': baptiste, 'b3.crossing': crossing }, [re]);
          assert.equal(run.vars['b3.abbaye'], v, `${palace} ${baptiste} ${v}`);
          assert.equal(run.game.state.chapter, 'b3c16');
          clean(run);
        }
      }
    }
  }
});

test('chapter 15 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c15', {}, { ...START, ...EARLIER }, []);
  const defaults = { 'b3.carmes': 'watched', 'b3.crossing': 'left', 'b3.arrests': 'kept', 'b3.priest': 'left' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  clean(run);
});

const LATE = { ...EARLIER, 'b3.carmes': 'cadets', 'b3.crossing': 'crossed', 'b3.arrests': 'warned', 'b3.priest': 'hid', 'b3.abbaye': 'spoke' };

test('chapter 16 plays through for every state of the book so far, and reaches chapter 17', async () => {
  for (const hunt of ['sworn', 'taken', 'spared', 'destroyed']) {
    for (const senate of ['answered', 'stalled', 'defied']) {
      for (const abbaye of ['spoke', 'took', 'stayed']) {
        for (const hunger of [10, 90]) {
          const run = await play('b3c16', {}, { ...START, ...LATE, hunger, 'b3.hunt': hunt, 'b3.senate': senate, 'b3.abbaye': abbaye }, []);
          assert.equal(run.game.state.chapter, 'b3c17', `${hunt} ${senate} ${abbaye} ${hunger}`);
          assert.match(run.text, /first year of the Republic/);
          assert.match(run.text, /keeper/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 16 takes each choice at the Temple, the bedside, the rue des Prouvaires and the third cellar', async () => {
  for (const post of ['kept', 'sent', 'left']) {
    for (const [v, re] of [['offered', /Send him a word, by the sergeant/], ['watched', /Stand in the lane, under the lamp/], ['left', /Go home, and do not look at it/]]) {
      const run = await play('b3c16', {}, { ...START, ...LATE, 'b3.aubry_post': post }, via(/where the king has asked for a priest/, re));
      assert.equal(run.vars['b3.temple'], v, `${post} ${v}`);
      clean(run);
    }
  }
  for (const valere of ['sworn', 'trusted', 'distant']) {
    for (const [v, re] of [['told', /Tell him all of it, from the beginning/], ['sat', /Sit with him, and say nothing at all/], ['left', /leave him to Adélaïde/]]) {
      const run = await play('b3c16', {}, { ...START, ...LATE, 'b3.valere': valere }, via(/where Étienne has been asking for you/, re));
      assert.equal(run.vars['b3.etienne'], v, `${valere} ${v}`);
      clean(run);
    }
  }
  for (const hunt of ['sworn', 'taken', 'spared', 'destroyed']) {
    for (const senate of ['answered', 'stalled', 'defied']) {
      for (const [v, re] of [['heard', /Tell him all of it, plainly/], ['bargained', /Give him what the Senate came for/], ['sent', /Say that the Senate has no business in Paris/]]) {
        const run = await play('b3c16', {}, { ...START, ...LATE, 'b3.hunt': hunt, 'b3.senate': senate }, via(/where there is a black seal on the table/, re));
        assert.equal(run.vars['b3.envoy'], v, `${hunt} ${senate} ${v}`);
        clean(run);
      }
    }
  }
  for (const key of ['none', 'held']) {
    for (const vault of ['read', 'broke', 'left']) {
      for (const [v, re] of [['read', /Read it through with him/], ['touched', /Put your hand on hers/], ['left', /Leave it unread, and take him up/]]) {
        const run = await play('b3c16', {}, { ...START, ...LATE, 'b3.key': key, 'b3.vault': vault }, via(/where Ottaviano has brought the Prince back/, re));
        assert.equal(run.vars['b3.third'], v, `${key} ${vault} ${v}`);
        clean(run);
      }
    }
  }
});

test('chapter 16: the keys can be given three ways, and each closes the chapter', async () => {
  for (const [v, re] of [['adelaide', /Put the keys into her hand/], ['baptiste', /Give them to Baptiste/], ['none', /let it close/]]) {
    for (const etienne of ['told', 'sat', 'left']) {
      for (const temple of ['offered', 'watched', 'left']) {
        for (const post of ['kept', 'sent', 'left']) {
          const run = await play('b3c16', {}, { ...START, ...LATE, 'b3.etienne': etienne, 'b3.temple': temple, 'b3.aubry_post': post }, [re]);
          assert.equal(run.vars['b3.keeper'], v, `${v} ${etienne} ${temple} ${post}`);
          assert.match(run.text, /the keys of the cellars|keys of the cellars/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 16 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c16', {}, { ...START, ...LATE }, []);
  const defaults = { 'b3.temple': 'left', 'b3.etienne': 'left', 'b3.envoy': 'heard', 'b3.third': 'left' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  clean(run);
});

test('chapters 15 and 16 never describe him in the daylight', async () => {
  const a = await play('b3c15', {}, { ...START, ...EARLIER }, []);
  const b = await play('b3c16', {}, { ...START, ...LATE }, []);
  for (const run of [a, b]) assert.doesNotMatch(run.text, /in the sun\b|last of the sun|in the daylight/);
});
