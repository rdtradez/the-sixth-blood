// Session 20: Book Two, chapters 5 and 6 (the bank by day, and the watcher). Played down their branches. (This file says what is guaranteed, not what happens.)

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

async function play(chapter, vars, wants = [], { stopAt = null, seed = 3, wake = {}, hero = HERO } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', years: 1410, ...wake };
  for (const [k, v] of Object.entries({ wealth: 50000, ...vars })) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt ?? (chapter === 'b2c06' ? 'b2c07' : null));
}

const clean = (text) => {
  assert.doesNotMatch(text, /[–—]/);
  assert.doesNotMatch(text, /[{}]/);
  assert.doesNotMatch(text, /\$ do /);
};

const DEALS = ['partner', 'rival', 'quiet'];
const SUNS = ['agreed', 'bargained', 'kept'];

test('Book Two lists sixteen chapters and still pauses after the last', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'blood-and-gold');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 16);
});

test('chapter 5 plays through to chapter 6 for every deal and bargain about the sun', async () => {
  for (const deal of DEALS) {
    for (const sun of SUNS) {
      const run = await play('b2c05', { 'b2.prisca_deal': deal, 'b2.prisca_sun': sun, 'b2.prisca_asked': deal === 'rival' ? 'declined' : 'agreed' }, [], { stopAt: 'b2c06' });
      assert.equal(run.game.state.chapter, 'b2c06', JSON.stringify([deal, sun]));
      clean(run.text);
    }
  }
});

test('chapter 5 plays through on an empty purse and when very hungry', async () => {
  const poor = await play('b2c05', { wealth: 0 }, [], { stopAt: 'b2c06' });
  assert.equal(poor.game.state.chapter, 'b2c06');
  clean(poor.text);
  const hungry = await play('b2c05', { hunger: 95 }, [/Take the cup/], { stopAt: 'b2c06' });
  assert.equal(hungry.game.state.chapter, 'b2c06');
  clean(hungry.text);
  const beast = await play('b2c05', { hunger: 95 }, [/stray in the lane/, /Go without/], { stopAt: 'b2c06' });
  assert.equal(beast.game.state.chapter, 'b2c06');
});

test('chapter 5 records whose letters the house carried', async () => {
  for (const [re, key] of [[/Carry the Medici/, 'medici'], [/Carry the Pazzi/, 'pazzi'], [/Carry both/, 'both'], [/Carry neither/, 'neither']]) {
    const run = await play('b2c05', {}, [/Take the chair/, re], { stopAt: 'b2c06' });
    assert.equal(run.vars['b2.loan'], key);
  }
});

test('chapter 5 records the wool workshop, the portrait and the stranger', async () => {
  for (const [re, key] of [[/what Ser Nofri paid/, 'fair'], [/what the other shops pay/, 'hard'], [/Walk away from the whole matter/, 'none']]) {
    const run = await play('b2c05', {}, [/wool district/, re], { stopAt: 'b2c06' });
    assert.equal(run.vars['b2.wool_wages'], key);
  }
  for (const [re, key] of [[/Sit for him, and take/, 'sat'], [/not be in it/, 'refused'], [/less of yours/, 'disguised']]) {
    const run = await play('b2c05', {}, [/bottega/, re], { stopAt: 'b2c06' });
    assert.equal(run.vars['b2.portrait'], key);
  }
  for (const [re, key] of [[/Fund the company/, 'funded'], [/who these friends are/, 'listened'], [/Refuse, and have/, 'refused']]) {
    const run = await play('b2c05', {}, [/stranger who waits/, re], { stopAt: 'b2c06' });
    assert.equal(run.vars['b2.captain'], key);
  }
});

test('buying the workshop and funding the company spend money, and walking away does not', async () => {
  const bought = await play('b2c05', {}, [/wool district/, /what Ser Nofri paid/], { stopAt: 'b2c06' });
  const skipped = await play('b2c05', {}, [/wool district/, /Walk away/], { stopAt: 'b2c06' });
  assert.ok(bought.vars.wealth < skipped.vars.wealth);
});

test('the portrait enters the collection only when he sat for it as himself', async () => {
  for (const [re, held] of [[/Sit for him, and take/, true], [/not be in it/, false], [/less of yours/, false]]) {
    const run = await play('b2c05', {}, [/bottega/, re], { stopAt: 'b2c06' });
    assert.equal(Boolean(run.game.state.sys.items.florence_portrait), held);
  }
});

test('the noon signing ends in each way he can swear the oath, and each has its own scene', async () => {
  const lines = { open: /full sun|walk out into it|step out into it/i, shaded: /awning goes down/, deputy: /Benedetto goes out in his best coat/ };
  for (const [re, key] of [[/Walk out onto the marble/, 'open'], [/Take the shaded edge/, 'shaded'], [/Send Benedetto to swear/, 'deputy']]) {
    const run = await play('b2c05', {}, [re], { stopAt: 'b2c06' });
    assert.equal(run.vars['b2.daylight'], key);
    assert.match(run.text, lines[key], key);
  }
});

test('the sun costs hunger at noon and the open oath costs Secrecy', async () => {
  const open = await play('b2c05', { secrecy: 60 }, [/Walk out onto the marble/], { stopAt: 'b2c06' });
  const deputy = await play('b2c05', { secrecy: 60 }, [/Send Benedetto to swear/], { stopAt: 'b2c06' });
  assert.ok(open.vars.secrecy < deputy.vars.secrecy);
});

test('chapter 5 ends by meeting the watcher, for a man or a woman', async () => {
  const man = await play('b2c05', {}, [], { stopAt: 'b2c06' });
  assert.ok(man.game.state.sys.people.watcher);
  assert.match(man.text, /young woman/);
  const woman = await play('b2c05', {}, [], { stopAt: 'b2c06', hero: { ...HERO, gender: 'f' } });
  assert.match(woman.text, /young man/);
  clean(woman.text);
});

test('chapter 5 reads each deal, and the court letter only when he agreed to look into the quarrel', async () => {
  const partner = await play('b2c05', { 'b2.prisca_deal': 'partner' }, [], { stopAt: 'b2c06' });
  assert.match(partner.text, /two seals on one door/);
  const rival = await play('b2c05', { 'b2.prisca_deal': 'rival' }, [], { stopAt: 'b2c06' });
  assert.match(rival.text, /forty paces from the door/);
  const quiet = await play('b2c05', { 'b2.prisca_deal': 'quiet' }, [], { stopAt: 'b2c06' });
  assert.match(quiet.text, /not a partnership/);
  const agreed = await play('b2c05', { 'b2.prisca_asked': 'agreed' }, [], { stopAt: 'b2c06' });
  assert.match(agreed.text, /offers the Signor del Colle a seat at a dinner/);
  const declined = await play('b2c05', { 'b2.prisca_asked': 'declined' }, [], { stopAt: 'b2c06' });
  assert.doesNotMatch(declined.text, /offers the Signor del Colle a seat at a dinner/);
});

test('chapter 6 plays through and reaches chapter 7 for every sun and watchers history', async () => {
  for (const daylight of ['open', 'shaded', 'deputy']) {
    for (const watchers of ['funded', 'warned', 'silent', 'none']) {
      const run = await play('b2c06', { 'b2.daylight': daylight, 'lc.watchers': watchers });
      assert.equal(run.game.state.chapter, 'b2c07', JSON.stringify([daylight, watchers]));
      clean(run.text);
    }
  }
});

test('chapter 6 plays through when very hungry and for a woman', async () => {
  const hungry = await play('b2c06', { hunger: 95 }, [/Take the cup/]);
  assert.equal(hungry.game.state.chapter, 'b2c07');
  clean(hungry.text);
  const woman = await play('b2c06', {}, [], { hero: { ...HERO, gender: 'f' } });
  assert.match(woman.text, /Matteo Bonsi/);
  assert.equal(woman.game.state.chapter, 'b2c07');
  clean(woman.text);
  const man = await play('b2c06', {});
  assert.match(man.text, /Allegra Bonsi/);
});

test('chapter 6 records how he met the clerk, what he did with the book and with Vieri', async () => {
  for (const [re, key] of [[/looking for them too/, 'spoke'], [/take the book out of their hands/, 'caught'], [/wait for them to speak/, 'waited']]) {
    const run = await play('b2c06', {}, [/river stair/, re]);
    assert.equal(run.vars['b2.watcher_meet'], key);
  }
  for (const [re, key] of [[/Read it through/, 'read'], [/Copy out the last page/, 'copied'], [/without reading any of it/, 'left']]) {
    const run = await play('b2c06', {}, [/clerk's rooms/, re]);
    assert.equal(run.vars['b2.watcher_book'], key);
  }
  for (const [re, key] of [[/Step between him/, 'shielded'], [/clerk is yours/, 'claimed'], [/he may do as he likes/, 'ignored']]) {
    const run = await play('b2c06', {}, [/lanes behind the Badia/, re]);
    assert.equal(run.vars['b2.vieri_watch'], key);
  }
});

test('chapter 6 reads what he did about the watchers of the Aventine and the book he read', async () => {
  for (const [value, re] of [['funded', /he paid for the book/], ['warned', /he warned us before the Goths/], ['none', /did not meet him/], ['silent', /did not answer/]]) {
    const run = await play('b2c06', { 'lc.watchers': value }, [/clerk's rooms/]);
    assert.match(run.text, re, value);
  }
  const read = await play('b2c06', {}, [/clerk's rooms/, /Read it through/]);
  assert.match(read.text, /I put the lamp so that you could/);
  const left = await play('b2c06', {}, [/clerk's rooms/, /without reading any of it/]);
  assert.match(left.text, /I put a hair across the cover/);
});

test('chapter 6 records the terms and whether something begins', async () => {
  for (const [re, key] of [[/openly, and that you will not hide/, 'open'], [/see what they write/, 'bargained'], [/go back to Rome/, 'refused']]) {
    const run = await play('b2c06', {}, [re]);
    assert.equal(run.vars['b2.watcher_terms'], key);
  }
  const begun = await play('b2c06', {}, [/see the bakery/]);
  assert.equal(begun.vars['b2.watcher_bond'], 'begun');
  assert.equal(begun.game.state.sys.romances.watcher?.state, 'courting');
  const guarded = await play('b2c06', {}, [/the matter is a private one/]);
  assert.equal(guarded.vars['b2.watcher_bond'], 'guarded');
  assert.equal(guarded.game.state.sys.romances.watcher, undefined);
});

test('every flag these chapters set is registered with a quick start default', async () => {
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  const keys = ['b2.loan', 'b2.wool_wages', 'b2.portrait', 'b2.captain', 'b2.daylight', 'b2.watcher_meet', 'b2.watcher_book', 'b2.vieri_watch', 'b2.watcher_terms', 'b2.watcher_bond'];
  for (const k of keys) {
    assert.ok(flags[k], k);
    assert.equal(flags[k].major, true, k);
    assert.ok(flags[k].values.includes(flags[k].default), k);
  }
});
