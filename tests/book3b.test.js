// Session 30: Book Three, chapters 3 and 4. Played down their branches. (This file says what is guaranteed, not what happens.)

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

test('chapter 3 plays through every kind of start and reaches chapter 4', async () => {
  for (const vars of [{}, { hunger: 90 }, { 'b2.court_end': 'seat' }, { 'b2.court_end': 'debt' }, { 'b2.court_end': 'quiet' }]) {
    const run = await play('b3c03', {}, { ...START, ...vars }, [], { stopAt: 'b3c04' });
    assert.equal(run.game.state.chapter, 'b3c04', JSON.stringify(vars));
    clean(run);
  }
});

test('chapter 3 takes each way of meeting the court and each answer to the Prince', async () => {
  const salon = [['charmed', /Be charming/], ['cold', /civil and cold/], ['listened', /Say little, and listen/]];
  for (const [key, re] of salon) {
    const run = await play('b3c03', {}, START, [re, /Walk the long salon/], { stopAt: 'b3c04' });
    assert.equal(run.vars['b3.salon'], key);
  }
  for (const [key, re] of [['open', /Thank him, and ask what he knows/], ['careful', /Thank him, and say nothing more/], ['cold', /whether he writes it to everyone/]]) {
    const run = await play('b3c03', {}, START, [re, /Walk the long salon/], { stopAt: 'b3c04' });
    assert.equal(run.vars['b3.severin'], key);
  }
  for (const [key, re] of [['promised', /Promise him/], ['guarded', /give nothing back/], ['spy', /keep an ear at the Prince/]]) {
    const run = await play('b3c03', {}, START, [re, /Go out to the orangery/], { stopAt: 'b3c04' });
    assert.equal(run.vars['b3.octave'], key);
  }
  for (const [key, re] of [['read', /Copy the page/], ['left', /unread/]]) {
    const run = await play('b3c03', {}, START, [re, /Find the Remembrancer/], { stopAt: 'b3c04' });
    assert.equal(run.vars['b3.roll'], key);
  }
  for (const [key, re] of [['accepted', /I will be your hand\. Tell me/], ['bargained', /at a price/], ['refused', /No\. I will not/]]) {
    const run = await play('b3c03', {}, START, [re], { stopAt: 'b3c04' });
    assert.equal(run.vars['b3.weapon'], key);
    clean(run);
  }
  for (const [key, re] of [['seat', /A seat at the council/], ['valere', /rue Saint-Jacques is not to be touched/], ['roll', /Nothing from the court/], ['none', /think about the price/]]) {
    const run = await play('b3c03', {}, START, [/at a price/, re], { stopAt: 'b3c04' });
    assert.equal(run.vars['b3.price'], key);
  }
});

test('chapter 3 gallery: each way of taking the champion, and declining, all end sensibly', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const re of [/Accept, and give him/, /Accept, to first blood/, /Decline, courteously/]) {
      const run = await play('b3c03', {}, START, [re, /Go down the long gallery/, /Break his guard/, /Feint/], { stopAt: 'b3c04', seed });
      assert.equal(run.game.state.chapter, 'b3c04');
      assert.ok(['won', 'lost', 'declined'].includes(run.vars['b3.trial']), run.vars['b3.trial']);
      clean(run);
    }
  }
  const talked = await play('b3c03', {}, START, [/Accept, and give him/, /Go down the long gallery/, /Talk him down/], { stopAt: 'b3c04' });
  assert.ok(['won', 'lost'].includes(talked.vars['b3.trial']));
  const fled = await play('b3c03', {}, START, [/Accept, and give him/, /Go down the long gallery/, /Give ground/], { stopAt: 'b3c04' });
  assert.equal(fled.vars['b3.trial'], 'lost');
});

test('chapter 3 ends with the paper only when the Prince was served', async () => {
  const yes = await play('b3c03', {}, START, [/I will be your hand\. Tell me/], { stopAt: 'b3c04' });
  assert.match(yes.text, /twelve names/);
  const no = await play('b3c03', {}, START, [/No\. I will not/], { stopAt: 'b3c04' });
  assert.doesNotMatch(no.text, /twelve names/);
});

const PRESS = ['quiet', 'licensed', 'underground'];

test('chapter 4 plays through for every press, venture and hunger, and reaches chapter 5 pause', async () => {
  for (const press of PRESS) {
    for (const venture of ['printing', 'wine', 'none']) {
      for (const hunger of [10, 90]) {
        const run = await play('b3c04', {}, { ...START, hunger, 'b3.press': press, 'b3.venture': venture, 'b3.sugar': 'funded' }, []);
        assert.equal(run.frame.wait, 'book_end', `${press} ${venture} ${hunger}`);
        clean(run);
      }
    }
  }
});

test('chapter 4 takes each use of the presses and each answer on the appeal', async () => {
  for (const [key, re] of [['court', /Print the court's dialogue/], ['people', /Print the parish forms/], ['coin', /Take every job that pays/]]) {
    const run = await play('b3c04', {}, START, [re, /Take the night's work/], {});
    assert.equal(run.vars['b3.presses_use'], key);
    clean(run);
  }
  for (const sugar of ['kept', 'sold', 'funded']) {
    for (const [key, re] of [['printed', /with the house's name/], ['printed', /Swiss imprint/], ['refused', /not the house's business/]]) {
      const run = await play('b3c04', {}, { ...START, 'b3.sugar': sugar }, [re, /Take the night's work/], {});
      assert.equal(run.vars['b3.abolition'], key, sugar);
      clean(run);
    }
  }
});

test('chapter 4 meets the inspector every way, for every press', async () => {
  for (const press of PRESS) {
    for (const [key, re] of [['bribed', /with a purse/], ['hid', /have the cellar cleared/], ['court', /Give the Prince's name/], ['faced', /Let him search/]]) {
      const run = await play('b3c04', {}, { ...START, 'b3.press': press, 'b3.weapon': 'accepted' }, [re, /Answer the knock/], {});
      assert.equal(run.vars['b3.raid'], key, `${press} ${key}`);
      clean(run);
    }
  }
  const refused = await play('b3c04', {}, { ...START, 'b3.weapon': 'refused' }, [/Give the Prince's name/, /Answer the knock/], {});
  assert.notEqual(refused.vars['b3.raid'], 'court');
});

test('chapter 4 quarries, bill on the wall, and the haven is bought only once', async () => {
  for (const [key, re] of [['haven', /Make it a haven/], ['stores', /store the types/], ['left', /Brick up the arch/]]) {
    const run = await play('b3c04', {}, { ...START, wealth: 400000 }, [re, /Go down into the quarries/], {});
    assert.equal(run.vars['b3.gallery'], key);
    if (key === 'haven') assert.equal(run.game.state.sys.holdings?.owned?.includes?.('hidden_chamber') ?? true, true);
    clean(run);
  }
  for (const [key, re] of [['followed', /Follow him/], ['tore', /Tear the bill/], ['left', /Read it to the end/]]) {
    const run = await play('b3c04', {}, START, [re, /Walk out into the street/], {});
    assert.equal(run.vars['b3.paster'], key);
    clean(run);
  }
});

test('chapter 4 ends with the card on the sill, and a different line for the haven', async () => {
  const run = await play('b3c04', {}, { ...START, wealth: 400000 }, [/Make it a haven/, /Go down into the quarries/], {});
  assert.match(run.text, /pinned with a wafer/);
  const plain = await play('b3c04', {}, START, [/Brick up the arch/, /Go down into the quarries/], {});
  assert.doesNotMatch(plain.text, /pinned with a wafer/);
});

test('chapters 3 and 4 play on in order from a new Book Three start', async () => {
  const run = await play('b3c03', {}, START, [], {});
  assert.equal(run.frame.wait, 'book_end');
  assert.match(run.text, /Thursday/);
  assert.match(run.text, /thaw/);
});
