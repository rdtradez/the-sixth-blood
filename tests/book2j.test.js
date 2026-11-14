// Session 27: Book Two, chapters 19 and 20 (the font, and the long quiet). Played down their branches. (This file says what is guaranteed, not what happens.)

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

async function play(chapter, vars, wants = [], { stopAt = null, seed = 3, hero = HERO, sys = null } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', years: 1410 };
  for (const [k, v] of Object.entries({ wealth: 50000, ...vars })) dev.setVar(game, k, v);
  if (sys) sys(game);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt ?? (chapter === 'b2c19' ? 'b2c20' : null));
}

const clean = (text) => {
  assert.doesNotMatch(text, /[–—]/);
  assert.doesNotMatch(text, /[{}]/);
  assert.doesNotMatch(text, /\$ do /);
};

test('Book Two is finished at twenty chapters, with its journal and recap', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'blood-and-gold');
  assert.equal(book.incomplete, false);
  assert.equal(book.chapterCount, 20);
  const manifest = JSON.parse(await readFile(join(root, 'content/manifest.json'), 'utf8'));
  const b2 = manifest.books.find((b) => b.id === 'blood-and-gold');
  assert.equal(b2.journal, 'journal/blood-and-gold.tsb');
  assert.ok(b2.recap.length > 100);
});

test('chapter 19 plays through to chapter 20 for every Merchant tone, stance and answer', async () => {
  for (const regard of ['warm', 'wary', 'cold']) {
    for (const stance of [/glad to know/, /Say nothing, and look/, /the clerk is dead/]) {
      for (const ask of [/roll/, /about Prisca/, /man in gray/, /Ask nothing/]) {
        const run = await play('b2c19', { 'b2.trader_regard': regard }, [stance, ask]);
        assert.equal(run.game.state.chapter, 'b2c20', String([regard, stance, ask]));
        clean(run.text);
      }
    }
  }
});

test('chapter 19 records the Baptistery answers', async () => {
  const cases = [
    [/glad to know/, 'b2.merchant_stance', 'open'],
    [/Say nothing, and look/, 'b2.merchant_stance', 'guarded'],
    [/the clerk is dead/, 'b2.merchant_stance', 'angry'],
    [/Ask about the roll/, 'b2.merchant_learned', 'roll'],
    [/Ask about Prisca/, 'b2.merchant_learned', 'prisca'],
    [/Ask about the man in gray/, 'b2.merchant_learned', 'figure'],
    [/Ask nothing/, 'b2.merchant_learned', 'none'],
  ];
  for (const [want, key, value] of cases) {
    const run = await play('b2c19', {}, [want]);
    assert.equal(run.vars[key], value, key + ' ' + value);
    assert.equal(run.game.state.sys.originals.merchant.state, 'revealed');
  }
});

test('chapter 19 records every door and the Merchant fate, and the fate is always set', async () => {
  const cases = [
    [/Go to the bank/, /Sit with her/, 'b2.prisca_maker', 'silent'],
    [/Go to the bank/, /Tell her that you will be gone/, 'b2.prisca_maker', 'silent'],
    [/Go to the Prince/, /Accept a place/, 'b2.court_end', 'seat'],
    [/Go to the Prince/, /debt be written/, 'b2.court_end', 'debt'],
    [/Go to the Prince/, /wish to take nothing/, 'b2.court_end', 'quiet'],
    [/lodging over the dyer/, /Sit by/, 'b2.clerk_wake', 'stayed'],
    [/lodging over the dyer/, /bar the door/, 'b2.clerk_wake', 'hidden'],
    [/lodging over the dyer/, /Leave a letter/, 'b2.clerk_wake', 'warned'],
  ];
  for (const [door, answer, key, value] of cases) {
    const run = await play('b2c19', { 'b2.merchant_learned': 'none' }, [/Ask nothing/, door, answer]);
    assert.equal(run.vars[key], value, key + ' ' + value);
    clean(run.text);
  }
  const asked = await play('b2c19', {}, [/Ask about Prisca/, /Go to the bank/, /Ask her about the first night/]);
  assert.equal(asked.vars['b2.prisca_maker'], 'asked');
  const fates = [
    [/Keep it/, 'kept', 'kept_secret'],
    [/Take it to Prisca/, 'exposed', 'exposed'],
    [/Stand beside him/, 'allied', 'allied'],
  ];
  for (const [want, flag, fate] of fates) {
    const run = await play('b2c19', {}, [want]);
    assert.equal(run.vars['b2.merchant_fate'], flag);
    assert.equal(run.game.state.sys.originals.merchant.fate, fate);
    clean(run.text);
  }
});

test('chapter 19 offers the girl every answer, and the gift only when he can give it', async () => {
  const sired = await play('b2c19', { 'b2.sire': 'sired' }, [/Ask nothing/, /Go to the girl/]);
  assert.equal(sired.vars['b2.fiammetta_end'], 'sired');
  for (const sire of ['later', 'refused']) {
    const given = await play('b2c19', { 'b2.sire': sire }, [/Ask nothing/, /Go to the girl/, /Do it\./]);
    assert.equal(given.vars['b2.fiammetta_end'], 'given');
    const kept = await play('b2c19', { 'b2.sire': sire }, [/Ask nothing/, /Go to the girl/, /swear her to the hill/]);
    assert.equal(kept.vars['b2.fiammetta_end'], 'kept');
    const refused = await play('b2c19', { 'b2.sire': sire }, [/Ask nothing/, /Go to the girl/, /tell her why/]);
    assert.equal(refused.vars['b2.fiammetta_end'], 'refused');
    clean(given.text + kept.text + refused.text);
  }
});

test('chapter 19 ends the clerk romance as turned, and leaves doors unseen when they are skipped', async () => {
  const begun = await play('b2c19', {}, [/Ask nothing/], { sys: (g) => { g.state.sys.romances.watcher = { state: 'courting', book: 'blood-and-gold', since: 1, ending: '' }; } });
  assert.equal(begun.game.state.sys.romances.watcher.ending, 'turned');
  const none = await play('b2c19', {}, [/Ask nothing/]);
  assert.equal(none.game.state.sys.romances.watcher, undefined, 'no romance, no ending');
  const skipped = await play('b2c19', {}, [/Ask nothing/, /Go to the bank/, /lodging over the dyer/, /Go to the girl/]);
  assert.equal(skipped.vars['b2.court_end'], 'unseen');
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  for (const k of ['b2.prisca_maker', 'b2.court_end', 'b2.clerk_wake', 'b2.fiammetta_end']) assert.ok(flags[k].values.includes('unseen'), k);
});

test('chapter 19 plays through when very hungry and for a woman', async () => {
  const hungry = await play('b2c19', { hunger: 95 }, [/Benedetto's back room/]);
  clean(hungry.text);
  const woman = await play('b2c19', {}, [], { hero: { ...HERO, gender: 'f' } });
  clean(woman.text);
  assert.equal(woman.game.state.chapter, 'b2c20');
});

test('chapter 20 ends the book, sleeps to Paris and writes the journal', async () => {
  const run = await play('b2c20', {});
  assert.equal(run.frame.wait, 'book_end');
  clean(run.text);
  const wake = run.game.state.sys.sleep.wake;
  assert.equal(wake.gap, 'florence_to_paris');
  assert.equal(wake.years, 310);
  assert.equal(run.game.state.booksDone.includes('blood-and-gold'), true);
  assert.ok(run.game.state.journal.some((e) => e.kind === 'velati' && e.book === 'blood-and-gold'), 'the journal entry is written');
  assert.equal(run.game.library().find((b) => b.id === 'crown-of-ashes').unlocked, true);
});

test('chapter 20 plays every last night, steward, orders, guard and letter', async () => {
  const nights = [/Spend it with Ginevra/, /Spend it with Fiammetta/, /with both/, /Spend it alone/];
  for (const end of ['sired', 'given', 'kept', 'refused']) {
    for (const night of nights) {
      const run = await play('b2c20', { 'b2.fiammetta_end': end, 'b2.court_end': 'seat', 'b2.merchant_fate': 'allied', 'b2.clerk_wake': 'stayed' }, [night]);
      assert.equal(run.frame.wait, 'book_end', String([end, night]));
      clean(run.text);
    }
  }
  const stewards = [
    [/Merchant house, as a bank/, 'bank'],
    [/The Valerio keepers/, 'keepers'],
  ];
  for (const [want, who] of stewards) {
    const run = await play('b2c20', {}, [want], { sys: (g) => { g.state.sys.circle.ginevra = { kind: 'keeper', status: 'active', line: 'human', role: 'matriarch', loyalty: 70, tier: 0, joined: 'blood-and-gold' }; } });
    const h = run.game.state.sys.sleep.history.at(-1);
    assert.equal(h.steward, who);
    assert.equal(h.gap, 'florence_to_paris');
  }
  for (const orders of [/Play it safe/, /Grow it aggressively/, /dark ventures/]) {
    const run = await play('b2c20', {}, [orders]);
    assert.equal(run.frame.wait, 'book_end');
  }
  const bare = await play('b2c20', { wealth: 5000 }, [/That will do/]);
  const guarded = await play('b2c20', { wealth: 5000 }, [/Lay traps/, /Pay the people/, /Hire guardians/]);
  assert.ok(guarded.game.state.sys.sleep.history.at(-1).before < bare.game.state.sys.sleep.history.at(-1).before, 'the guards cost coin');
  const invested = await play('b2c20', {}, [/Put a share into ships/, /Buy land in the far north west/]);
  assert.ok(invested.game.state.sys.sleep.history.at(-1).invest.includes('atlantic_trade'));
});

test('chapter 20 records the letter and the last night', async () => {
  const left = await play('b2c20', {}, [/Write a letter for the clerk/]);
  assert.equal(left.vars['b2.agent_letter'], 'left');
  const none = await play('b2c20', {}, [/Write nothing/]);
  assert.equal(none.vars['b2.agent_letter'], 'none');
  const both = await play('b2c20', {}, [/with both/]);
  assert.equal(both.vars['b2.last_night'], 'both');
});

test('the journal for Book Two reads the earlier choices', async () => {
  const run = await play('b2c20', { 'b2.agent_end': 'truth', 'b2.elevation': 'giuliano', 'b2.watcher_terms': 'open' });
  const entry = run.game.state.journal.find((e) => e.kind === 'velati' && e.book === 'blood-and-gold');
  assert.match(entry.text, /held him till it was over/);
  assert.match(entry.text, /first true thing/);
  assert.doesNotMatch(entry.text, /[–—{}]/);
});
