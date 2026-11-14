// Session 37: Book Three, chapters 17 and 18. Played down their branches. (This file says what is guaranteed, not what happens.)

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

async function play(chapter, vars, wants = [], { stopAt = null, seed = 3 } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'collesanto', steward: 'bank', outcome: 'on_schedule', years: 310, invest: [], ...{} };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt ?? (chapter === 'b3c17' ? 'b3c18' : chapter === 'b3c18' ? 'b3c19' : null));
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
  assert.doesNotMatch(run.text, /in the sun\b|last of the sun|in the daylight/);
};

const START = { hunger: 10, wealth: 40000 };
const via = (hub, branch) => [branch, hub];

const EARLIER = { 'b3.keeper': 'adelaide', 'b3.journal': 'backed', 'b3.aubry_post': 'kept', 'b3.carmes': 'cadets', 'b3.crossing': 'crossed', 'b3.third': 'read', 'b3.brezac': 'held', 'b3.hunt': 'sworn', 'b3.senate': 'answered', 'b3.envoy': 'heard' };
const LATE = { ...EARLIER, 'b3.civism': 'bought', 'b3.sword': 'warned', 'b3.young': 'held', 'b3.committee': 'dodged', 'b3.arrest': 'let' };

test('chapter 17 plays through for every state of the book so far, and reaches chapter 18', async () => {
  for (const keeper of ['adelaide', 'baptiste', 'none']) {
    for (const journal of ['backed', 'funded', 'refused']) {
      for (const post of ['kept', 'sent', 'left']) {
        for (const carmes of ['cadets', 'priests', 'watched']) {
          for (const hunger of [10, 90]) {
            const run = await play('b3c17', { ...START, ...EARLIER, hunger, 'b3.keeper': keeper, 'b3.journal': journal, 'b3.aubry_post': post, 'b3.carmes': carmes }, []);
            assert.equal(run.game.state.chapter, 'b3c18', `${keeper} ${journal} ${post} ${carmes} ${hunger}`);
            assert.match(run.text, /Law of Suspects|law/);
            assert.match(run.text, /warrant/);
            clean(run);
          }
        }
      }
    }
  }
});

test('chapter 17 takes each choice at the committee, the Hôtel, the yard and the shop', async () => {
  for (const keeper of ['adelaide', 'baptiste', 'none']) {
    for (const [v, re] of [['bought', /Put a purse of the new paper/], ['earned', /Offer the house's presses to the Section/], ['refused', /Say that you do not need a certificate/]]) {
      const run = await play('b3c17', { ...START, ...EARLIER, 'b3.keeper': keeper }, via(/queue for certificates/, re));
      assert.equal(run.vars['b3.civism'], v, `${keeper} ${v}`);
      clean(run);
    }
  }
  for (const crossing of ['left', 'crossed', 'pressed']) {
    for (const [v, re] of [['warned', /Tell him that a warrant is coming/], ['hidden', /Offer him the third cellar/], ['left', /Say nothing, and drink the Tokay/]]) {
      const run = await play('b3c17', { ...START, ...EARLIER, 'b3.crossing': crossing }, via(/where Brézac has set out two glasses/, re));
      assert.equal(run.vars['b3.sword'], v, `${crossing} ${v}`);
      clean(run);
    }
  }
  for (const carmes of ['cadets', 'priests', 'watched']) {
    for (const [v, re] of [['backed', /Give them the house's money/], ['held', /not yet the time/], ['forbade', /Forbid it, flatly/]]) {
      const run = await play('b3c17', { ...START, ...EARLIER, 'b3.carmes': carmes }, via(/where Severin has a paper/, re));
      assert.equal(run.vars['b3.young'], v, `${carmes} ${v}`);
      clean(run);
    }
  }
  for (const journal of ['backed', 'funded', 'refused']) {
    for (const [v, re] of [['served', /Take the Committee's work/], ['dodged', /Offer the Section's bills in its place/], ['refused', /prints what it pleases/]]) {
      const run = await play('b3c17', { ...START, ...EARLIER, 'b3.journal': journal }, via(/man of the Committee is waiting/, re));
      assert.equal(run.vars['b3.committee'], v, `${journal} ${v}`);
      clean(run);
    }
  }
});

test('chapter 17: the warrant can be met three ways, and each closes the chapter', async () => {
  for (const [v, re] of [['let', /Stand aside, and let them take him/], ['paper', /buy the month/], ['followed', /Go with the coach/]]) {
    for (const sword of ['warned', 'hidden', 'left']) {
      for (const committee of ['served', 'dodged', 'refused']) {
        const run = await play('b3c17', { ...START, ...LATE, 'b3.sword': sword, 'b3.committee': committee }, [re]);
        assert.equal(run.vars['b3.arrest'], v, `${v} ${sword} ${committee}`);
        assert.equal(run.game.state.chapter, 'b3c18');
        clean(run);
      }
    }
  }
});

test('chapter 17 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c17', { ...START, ...EARLIER }, []);
  const defaults = { 'b3.civism': 'refused', 'b3.sword': 'left', 'b3.young': 'held', 'b3.committee': 'refused' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  clean(run);
});

test('chapter 18 plays through for every state of the book so far, and reaches chapter 19', async () => {
  for (const arrest of ['let', 'paper', 'followed']) {
    for (const young of ['backed', 'held', 'forbade']) {
      for (const committee of ['served', 'dodged', 'refused']) {
        for (const hunger of [10, 90]) {
          const run = await play('b3c18', { ...START, ...LATE, hunger, 'b3.arrest': arrest, 'b3.young': young, 'b3.committee': committee }, []);
          assert.equal(run.game.state.chapter, 'b3c19', `${arrest} ${young} ${committee} ${hunger}`);
          assert.match(run.text, /Year Two/);
          assert.match(run.text, /sits up on the plank/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 18 takes each choice at the Conciergerie, the Marais, the yard and the rue des Prouvaires', async () => {
  for (const arrest of ['let', 'paper', 'followed']) {
    for (const [v, re] of [['promised', /Promise that you will be in the Place/], ['argued', /Argue that there is a way/], ['left', /Send in a basket of Tokay/]]) {
      const run = await play('b3c18', { ...START, ...LATE, 'b3.arrest': arrest }, via(/where Brézac has asked for you/, re));
      assert.equal(run.vars['b3.cell'], v, `${arrest} ${v}`);
      clean(run);
    }
  }
  for (const crossing of ['left', 'crossed']) {
    for (const [v, re] of [['vowed', /Vow that nobody in the Place/], ['pressed', /Press him to come to the Place/], ['left', /leave him to his book/]]) {
      const run = await play('b3c18', { ...START, ...LATE, 'b3.crossing': crossing }, via(/where the Prince has stopped eating/, re));
      assert.equal(run.vars['b3.marais'], v, `${crossing} ${v}`);
      clean(run);
    }
  }
  for (const young of ['backed', 'held', 'forbade']) {
    for (const [v, re] of [['held', /Keep them in the quarry/], ['let', /Let her go to the Place/], ['sent', /Send Severin to the Place/]]) {
      const run = await play('b3c18', { ...START, ...LATE, 'b3.young': young }, via(/where Clémence has a hand bill/, re));
      assert.equal(run.vars['b3.yard_veil'], v, `${young} ${v}`);
      clean(run);
    }
  }
  for (const hunt of ['sworn', 'taken', 'spared', 'destroyed']) {
    for (const envoy of ['heard', 'bargained', 'sent']) {
      for (const [v, re] of [['pledged', /Give your word that the Veil will hold/], ['defied', /no standing in the matter/], ['bargained', /leave the Cadets alone for a year/]]) {
        const run = await play('b3c18', { ...START, ...LATE, 'b3.hunt': hunt, 'b3.envoy': envoy }, via(/stranger at the window/, re));
        assert.equal(run.vars['b3.officer'], v, `${hunt} ${envoy} ${v}`);
        clean(run);
      }
    }
  }
});

test('chapter 18: the man who sat up can be met three ways, and each closes the chapter', async () => {
  for (const [v, re] of [['covered', /Make a cry, in the crowd/], ['carried', /take him out in the dark/], ['watched', /Do nothing, and stand under the pillar/]]) {
    for (const marais of ['vowed', 'pressed', 'left']) {
      for (const yard of ['held', 'let', 'sent']) {
        for (const officer of ['pledged', 'defied', 'bargained']) {
          for (const cell of ['promised', 'argued', 'left']) {
            const run = await play('b3c18', { ...START, ...LATE, 'b3.marais': marais, 'b3.yard_veil': yard, 'b3.officer': officer, 'b3.cell': cell }, [re]);
            assert.equal(run.vars['b3.rising'], v, `${v} ${marais} ${yard} ${officer} ${cell}`);
            clean(run);
          }
        }
      }
    }
  }
});

test('chapter 18 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c18', { ...START, ...LATE }, []);
  const defaults = { 'b3.cell': 'left', 'b3.marais': 'left', 'b3.yard_veil': 'held', 'b3.officer': 'bargained' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  clean(run);
});
