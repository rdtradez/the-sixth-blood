// Session 21: Book Two, chapters 7 and 8 (the scraped page, and the seller of thread). Played down their branches. (This file says what is guaranteed, not what happens.)

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
  return drive(game, frame, wants, stopAt ?? (chapter === 'b2c07' ? 'b2c08' : chapter === 'b2c08' ? 'b2c09' : null));
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

test('chapter 7 plays through to chapter 8 for every court history and the Velati terms', async () => {
  for (const asked of ['agreed', 'declined']) {
    for (const seat of ['sword', 'none']) {
      for (const sire of ['unknown', 'lied', 'deflected']) {
        for (const terms of ['open', 'bargained', 'refused']) {
          const run = await play('b2c07', { 'b2.prisca_asked': asked, 'b2.seat': seat, 'b2.sire_answer': sire, 'b2.watcher_terms': terms });
          assert.equal(run.game.state.chapter, 'b2c08', JSON.stringify([asked, seat, sire, terms]));
          clean(run.text);
        }
      }
    }
  }
});

test('chapter 7 plays through for a woman, very hungry, and every earlier oath and sun', async () => {
  const woman = await play('b2c07', {}, [/Find the clerk/], { hero: { ...HERO, gender: 'f' } });
  assert.equal(woman.game.state.chapter, 'b2c08');
  assert.match(woman.text, /Matteo Bonsi|clerk/);
  clean(woman.text);
  const hungry = await play('b2c07', { hunger: 95 }, [/Benedetto's back room/]);
  assert.equal(hungry.game.state.chapter, 'b2c08');
  clean(hungry.text);
  for (const oath of ['sworn', 'courteous', 'refused']) {
    for (const [sun, daylight] of [['shown', 'open'], ['refused', 'deputy']]) {
      const run = await play('b2c07', { 'b2.oath': oath, 'lc.sunwalk': sun, 'b2.daylight': daylight });
      assert.equal(run.game.state.chapter, 'b2c08');
      clean(run.text);
    }
  }
});

test('chapter 7 records the supper, the roll, Prisca and the clerk', async () => {
  for (const [re, key] of [[/Smooth it/, 'smoothed'], [/watch what each of them does/, 'watched'], [/more honest/, 'stoked']]) {
    const run = await play('b2c07', {}, [re]);
    assert.equal(run.vars['b2.supper'], key);
  }
  for (const [re, key] of [[/let you read it/, 'read'], [/copy the page yourself/, 'copied'], [/what he thinks the roll will say/, 'asked']]) {
    const run = await play('b2c07', {}, [/ask Messer Ottaviano for the roll/, re]);
    assert.equal(run.vars['b2.roll'], key);
  }
  const read = await play('b2c07', {}, [/ask Messer Ottaviano for the roll/, /let you read it/]);
  assert.match(read.text, /five seals/i);
  const asked = await play('b2c07', {}, [/ask Messer Ottaviano for the roll/, /what he thinks the roll will say/]);
  assert.doesNotMatch(asked.text, /The balance is Prisca's/);
  for (const [re, key] of [[/the name you were told not to give/, 'told'], [/an old fear/, 'withheld']]) {
    const run = await play('b2c07', {}, [/Go to Prisca/, re]);
    assert.equal(run.vars['b2.prisca_sixth'], key);
  }
  for (const [re, key] of [[/they may come to the door/, 'present'], [/they must stay away/, 'absent'], [/let them come or not as they like/, 'present']]) {
    const run = await play('b2c07', {}, [/Find the clerk/, re]);
    assert.equal(run.vars['b2.elder_witness'], key);
  }
});

test('chapter 7 has Prisca see the seal only if he has seen it, and read what he told her before', async () => {
  const seen = await play('b2c07', {}, [/ask Messer Ottaviano for the roll/, /let you read it/, /Go to Prisca/, /an old fear/]);
  assert.match(seen.text, /The balance is my house's/);
  const unseen = await play('b2c07', {}, [/Go to Prisca/, /an old fear/]);
  assert.doesNotMatch(unseen.text, /The balance is my house's/);
  for (const [value, re] of [['told', /already been told/], ['lied', /very good lie/], ['withheld', /did not tell her, in Rome/]]) {
    const run = await play('b2c07', { 'b1.maker_told': value }, [/Go to Prisca/]);
    assert.match(run.text, re, value);
  }
});

test('chapter 7 records what he gave the elder, and each gift', async () => {
  const told = await play('b2c07', {}, [/the stranger in the fire/]);
  assert.equal(told.vars['b2.answer'], 'told');
  assert.ok(told.game.state.sys.items.remembrancers_tally);
  assert.notEqual(told.vars['b2.berengaria_debt'], true);
  const traded = await play('b2c07', {}, [/that you will trade/]);
  assert.equal(traded.vars['b2.answer'], 'traded');
  assert.equal(traded.vars['b2.berengaria_debt'], true);
  assert.match(traded.text, /Brother Anselm/);
  assert.equal(traded.game.state.sys.items.remembrancers_tally, undefined);
  const closed = await play('b2c07', {}, [/not a matter that you can speak of/]);
  assert.equal(closed.vars['b2.answer'], 'closed');
  assert.match(closed.text, /two old things in a dark room/);
  assert.equal(closed.game.state.sys.items.remembrancers_tally, undefined);
});

test('chapter 7 reads what he told the court about his maker and his tablet', async () => {
  for (const [value, re] of [['unknown', /did not see your maker's face/], ['lied', /a Greek of the Scribe line/], ['deflected', /declined to say whose blood/]]) {
    const run = await play('b2c07', { 'b2.sire_answer': value });
    assert.match(run.text, re, value);
  }
  const scraped = await play('b2c07', { 'b1.tablet': 'scrape' }, [/the stranger in the fire/]);
  assert.match(scraped.text, /scraped the tablet clean/);
  const kept = await play('b2c07', { 'b1.tablet': 'keep' }, [/the stranger in the fire/]);
  assert.match(kept.text, /kept the tablet/);
});

test('chapter 7 records who he told at dawn', async () => {
  for (const [re, key] of [[/Go to the Prince/, 'prince'], [/Go to Prisca, and tell her/, 'prisca'], [/Tell no one/, 'none']]) {
    const run = await play('b2c07', {}, [re]);
    assert.equal(run.vars['b2.roll_told'], key);
  }
});

test('chapter 8 plays through and hands on to chapter 9', async () => {
  for (const told of ['prince', 'prisca', 'none']) {
    for (const wages of ['fair', 'hard', 'none']) {
      for (const captain of ['funded', 'listened', 'refused']) {
        const run = await play('b2c08', { 'b2.roll_told': told, 'b2.wool_wages': wages, 'b2.captain': captain, 'b2.loan': 'both' });
        assert.equal(run.game.state.chapter, 'b2c09');
        clean(run.text);
      }
    }
  }
});

test('chapter 8 plays through when very hungry and for a woman', async () => {
  const hungry = await play('b2c08', { hunger: 95 }, [/Take the cup/]);
  assert.equal(hungry.game.state.chapter, 'b2c09');
  clean(hungry.text);
  const woman = await play('b2c08', {}, [], { hero: { ...HERO, gender: 'f' } });
  assert.equal(woman.game.state.chapter, 'b2c09');
  clean(woman.text);
});

test('chapter 8 records the loan, the scale, the old books and the paper', async () => {
  for (const [re, key] of [[/at the house rate/, 'fair'], [/freely, with no pledge/, 'free'], [/does not lend upon rods/, 'refused']]) {
    const run = await play('b2c08', {}, [/Hear the thread seller/, re]);
    assert.equal(run.vars['b2.trader_loan'], key);
  }
  for (const [re, key] of [[/have the scale mended/i, 'weighed'], [/Say that the yard is in the right, but give/, 'trader'], [/stamped scale is the lawful one/, 'house']]) {
    const run = await play('b2c08', {}, [/dyer's yard/, re]);
    assert.equal(run.vars['b2.trader_scale'], key);
  }
  for (const [re, key] of [[/Say nothing, and have Benedetto close/, 'kept'], [/Take it to Prisca/, 'told']]) {
    const run = await play('b2c08', {}, [/old books/, re]);
    assert.equal(run.vars['b2.trader_ledger'], key);
  }
  for (const [re, key] of [[/Warn Ser Bartolo/, 'warned'], [/Buy a little of the paper/, 'profited'], [/heard nothing/, 'silent']]) {
    const run = await play('b2c08', {}, [/two factors|Ser Bartolo and Messer Raniero/, re]);
    assert.equal(run.vars['b2.pazzi_paper'], key);
  }
});

test('chapter 8 leaves the ledger and the dyer unseen when he does not go', async () => {
  const run = await play('b2c08', {}, [/Hear the thread seller/, /Take the two factors/, /Go to the dyer/]);
  assert.equal(run.vars['b2.trader_ledger'], 'unseen');
  const other = await play('b2c08', {}, [/old books/, /Hear the thread seller/, /Take the two factors/]);
  assert.equal(other.vars['b2.trader_scale'], 'unseen');
});

test('chapter 8 builds the hidden verdict from what he did', async () => {
  const warm = await play('b2c08', { 'b2.wool_wages': 'fair' }, [/Hear the thread seller/, /Go to the dyer/, /Take the two factors/, /at the house rate/, /have the scale mended/i, /Warn Ser Bartolo/, /Build something/]);
  assert.equal(warm.vars['b2.trader_regard'], 'warm');
  const cold = await play('b2c08', { 'b2.captain': 'funded', 'b2.wool_wages': 'hard' }, [/Hear the thread seller/, /Go to the dyer/, /Take the two factors/, /does not lend upon rods/, /stamped scale is the lawful one/, /Buy a little of the paper/, /Use it, to be obeyed/]);
  assert.equal(cold.vars['b2.trader_regard'], 'cold');
  const wary = await play('b2c08', {}, [/Hear the thread seller/, /Go to the dyer/, /Take the two factors/, /freely, with no pledge/, /Say that the yard is in the right, but give/, /heard nothing/, /Keep it, in the dark/]);
  assert.equal(wary.vars['b2.trader_regard'], 'wary');
});

test('chapter 8 records his answer and the coin, and a taken coin goes in the collection', async () => {
  for (const [re, key] of [[/Build something/, 'build'], [/Keep it, in the dark/, 'keep'], [/Give it where it was wanted/, 'give'], [/Use it, to be obeyed/, 'rule']]) {
    const run = await play('b2c08', {}, [re]);
    assert.equal(run.vars['b2.trader_answer'], key);
  }
  const taken = await play('b2c08', {}, [/Take it, and thank him/]);
  assert.equal(taken.vars['b2.trader_coin'], 'taken');
  assert.ok(taken.game.state.sys.items.merchants_token);
  const pushed = await play('b2c08', {}, [/Push it back/]);
  assert.equal(pushed.vars['b2.trader_coin'], 'refused');
  assert.equal(pushed.game.state.sys.items.merchants_token, undefined);
  const asked = await play('b2c08', {}, [/Ask him, plainly, who he is/]);
  assert.match(asked.text, /seller of thread/);
  assert.equal(asked.game.state.sys.items.merchants_token, undefined);
});

test('chapter 8 reads the side door only when he listened to the captain', async () => {
  const funded = await play('b2c08', { 'b2.captain': 'funded' });
  assert.match(funded.text, /I saw the man who came to your side door/);
  const refused = await play('b2c08', { 'b2.captain': 'refused' });
  assert.doesNotMatch(refused.text, /I saw the man who came to your side door/);
});

test('every flag these chapters set is registered with a quick start default', async () => {
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  const keys = ['b2.supper', 'b2.roll', 'b2.prisca_sixth', 'b2.elder_witness', 'b2.answer', 'b2.berengaria_debt', 'b2.roll_told', 'b2.trader_ledger', 'b2.pazzi_paper', 'b2.trader_regard', 'b2.trader_coin'];
  for (const k of keys) {
    assert.ok(flags[k], k);
    assert.equal(flags[k].major, true, k);
    if (flags[k].values) assert.ok(flags[k].values.includes(flags[k].default), k);
  }
  for (const k of ['b2.trader_loan', 'b2.trader_scale', 'b2.trader_answer']) {
    assert.ok(flags[k], k);
    assert.ok(flags[k].values.includes(flags[k].default), k);
  }
});
