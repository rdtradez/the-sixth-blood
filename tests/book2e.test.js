// Session 22: Book Two, chapters 9 and 10 (the old mint, and the house with no fire). Played down their branches. (This file says what is guaranteed, not what happens.)

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
  return drive(game, frame, wants, stopAt ?? (chapter === 'b2c09' ? 'b2c10' : chapter === 'b2c10' ? 'b2c11' : null));
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

test('chapter 9 plays through to chapter 10 for every court history', async () => {
  for (const seat of ['sword', 'none']) {
    for (const captain of ['funded', 'listened', 'refused']) {
      for (const asked of ['agreed', 'declined']) {
        for (const bond of ['begun', 'guarded']) {
          const run = await play('b2c09', { 'b2.seat': seat, 'b2.captain': captain, 'b2.prisca_asked': asked, 'b2.watcher_bond': bond });
          assert.equal(run.game.state.chapter, 'b2c10', JSON.stringify([seat, captain, asked, bond]));
          clean(run.text);
        }
      }
    }
  }
});

test('chapter 9 plays through when very hungry and for a woman', async () => {
  const hungry = await play('b2c09', { hunger: 95 }, [/Benedetto's back room/]);
  assert.equal(hungry.game.state.chapter, 'b2c10');
  clean(hungry.text);
  const woman = await play('b2c09', {}, [], { hero: { ...HERO, gender: 'f' } });
  assert.equal(woman.game.state.chapter, 'b2c10');
  clean(woman.text);
});

test('chapter 9 records what he did at the weir', async () => {
  for (const [re, key] of [[/under the Prince's eye/, 'claimed'], [/Pay the priest/, 'hushed'], [/say that he must have slipped/, 'read']]) {
    const run = await play('b2c09', {}, [re]);
    assert.equal(run.vars['b2.clerk'], key);
  }
});

test('chapter 9 records the counting house, the company, the clerk and Prisca', async () => {
  for (const [re, key] of [[/go through the window/, 'copied'], [/Give the porter a florin/, 'bribed'], [/Wait for him at the door/, 'faced']]) {
    const run = await play('b2c09', {}, [/counting house of Messer Guccio/, re]);
    assert.equal(run.vars['b2.guccio'], key);
  }
  for (const [re, key] of [[/Offer him double/, 'bought'], [/share his cup/, 'talked'], [/it will not happen/, 'threatened']]) {
    const run = await play('b2c09', {}, [/Ugolino's company/, re]);
    assert.equal(run.vars['b2.ugolino'], key);
  }
  for (const [re, key] of [[/Tell the clerk everything/, 'told'], [/Give the clerk the coin/, 'withheld']]) {
    const run = await play('b2c09', {}, [/Go to the clerk/, re]);
    assert.equal(run.vars['b2.agent_truth'], key);
  }
  for (const [re, key] of [[/Tell her all that you know/, 'told'], [/Take the names/, 'kept']]) {
    const run = await play('b2c09', {}, [/ledger of the licences/, re]);
    assert.equal(run.vars['b2.prisca_conspiracy'], key);
  }
});

test('chapter 9 leaves a thing unseen when he does not go there', async () => {
  const run = await play('b2c09', {}, [/Go to the clerk/, /Go to Prisca/, /Go to the counting house|counting house of Messer Guccio/]);
  assert.equal(run.vars['b2.ugolino'], 'unseen');
});

test('chapter 9 keeps the old ducat only when he hushes it up', async () => {
  const hushed = await play('b2c09', {}, [/Pay the priest/]);
  assert.ok(hushed.game.state.sys.items.old_ducat);
  const open = await play('b2c09', {}, [/under the Prince's eye/]);
  assert.equal(open.game.state.sys.items.old_ducat, undefined);
});

test('chapter 10 plays through to chapter 11', async () => {
  for (const faction of [/Say yes, and mean it/, /Say yes, and mean none of it/, /Say no, courteously/]) {
    for (const truth of ['told', 'withheld', 'unseen']) {
      for (const prince of [/Tell him everything/, /faction, and that you are looking/, /went out for air/]) {
        const run = await play('b2c10', { 'b2.agent_truth': truth }, [faction, prince]);
        assert.equal(run.game.state.chapter, 'b2c11', String([faction, truth, prince]));
        clean(run.text);
      }
    }
  }
});

test('chapter 10 plays through when very hungry and for a woman', async () => {
  const hungry = await play('b2c10', { hunger: 95 }, [/Benedetto's back room/]);
  assert.equal(hungry.game.state.chapter, 'b2c11');
  clean(hungry.text);
  const woman = await play('b2c10', { 'b2.agent_truth': 'told' }, [], { hero: { ...HERO, gender: 'f' } });
  assert.equal(woman.game.state.chapter, 'b2c11');
  clean(woman.text);
});

test('chapter 10 records his answer to the faction and the ring', async () => {
  for (const [re, key, price, ring] of [[/Say yes, and mean it/, 'joined', 'paid', true], [/Say yes, and mean none of it/, 'feigned', 'paid', true], [/Say no, courteously/, 'refused', 'refused', false]]) {
    const run = await play('b2c10', {}, [re]);
    assert.equal(run.vars['b2.faction'], key);
    assert.equal(run.vars['b2.faction_price'], price);
    assert.equal(Boolean(run.game.state.sys.items.gray_ring), ring, key);
  }
});

test('chapter 10 records what he told the Prince', async () => {
  for (const [re, key] of [[/Tell him everything/, 'told'], [/faction, and that you are looking/, 'partial'], [/went out for air/, 'silent']]) {
    const run = await play('b2c10', {}, [re]);
    assert.equal(run.vars['b2.prince_told'], key);
  }
});

test('chapter 10 lets him ask all four questions before he answers', async () => {
  const run = await play('b2c10', {}, [/what, exactly, is coming/, /Ask about the gold/, /guest at the foot/, /what is wanted/, /Say no, courteously/]);
  assert.match(run.text, /Senate's own/);
  assert.match(run.text, /second seat in the Purse/);
  assert.equal(run.vars['b2.faction'], 'refused');
});

test('every flag these chapters set is registered with a quick start default', async () => {
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  for (const k of ['b2.clerk', 'b2.guccio', 'b2.ugolino', 'b2.agent_truth', 'b2.prisca_conspiracy', 'b2.faction', 'b2.faction_price', 'b2.prince_told']) {
    assert.ok(flags[k], k);
    assert.equal(flags[k].major, true, k);
    assert.ok(flags[k].values.includes(flags[k].default), k);
  }
});
