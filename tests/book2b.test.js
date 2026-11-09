// Session 19: Book Two, chapters 3 and 4 (the court and Prisca). Played down their branches. (This file says what is guaranteed, not what happens.)

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

async function play(chapter, vars, wants = [], { stopAt = null, seed = 3, wake = {} } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', years: 1410, ...wake };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt);
}

const clean = (text) => {
  assert.doesNotMatch(text, /[–—]/);
  assert.doesNotMatch(text, /[{}]/);
  assert.doesNotMatch(text, /\$ do /);
};

const WAKES = [{}, { place: 'collesanto', steward: 'keepers' }, { place: 'tomb', steward: 'prisca' }];
const REPLIES = ['warm', 'formal', 'silent'];
const FRIARS = ['charmed', 'paid', 'cowed', 'hidden'];

test('Book Two now lists six chapters and still pauses after the last', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'blood-and-gold');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 6);
});

test('chapter 3 plays through to chapter 4 for every waking, reply and friar outcome', async () => {
  for (const wake of WAKES) {
    for (const reply of REPLIES) {
      const friar = FRIARS[REPLIES.indexOf(reply)];
      const run = await play('b2c03', { 'b2.prisca_reply': reply, 'b2.friar': friar }, [], { stopAt: 'b2c04', wake });
      assert.equal(run.game.state.chapter, 'b2c04', JSON.stringify([wake, reply]));
      clean(run.text);
    }
  }
});

test('every friar outcome reaches its own line at court', async () => {
  const lines = { charmed: /a rare report/, paid: /a most generous report/, cowed: /sleeping rather badly/, hidden: /tidied room/ };
  for (const friar of FRIARS) {
    const run = await play('b2c03', { 'b2.friar': friar }, [], { stopAt: 'b2c04' });
    assert.match(run.text, lines[friar], friar);
  }
});

test('chapter 3 records the briefing, the licence and the rumor', async () => {
  const careful = await play('b2c03', {}, [/Go to Prisca's door/, /Say that you will be careful/], { stopAt: 'b2c04' });
  assert.equal(careful.vars['b2.prisca_brief'], 'heeded');
  const scoffed = await play('b2c03', {}, [/Go to Prisca's door/, /older than his house/], { stopAt: 'b2c04' });
  assert.equal(scoffed.vars['b2.prisca_brief'], 'scoffed');
  const skipped = await play('b2c03', {}, [/Walk the lanes/, /Let Benedetto/, /Cross the Ponte Vecchio/], { stopAt: 'b2c04' });
  assert.equal(skipped.vars['b2.prisca_brief'], 'skipped');
  for (const [re, key] of [[/Buy a licence/, 'bought'], [/answer to no ledger/, 'refused'], [/take what you need/, 'poached']]) {
    const run = await play('b2c03', { wealth: 5000 }, [/Let Benedetto/, re], { stopAt: 'b2c04' });
    assert.equal(run.vars['b2.licence'], key);
  }
  const heard = await play('b2c03', {}, [/Cross the Ponte Vecchio/, /Stay in the shadow/], { stopAt: 'b2c04' });
  assert.equal(heard.vars['b2.pazzi_heard'], true);
  const unheard = await play('b2c03', {}, [/Cross the Ponte Vecchio/, /Buy a cup of wine/], { stopAt: 'b2c04' });
  assert.notEqual(unheard.vars['b2.pazzi_heard'], true);
});

test('the lane test ends in one of its outcomes for several seeds', async () => {
  const seen = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const run = await play('b2c03', {}, [/Walk the lanes/, /Let him come/], { stopAt: 'b2c04', seed });
    assert.ok(['bested', 'shown', 'lost'].includes(run.vars['b2.test']), String(run.vars['b2.test']));
    clean(run.text);
    seen.add(run.vars['b2.test']);
  }
  const shown = await play('b2c03', {}, [/Walk the lanes/, /let the old blood show/], { stopAt: 'b2c04' });
  assert.equal(shown.vars['b2.test'], 'shown');
  const declined = await play('b2c03', {}, [/Walk the lanes/, /Walk on/], { stopAt: 'b2c04' });
  assert.equal(declined.vars['b2.test'], 'declined');
});

test('chapter 3 records the oath, the answer about his maker and the seat', async () => {
  for (const [re, key] of [[/Kneel/, 'sworn'], [/Bow, as a guest/, 'courteous'], [/not knelt to any man/, 'refused']]) {
    const run = await play('b2c03', {}, [re], { stopAt: 'b2c04' });
    assert.equal(run.vars['b2.oath'], key);
  }
  for (const [re, key] of [[/do not know/, 'unknown'], [/Give him a name/, 'lied'], [/poor sort of court/, 'deflected']]) {
    const run = await play('b2c03', {}, [re], { stopAt: 'b2c04' });
    assert.equal(run.vars['b2.sire_answer'], key);
  }
  const sword = await play('b2c03', {}, [/Take the sword/], { stopAt: 'b2c04' });
  assert.equal(sword.vars['b2.seat'], 'sword');
  assert.match(sword.text, /I did ask you not to/);
  const none = await play('b2c03', {}, [/Refuse it, and say that you came to be a guest/], { stopAt: 'b2c04' });
  assert.equal(none.vars['b2.seat'], 'none');
  assert.doesNotMatch(none.text, /I did ask you not to/);
});

test('chapter 3 handles a very hungry hero', async () => {
  const run = await play('b2c03', { hunger: 95 }, [/Take a drunk/], { stopAt: 'b2c04' });
  assert.equal(run.game.state.chapter, 'b2c04');
  clean(run.text);
});

test('chapter 4 plays through and reaches chapter 5', async () => {
  for (const wake of WAKES) {
    for (const seat of ['sword', 'none']) {
      const run = await play('b2c04', { 'b2.seat': seat, 'b2.oath': seat === 'sword' ? 'sworn' : 'refused' }, [], { wake, stopAt: 'b2c05' });
      assert.equal(run.game.state.chapter, 'b2c05');
      clean(run.text);
    }
  }
});

test('chapter 4 records the deal and the asking', async () => {
  for (const [re, key] of [[/^Partner/, 'partner'], [/^Rival/, 'rival'], [/^Quiet/, 'quiet']]) {
    const run = await play('b2c04', {}, [re]);
    assert.equal(run.vars['b2.prisca_deal'], key);
  }
  const agreed = await play('b2c04', {}, [/find out who is keeping it warm/]);
  assert.equal(agreed.vars['b2.prisca_asked'], 'agreed');
  const declined = await play('b2c04', {}, [/quarrels are not yours/]);
  assert.equal(declined.vars['b2.prisca_asked'], 'declined');
  const heard = await play('b2c04', { 'b2.pazzi_heard': true }, [/find out who is keeping it warm/]);
  assert.match(heard.text, /what you heard on the bridge/);
});

test('chapter 4 records the books, the sun and her past', async () => {
  const taken = await play('b2c04', {}, [/Ask to see the books/, /trust her/]);
  assert.equal(taken.vars['b2.prisca_books'], 'taken');
  const pressed = await play('b2c04', {}, [/Ask to see the books/, /Put your finger on the line/, /well done/]);
  assert.equal(pressed.vars['b2.prisca_books'], 'pressed');
  const demanded = await play('b2c04', {}, [/Ask to see the books/, /Put your finger on the line/, /want it back/]);
  assert.equal(demanded.vars['b2.prisca_books'], 'demanded');
  const audited = await play('b2c04', { 'b2.books': 'audited' }, [/Ask to see the books/, /trust her/]);
  assert.match(audited.text, /You found it, in the first night/);
  for (const [re, key] of [[/house's daylight, and gladly/, 'agreed'], [/price is a share/, 'bargained'], [/the sun is yours/, 'kept']]) {
    const run = await play('b2c04', {}, [/counting floor/, re]);
    assert.equal(run.vars['b2.prisca_sun'], key);
  }
  for (const [re, key] of [[/tell you, all of it/, 'asked'], [/does not have to/, 'spared'], [/your own sleep first/, 'shared']]) {
    const run = await play('b2c04', {}, [/her own rooms/, re]);
    assert.equal(run.vars['b2.prisca_past'], key);
  }
});

test('chapter 4 reads what he did with the Emporium house', async () => {
  for (const [value, re] of [['saved', /You saved the house/], ['burned', /You burned the house/], ['sold', /You sold the house/], ['unmet', /since the house came north/]]) {
    const run = await play('b2c04', { 'lc.collis': value }, [/her own rooms/]);
    assert.match(run.text, re, value);
  }
});

test('chapter 4 offers the cup when he is very hungry and never gets stuck', async () => {
  const run = await play('b2c04', { hunger: 95 }, [/Drink it/]);
  assert.notEqual(run.frame.wait, 'choices');
  clean(run.text);
  const refused = await play('b2c04', { hunger: 95 }, [/Push it away/]);
  assert.notEqual(refused.frame.wait, 'choices');
});

test('the river scene is reachable', async () => {
  const run = await play('b2c04', {}, [/Go out to the river/]);
  assert.match(run.text, /writing in a book/);
});
