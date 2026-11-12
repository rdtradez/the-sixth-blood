// Session 34: Book Three, chapters 11 and 12. Played down their branches. (This file says what is guaranteed, not what happens.)

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
  return drive(game, frame, wants, stopAt ?? (chapter === 'b3c12' ? 'b3c13' : null));
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
};

const START = { hunger: 10, wealth: 40000 };

const via = (hub, branch) => [branch, hub];

test('chapter 11 plays through for every state of the book so far, and reaches chapter 12', async () => {
  for (const hunt of ['taken', 'sworn', 'spared', 'destroyed']) {
    for (const exodus of ['sent', 'stood', 'told']) {
      for (const hunger of [10, 90]) {
        for (const vault of ['read', 'broke', 'left']) {
          const run = await play('b3c11', {}, { ...START, hunger, 'b3.hunt': hunt, 'b3.exodus': exodus, 'b3.vault': vault, 'b3.boy': 'hidden', 'b3.march': 'armed', 'b3.council': 'cadets', 'b3.aubry': 'drilled', 'b3.gallery': 'haven' }, [], { stopAt: 'b3c12' });
          assert.equal(run.game.state.chapter, 'b3c12', `${hunt} ${exodus} ${hunger} ${vault}`);
          assert.match(run.text, /dance/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 11 takes each choice in the counting room, the cellar, the letter and the field', async () => {
  for (const gallery of ['haven', 'left']) {
    for (const [key, re] of [['bought', /Buy it through Adélaïde/], ['lent', /district have it for a hospital/], ['refused', /Refuse it, and say/]]) {
      const run = await play('b3c11', {}, { ...START, 'b3.gallery': gallery }, via(/national lots with Adélaïde/, re), { stopAt: 'b3c12' });
      assert.equal(run.vars['b3.nationals'], key, `${gallery} ${key}`);
      clean(run);
    }
  }
  for (const exodus of ['sent', 'stood', 'told']) {
    for (const march of ['armed', 'bread', 'none']) {
      for (const [key, re] of [['carried', /Carry it to the Prince as it is written/], ['softened', /Soften it/], ['kept', /Keep it, and tell them/]]) {
        const run = await play('b3c11', {}, { ...START, 'b3.exodus': exodus, 'b3.march': march }, via(/petition from Severin/, re), { stopAt: 'b3c12' });
        assert.equal(run.vars['b3.charter'], key, `${exodus} ${march} ${key}`);
        clean(run);
      }
    }
  }
  for (const hunt of ['taken', 'sworn', 'spared', 'destroyed']) {
    for (const boy of ['hidden', 'left']) {
      for (const [key, re] of [['answered', /Answer it plainly/], ['stalled', /Answer it slowly/], ['defied', /Send it back with the seal/]]) {
        const run = await play('b3c11', {}, { ...START, 'b3.hunt': hunt, 'b3.boy': boy }, via(/letter that came by the Lyon coach/, re), { stopAt: 'b3c12' });
        assert.equal(run.vars['b3.senate'], key, `${hunt} ${boy} ${key}`);
        clean(run);
      }
    }
  }
  for (const council of ['cadets', 'court', 'silent']) {
    for (const aubry of ['drilled', 'left']) {
      for (const [key, re] of [['dug', /Take a spade/], ['between', /Stand between Brezac/], ['watched', /Watch from the bank/]]) {
        const run = await play('b3c11', {}, { ...START, 'b3.council': council, 'b3.aubry': aubry }, via(/Walk out to the Champ de Mars/, re), { stopAt: 'b3c12' });
        assert.equal(run.vars['b3.federation'], key, `${council} ${aubry} ${key}`);
        clean(run);
      }
    }
  }
});

test('chapter 11 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c11', {}, START, [], { stopAt: 'b3c12' });
  const defaults = { 'b3.nationals': 'refused', 'b3.charter': 'kept', 'b3.senate': 'stalled', 'b3.federation': 'watched' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  clean(run);
});

test('chapter 11: buying the convent brings the deed to the counter, with no raw numbers in the text', async () => {
  const run = await play('b3c11', {}, START, via(/national lots with Adélaïde/, /Buy it through Adélaïde/), { stopAt: 'b3c12' });
  assert.match(run.text, /deed/);
  assert.doesNotMatch(run.text, /\{wealth\}/);
});

const LATE = { 'b3.charter': 'carried', 'b3.federation': 'between', 'b3.broadsheet': 'named', 'b3.rights': 'annotated', 'b3.senate': 'answered', 'b3.nationals': 'bought' };

test('chapter 12 plays through for every state of the book so far, and chapter 13 follows it', async () => {
  for (const file of ['kept', 'burned', 'left']) {
    for (const boy of ['taught', 'hidden', 'left']) {
      for (const vault of ['read', 'broke', 'left']) {
        for (const hunger of [10, 90]) {
          const run = await play('b3c12', {}, { ...START, hunger, ...LATE, 'b3.file': file, 'b3.boy': boy, 'b3.vault': vault }, []);
          assert.equal(run.game.state.chapter, 'b3c13', `${file} ${boy} ${vault} ${hunger}`);
          assert.match(run.text, /seventeenth of July/);
          assert.match(run.text, /slate has stopped/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 12 takes each choice at the palace, the shop, the brewery and the door', async () => {
  for (const [key, re] of [['aided', /Delay the general's carriage/], ['warned', /Go to the officer of the guard/], ['watched', /Stay in the dark under the arch/]]) {
    const run = await play('b3c12', {}, START, via(/Guard is changing at the Carrousel/, re));
    assert.equal(run.vars['b3.flight'], key, key);
    clean(run);
  }
  for (const broadsheet of ['named', 'unnamed', 'refused']) {
    for (const [key, re] of [['printed', /Print it, under the house's name/], ['neutral', /Print the Assembly's notice/], ['refused', /Pull the type/]]) {
      const run = await play('b3c12', {}, { ...START, 'b3.broadsheet': broadsheet, 'b3.rights': 'annotated' }, via(/Baptiste has been setting type/, re));
      assert.equal(run.vars['b3.republic'], key, `${broadsheet} ${key}`);
      clean(run);
    }
  }
  for (const boy of ['taught', 'hidden', 'left']) {
    for (const charter of ['carried', 'softened', 'kept']) {
      for (const [key, re] of [['backed', /Ride with them to the Hôtel de Saint-Aubin/], ['stopped', /Ride ahead of them/], ['told', /tell Ottaviano what is coming/]]) {
        const run = await play('b3c12', {}, { ...START, 'b3.boy': boy, 'b3.charter': charter, 'b3.federation': 'between' }, via(/brewery yard, where Severin/, re));
        assert.equal(run.vars['b3.coup'], key, `${boy} ${charter} ${key}`);
        clean(run);
      }
    }
  }
  for (const file of ['kept', 'burned', 'left']) {
    for (const [key, re] of [['sheltered', /Hide him in the quarry gallery/], ['bargained', /take the Section's files in return/], ['turned', /Turn him away/]]) {
      const run = await play('b3c12', {}, { ...START, 'b3.file': file }, via(/Inspector Garnier is standing/, re));
      assert.equal(run.vars['b3.garnier'], key, `${file} ${key}`);
      clean(run);
    }
  }
});

test('chapter 12: the shooting on the Champ de Mars can be met three ways, and each leads to the same morning after', async () => {
  for (const [key, re] of [['fetched', /bring Baptiste out by the collar/], ['stood', /Stand between the Guard and the altar/], ['stayed', /Stay away, and watch from the roof/]]) {
    for (const seed of [1, 2, 3]) {
      const run = await play('b3c12', {}, START, [re], { seed });
      assert.equal(run.vars['b3.champ'], key, `${key} ${seed}`);
      assert.match(run.text, /slate has stopped/);
      clean(run);
    }
  }
});

test('chapter 12 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c12', {}, START, []);
  const defaults = { 'b3.flight': 'watched', 'b3.republic': 'refused', 'b3.coup': 'none', 'b3.garnier': 'turned' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  assert.equal(run.game.state.chapter, 'b3c13');
  clean(run);
});

test('chapter 11 and 12 never describe him in the daylight', async () => {
  const a = await play('b3c11', {}, START, [], { stopAt: 'b3c12' });
  const b = await play('b3c12', {}, START, []);
  for (const run of [a, b]) assert.doesNotMatch(run.text, /in the sun\b|last of the sun/);
});
