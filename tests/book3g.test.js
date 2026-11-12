// Session 35: Book Three, chapters 13 and 14. Played down their branches. (This file says what is guaranteed, not what happens.)

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
  return drive(game, frame, wants, stopAt ?? (chapter === 'b3c12' ? 'b3c13' : chapter === 'b3c14' ? 'b3c15' : null));
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
};

const START = { hunger: 10, wealth: 40000 };
const via = (hub, branch) => [branch, hub];

const EARLIER = { 'b3.charter': 'carried', 'b3.republic': 'printed', 'b3.garnier': 'bargained', 'b3.file': 'kept', 'b3.boy': 'taught', 'b3.aubry': 'drilled', 'b3.nationals': 'bought', 'b3.hunt': 'sworn', 'b3.federation': 'between' };

test('chapter 13 plays through for every state of the book so far, and reaches chapter 14', async () => {
  for (const vault of ['read', 'broke', 'left']) {
    for (const coup of ['none', 'backed', 'stopped', 'told']) {
      for (const champ of ['stayed', 'fetched', 'stood']) {
        for (const hunger of [10, 90]) {
          const run = await play('b3c13', {}, { ...START, ...EARLIER, hunger, 'b3.vault': vault, 'b3.coup': coup, 'b3.champ': champ }, [], { stopAt: 'b3c14' });
          assert.equal(run.game.state.chapter, 'b3c14', `${vault} ${coup} ${champ} ${hunger}`);
          assert.match(run.text, /before the war/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 13 takes each choice at the Prince, the brewery, the shop and the bench', async () => {
  for (const vault of ['read', 'broke', 'left']) {
    for (const charter of ['carried', 'softened', 'kept']) {
      for (const [key, re] of [['held', /Take the key, and say that you will be at the grille/], ['refused', /Refuse it, and say that it is a quarrel/], ['bargained', /ask that the Cadets be let alone/]]) {
        const run = await play('b3c13', {}, { ...START, ...EARLIER, 'b3.vault': vault, 'b3.charter': charter }, via(/Ottaviano's coach is waiting/, re), { stopAt: 'b3c14' });
        assert.equal(run.vars['b3.key'], key, `${vault} ${charter} ${key}`);
        clean(run);
      }
    }
  }
  for (const coup of ['none', 'backed', 'stopped', 'told']) {
    for (const boy of ['taught', 'hidden', 'left']) {
      for (const key of ['none', 'bargained']) {
        for (const [home, re] of [['sheltered', /old quarry gallery under the shop/], ['sent', /Send them out of Paris/], ['left', /for them to decide/]]) {
          const run = await play('b3c13', {}, { ...START, ...EARLIER, 'b3.coup': coup, 'b3.boy': boy, 'b3.key': key }, via(/court's notice has been served/, re), { stopAt: 'b3c14' });
          assert.equal(run.vars['b3.cadets_home'], home, `${coup} ${boy} ${key} ${home}`);
          clean(run);
        }
      }
    }
  }
  for (const republic of ['printed', 'neutral', 'refused']) {
    for (const garnier of ['turned', 'sheltered', 'bargained']) {
      for (const [key, re] of [['backed', /Put the house's name to it/], ['funded', /Lend him the money/], ['refused', /Say that it cannot be done/]]) {
        const run = await play('b3c13', {}, { ...START, ...EARLIER, 'b3.republic': republic, 'b3.garnier': garnier }, via(/Baptiste has a prospectus/, re), { stopAt: 'b3c14' });
        assert.equal(run.vars['b3.journal'], key, `${republic} ${garnier} ${key}`);
        clean(run);
      }
    }
  }
  for (const champ of ['stayed', 'fetched', 'stood']) {
    for (const [key, re] of [['kept', /Keep him at the shop/], ['sent', /captain's commission/], ['left', /it is for him to decide/]]) {
      const run = await play('b3c13', {}, { ...START, ...EARLIER, 'b3.champ': champ }, via(/sergeant has asked you to come/, re), { stopAt: 'b3c14' });
      assert.equal(run.vars['b3.aubry_post'], key, `${champ} ${key}`);
      clean(run);
    }
  }
});

test('chapter 13: the war night can be met three ways, and each ends on the knock at the yard door', async () => {
  for (const [key, re] of [['contract', /Take the contract for the Army of the North/], ['gold', /Put the house's reserves into gold/], ['none', /Leave Collis out of it/]]) {
    for (const aubry of ['kept', 'sent', 'left']) {
      for (const home of ['sheltered', 'sent', 'left']) {
        for (const journal of ['backed', 'funded', 'refused']) {
          const run = await play('b3c13', {}, { ...START, ...EARLIER, 'b3.aubry_post': aubry, 'b3.cadets_home': home, 'b3.journal': journal }, [re], { stopAt: 'b3c14' });
          assert.equal(run.vars['b3.war'], key, `${key} ${aubry} ${home} ${journal}`);
          assert.match(run.text, /the hand has moved/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 13 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c13', {}, START, [], { stopAt: 'b3c14' });
  const defaults = { 'b3.key': 'none', 'b3.cadets_home': 'left', 'b3.journal': 'refused', 'b3.aubry_post': 'left' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  clean(run);
});

const LATE = { ...EARLIER, 'b3.key': 'held', 'b3.cadets_home': 'sheltered', 'b3.journal': 'backed', 'b3.aubry_post': 'sent', 'b3.war': 'contract', 'b3.coup': 'backed', 'b3.champ': 'stood' };

test('chapter 14 plays through for every state of the book so far, and reaches chapter 15', async () => {
  for (const key of ['none', 'held', 'bargained', 'refused']) {
    for (const vault of ['read', 'broke', 'left']) {
      for (const nationals of ['bought', 'lent', 'refused']) {
        for (const hunger of [10, 90]) {
          const run = await play('b3c14', {}, { ...START, ...LATE, hunger, 'b3.key': key, 'b3.vault': vault, 'b3.nationals': nationals }, []);
          assert.equal(run.game.state.chapter, 'b3c15', `${key} ${vault} ${nationals} ${hunger}`);
          assert.match(run.text, /second of September/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 14 takes each choice at the hall, the column, the palace and the press', async () => {
  for (const key of ['none', 'held', 'bargained']) {
    for (const [v, re] of [['held', /Stand in the door, and say that the Prince's silence/], ['let', /Let him go, and say that he has a gentleman's right/], ['rode', /ride with him, as far as the Carrousel/]]) {
      const run = await play('b3c14', {}, { ...START, ...LATE, 'b3.key': key }, via(/eleven of the court are standing about/, re));
      assert.equal(run.vars['b3.brezac'], v, `${key} ${v}`);
      clean(run);
    }
  }
  for (const home of ['sheltered', 'sent', 'left']) {
    for (const coup of ['none', 'backed', 'stopped', 'told']) {
      for (const [v, re] of [['marched', /March with the column/], ['steered', /take the bridges instead/], ['stayed', /Stay out of it/]]) {
        const run = await play('b3c14', {}, { ...START, ...LATE, 'b3.cadets_home': home, 'b3.coup': coup }, via(/faubourg is gathering under the bells/, re));
        assert.equal(run.vars['b3.faubourg'], v, `${home} ${coup} ${v}`);
        clean(run);
      }
    }
  }
  for (const champ of ['stayed', 'fetched', 'stood']) {
    for (const brezac of ['none', 'rode']) {
      for (const [v, re] of [['warned', /Find the captain of the Swiss/], ['carried', /Take the old woman and the children/], ['watched', /Watch from the arch of the Carrousel/]]) {
        const run = await play('b3c14', {}, { ...START, ...LATE, 'b3.champ': champ, 'b3.brezac': brezac }, via(/Swiss are standing in the Cour Royale/, re));
        assert.equal(run.vars['b3.palace'], v, `${champ} ${brezac} ${v}`);
        clean(run);
      }
    }
  }
  for (const journal of ['backed', 'funded', 'refused']) {
    for (const aubry of ['kept', 'sent', 'left']) {
      for (const [v, re] of [['let', /Let him go to the Place de la Bastille/], ['kept', /Keep him in the house/], ['went', /Go with him, as far as the Place/]]) {
        const run = await play('b3c14', {}, { ...START, ...LATE, 'b3.journal': journal, 'b3.aubry_post': aubry }, via(/Étienne has asked for you/, re));
        assert.equal(run.vars['b3.baptiste'], v, `${journal} ${aubry} ${v}`);
        clean(run);
      }
    }
  }
});

test('chapter 14: the slate can be met three ways, and each ends the chapter in the same cellar', async () => {
  for (const [v, re] of [['told', /Tell him that it is his hand/], ['kept', /Say nothing of it/], ['rubbed', /Rub the line out/]]) {
    for (const vault of ['read', 'broke', 'left']) {
      for (const key of ['none', 'held']) {
        const run = await play('b3c14', {}, { ...START, ...LATE, 'b3.vault': vault, 'b3.key': key }, [re]);
        assert.equal(run.vars['b3.slate'], v, `${v} ${vault} ${key}`);
        assert.match(run.text, /second of September/);
        clean(run);
      }
    }
  }
});

test('chapter 14 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c14', {}, { ...START, ...LATE }, []);
  const defaults = { 'b3.brezac': 'none', 'b3.faubourg': 'none', 'b3.palace': 'watched', 'b3.baptiste': 'none' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  clean(run);
});

test('chapters 13 and 14 never describe him in the daylight', async () => {
  const a = await play('b3c13', {}, START, [], { stopAt: 'b3c14' });
  const b = await play('b3c14', {}, { ...START, ...LATE }, []);
  for (const run of [a, b]) assert.doesNotMatch(run.text, /in the sun\b|last of the sun|in the daylight/);
});
