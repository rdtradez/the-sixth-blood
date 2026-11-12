// Session 29: Book Three, chapters 1 and 2. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

const WAKES = [
  {},
  { place: 'haven', steward: 'bank' },
  { place: 'collesanto', steward: 'keepers' },
  { place: 'tomb', steward: 'fiammetta' },
  { place: 'tomb', steward: 'prisca', outcome: 'prospered' },
  { place: 'haven', steward: 'keepers', outcome: 'losses' },
  { place: 'haven', steward: 'bank', outcome: 'woken_early', by: 'hunters' },
  { place: 'collesanto', steward: 'bank', outcome: 'woken_early', by: 'government' },
  { place: 'tomb', steward: 'keepers', outcome: 'woken_early', by: 'steward' },
];

test('Book Three lists its written chapters and is not yet finished', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'crown-of-ashes');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 6);
});

test('chapter 1 plays through for every kind of waking and reaches chapter 2', async () => {
  for (const wake of WAKES) {
    const run = await play('b3c01', wake, {}, [], { stopAt: 'b3c02' });
    assert.equal(run.game.state.chapter, 'b3c02', JSON.stringify(wake));
    clean(run);
  }
});

test('chapter 1 takes each way out of being woken early, and each way to eat', async () => {
  for (const [key, re] of [['fled', /Slip away in the dark/], ['fought', /fight your way out/], ['talked', /Talk\. Say what you can/]]) {
    for (const by of ['hunters', 'government', 'steward']) {
      const run = await play('b3c01', { place: 'tomb', steward: by === 'steward' ? 'keepers' : 'bank', outcome: 'woken_early', by }, { hunger: 10 }, [re], { stopAt: 'b3c02' });
      assert.equal(run.vars['b3.trouble'], key, `${by} ${key}`);
      assert.equal(run.game.state.chapter, 'b3c02');
    }
  }
  for (const [key, re] of [['animal', /young goat/], ['donor', /willing arm/], ['human', /passing strangers/], ['none', /Go without/]]) {
    const run = await play('b3c01', {}, { hunger: 95 }, [re], { stopAt: 'b3c02' });
    assert.equal(run.vars['b3.first_feed'], key);
  }
});

test('chapter 1 records the king, the books and the street', async () => {
  for (const [key, re] of [['bluffed', /spider/], ['asked', /Who is king of France now/], ['blustered', /to the king at once/]]) {
    const run = await play('b3c01', {}, {}, [re], { stopAt: 'b3c02' });
    assert.equal(run.vars['b3.king'], key);
  }
  const audited = await play('b3c01', {}, {}, [/Read it properly/, /Stay in the shadows|Buy a printed/], { stopAt: 'b3c02' });
  assert.equal(audited.vars['b3.books'], 'audited');
  const printed = await play('b3c01', {}, {}, [/Buy a printed paper/], { stopAt: 'b3c02' });
  assert.equal(printed.vars['b3.street'], 'printed');
  const spoke = await play('b3c01', { place: 'haven' }, {}, [/Speak to someone/], { stopAt: 'b3c02' });
  assert.equal(spoke.vars['b3.street'], 'spoke');
  for (const [key, re] of [['warm', /Write back warmly/], ['formal', /Write back formally/], ['silent', /Leave it unanswered/]]) {
    const run = await play('b3c01', {}, {}, [re], { stopAt: 'b3c02' });
    assert.equal(run.vars['b3.prisca_reply'], key);
  }
});

test('chapter 1 reads the investments of the sleep: plantations, the island and the ships', async () => {
  for (const [key, re] of [['kept', /Keep the shares, and take the dividend/], ['sold', /Sell the shares/], ['funded', /Friends of the Blacks, in secret/]]) {
    const run = await play('b3c01', { invest: ['plantations'] }, {}, [/Go through the books/, re], { stopAt: 'b3c02' });
    assert.equal(run.vars['b3.sugar'], key);
    assert.match(run.text, /four hundred and twelve/);
  }
  const noSugar = await play('b3c01', {}, {}, [/Go through the books/], { stopAt: 'b3c02' });
  assert.equal(noSugar.vars['b3.sugar'], 'unseen');
  assert.doesNotMatch(noSugar.text, /four hundred and twelve/);
  for (const [key, re] of [['refused', /Refuse\. Say that the field/], ['considered', /Answer politely/]]) {
    const run = await play('b3c01', { invest: ['new_amsterdam'] }, {}, [/Go through the books/, re], { stopAt: 'b3c02' });
    assert.equal(run.vars['b3.crane_offer'], key);
    assert.match(run.text, /Crane/);
  }
  const ships = await play('b3c01', { invest: ['atlantic_trade', 'plantations', 'new_amsterdam'] }, {}, [/Go through the books/], { stopAt: 'b3c02' });
  assert.match(ships.text, /Bordeaux/);
  assert.equal(ships.game.state.chapter, 'b3c02');
});

test('a quick start wake, with no investments, leaves the sugar and the island unseen', async () => {
  const quick = await play('b3c01', { quick: true, invest: [] }, {}, [/Go through the books/], { stopAt: 'b3c02' });
  assert.equal(quick.vars['b3.sugar'], 'unseen');
  assert.equal(quick.vars['b3.crane_offer'], 'unseen');
});

test('chapter 2 plays through for every waking, reaches the pause, and is free of dashes and braces', async () => {
  for (const wake of WAKES) {
    for (const valerii of ['sworn', 'trusted', 'distant']) {
      const run = await play('b3c02', wake, { 'b2.valerii': valerii, wealth: 40000 });
      assert.equal(run.frame.pending, true, JSON.stringify(wake));
      assert.match(run.text, /Hôtel de Saint-Aubin/);
      clean(run);
    }
  }
});

test('chapter 2 records the greeting, the oath, the press, the bread and the venture', async () => {
  for (const [key, re] of [['monseigneur', /Bow low and say/], ['monsieur', /Say "Monsieur"/], ['asked', /Ask whether a title/]]) {
    const r = await play('b3c02', {}, {}, [re]);
    assert.equal(r.vars['b3.titles'], key);
  }
  for (const [key, re] of [['quiet', /Print the almanacs/], ['licensed', /royal permission/], ['underground', /foreign imprint/]]) {
    const run = await play('b3c02', {}, {}, [/Go down into the shop/, re]);
    assert.equal(run.vars['b3.press'], key);
  }
  for (const [key, re] of [['gave', /Give what you have/], ['fed', /take what you need from a drunk/], ['passed', /Stand and watch/]]) {
    const run = await play('b3c02', {}, { hunger: 10 }, [/Go out into the frost/, re]);
    assert.equal(run.vars['b3.bread'], key);
  }
  for (const [key, re] of [['sworn', /Let them say it/], ['trusted', /soup, and not a sacrament/], ['distant', /keep it brief/]]) {
    const run = await play('b3c02', {}, { 'b2.valerii': 'sworn' }, [/Sit down to supper/, re]);
    assert.equal(run.vars['b3.valere'], key);
  }
  for (const [key, re] of [['sworn', /Tell her the truth/], ['trusted', /family story/], ['distant', /patron of the house, and no more/]]) {
    const run = await play('b3c02', { steward: 'bank' }, { 'b2.valerii': 'distant' }, [/Sit down to supper/, re]);
    assert.equal(run.vars['b3.valere'], key);
  }
});

test('chapter 2 puts money into the presses or the wine only when the house can afford it', async () => {
  const printing = await play('b3c02', {}, { wealth: 40000 }, [/Go over the books/, /Put the money of the house into the presses/]);
  assert.equal(printing.vars['b3.venture'], 'printing');
  assert.ok(printing.game.state.sys.ventures['paris.printing']);
  const wine = await play('b3c02', {}, { wealth: 40000 }, [/Go over the books/, /Put the money into the wine/]);
  assert.equal(wine.vars['b3.venture'], 'wine');
  assert.ok(wine.game.state.sys.ventures['paris.wine']);
  const broke = await play('b3c02', {}, { wealth: 0 }, [/Go over the books/]);
  assert.equal(broke.vars['b3.venture'], 'none');
});

test('chapter 2 charts the house, the presses, the counting room and the court', async () => {
  const run = await play('b3c02', {}, { wealth: 40000 }, [/Go down into the shop/, /Go over the books/]);
  const sites = run.game.state.sys.lore.sites;
  for (const id of ['paris.valere', 'paris.presses', 'paris.counting', 'paris.court']) assert.ok(sites[id], id);
});
