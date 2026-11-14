// Session 23: Book Two, chapters 11 and 12 (paper in the old coin, and the girl from the hill). Played down their branches. (This file says what is guaranteed, not what happens.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
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

async function play(chapter, vars, wants = [], { stopAt = null, seed = 3, wake = {}, hero = HERO } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', years: 1410, ...wake };
  for (const [k, v] of Object.entries({ wealth: 50000, ...vars })) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt ?? (chapter === 'b2c11' ? 'b2c12' : chapter === 'b2c12' ? 'b2c13' : null));
}

const clean = (text) => {
  assert.doesNotMatch(text, /[–—]/);
  assert.doesNotMatch(text, /[{}]/);
  assert.doesNotMatch(text, /\$ do /);
};

test('Book Two lists twenty chapters and is finished', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'blood-and-gold');
  assert.equal(book.incomplete, false);
  assert.equal(book.chapterCount, 20);
});

test('chapter 11 plays through to chapter 12 for every faction answer', async () => {
  for (const faction of ['joined', 'feigned', 'refused']) {
    for (const told of ['told', 'partial', 'silent']) {
      for (const truth of ['told', 'withheld']) {
        for (const bond of ['begun', 'guarded']) {
          const run = await play('b2c11', { 'b2.faction': faction, 'b2.prince_told': told, 'b2.agent_truth': truth, 'b2.watcher_bond': bond });
          assert.equal(run.game.state.chapter, 'b2c12', JSON.stringify([faction, told, truth, bond]));
          clean(run.text);
        }
      }
    }
  }
});

test('chapter 11 plays through when very hungry and for a woman', async () => {
  const hungry = await play('b2c11', { hunger: 95 }, [/Benedetto's back room/]);
  assert.equal(hungry.game.state.chapter, 'b2c12');
  clean(hungry.text);
  const woman = await play('b2c11', {}, [], { hero: { ...HERO, gender: 'f' } });
  assert.equal(woman.game.state.chapter, 'b2c12');
  clean(woman.text);
});

test('chapter 11 records the paper, the stair, the bath house and the river stair', async () => {
  for (const [re, key] of [[/Take it in, and write it/, 'carried'], [/copy every coin/, 'recorded'], [/Refuse it, and send/, 'refused']]) {
    const run = await play('b2c11', {}, [/side door of the bank/, re]);
    assert.equal(run.vars['b2.paper'], key);
  }
  for (const [re, key] of [[/Hide him, at the hill/, 'hidden'], [/Take him to the Prince/, 'handed'], [/Let him go/, 'left']]) {
    const run = await play('b2c11', {}, [/back stair behind/, re]);
    assert.equal(run.vars['b2.guccio_fate'], key);
  }
  for (const [re, key] of [[/Listen\. Let him talk/, 'heard'], [/Pry\. Ask/, 'pried'], [/Get up, and say/, 'cut']]) {
    const run = await play('b2c11', {}, [/bath house/, re]);
    assert.equal(run.vars['b2.savelli'], key);
  }
  for (const [re, key] of [[/to go, now, tonight/, 'warned'], [/stay, and keep writing/, 'kept'], [/see to it, and nothing more/, 'silent']]) {
    const run = await play('b2c11', {}, [/river stair/, re]);
    assert.equal(run.vars['b2.watcher_shield'], key);
  }
});

test('chapter 11 leaves a thing unseen when he does not go there', async () => {
  const run = await play('b2c11', {}, [/river stair/, /bath house/, /back stair behind/]);
  assert.equal(run.vars['b2.paper'], 'unseen');
});

test('chapter 12 plays through for every arrival and every answer', async () => {
  for (const fiammetta of ['promised', 'refused', 'allowed']) {
    for (const deal of ['partner', 'rival', 'quiet']) {
      for (const ask of [/Do it\. She is asking/, /when the spring is over/, /Tell her no/]) {
        const run = await play('b2c12', { 'b2.fiammetta': fiammetta, 'b2.prisca_deal': deal, 'b2.paper': 'recorded', 'b2.guccio_fate': 'handed' }, [ask]);
        assert.equal(run.game.state.chapter, 'b2c13', JSON.stringify([fiammetta, deal, String(ask)]));
        clean(run.text);
      }
    }
  }
});

test('chapter 12 plays through when very hungry, for a woman, and after every guccio ending', async () => {
  const hungry = await play('b2c12', { hunger: 95 }, [/Benedetto's back room/]);
  assert.equal(hungry.game.state.chapter, 'b2c13');
  clean(hungry.text);
  const woman = await play('b2c12', {}, [], { hero: { ...HERO, gender: 'f' } });
  assert.equal(woman.game.state.chapter, 'b2c13');
  clean(woman.text);
  for (const fate of ['hidden', 'handed', 'left', 'unseen']) {
    for (const paper of ['carried', 'recorded', 'refused', 'unseen']) {
      const run = await play('b2c12', { 'b2.guccio_fate': fate, 'b2.paper': paper }, [/Bargello/]);
      assert.equal(run.game.state.chapter, 'b2c13');
      clean(run.text);
    }
  }
});

test('chapter 12 records the answer about the Dark Gift, and the gift is given only when he says yes', async () => {
  for (const [re, key] of [[/Do it\. She is asking/, 'sired'], [/when the spring is over/, 'later'], [/Tell her no/, 'refused']]) {
    const run = await play('b2c12', {}, [re]);
    assert.equal(run.vars['b2.sire'], key);
    const member = run.game.state.sys.circle.fiammetta;
    assert.equal(Boolean(member && member.kind === 'vampire'), key === 'sired', key);
  }
});

test('chapter 12 hides the Dark Gift when he cannot give it', async () => {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed: 3 });
  await dev.jump(game, 'b2c12', {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', years: 1410 };
  game.state.sys.sired = { 'blood-and-gold': 2 };
  let frame = await dev.jump(game, 'b2c12', { keep: true });
  for (let i = 0; i < 400 && !(frame.wait === 'choices' && frame.choices.some((c) => /Tell her no/.test(c.text))); i++) {
    frame = frame.wait === 'choices' ? await game.choose(0) : await game.continue();
  }
  assert.ok(frame.choices.some((c) => /Tell her no/.test(c.text)));
  assert.ok(!frame.choices.some((c) => /Do it\. She is asking/.test(c.text)));
});

test('every flag these chapters set is registered with a quick start default', async () => {
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  for (const k of ['b2.paper', 'b2.guccio_fate', 'b2.savelli', 'b2.watcher_shield', 'b2.sire', 'b2.fiammetta_work']) {
    assert.ok(flags[k], k);
    assert.equal(flags[k].major, true, k);
    assert.ok(flags[k].values.includes(flags[k].default), k);
  }
});
