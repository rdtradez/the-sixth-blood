// Session 25: Book Two, chapters 15 and 16 (the week of palms, and the eve). Played down their branches. (This file says what is guaranteed, not what happens.)

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
  return drive(game, frame, wants, stopAt ?? (chapter === 'b2c15' ? 'b2c16' : chapter === 'b2c16' ? 'b2c17' : null));
}

const clean = (text) => {
  assert.doesNotMatch(text, /[–—]/);
  assert.doesNotMatch(text, /[{}]/);
  assert.doesNotMatch(text, /\$ do /);
};



test('Book Two lists eighteen chapters and still pauses after the last', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'blood-and-gold');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 18);
});

test('chapter 15 plays through to chapter 16 for every answer to the Prince, the Captain and the faction', async () => {
  for (const prince of ['told', 'partial', 'silent']) {
    for (const captain of ['funded', 'listened', 'refused']) {
      for (const faction of ['joined', 'feigned', 'refused']) {
        const run = await play('b2c15', { 'b2.prince_told': prince, 'b2.captain': captain, 'b2.faction': faction });
        assert.equal(run.game.state.chapter, 'b2c16', JSON.stringify([prince, captain, faction]));
        clean(run.text);
      }
    }
  }
});

test('chapter 15 plays through when very hungry, for a woman, and for each trust in Prisca', async () => {
  const hungry = await play('b2c15', { hunger: 95 }, [/Benedetto's back room/]);
  assert.equal(hungry.game.state.chapter, 'b2c16');
  clean(hungry.text);
  const woman = await play('b2c15', {}, [], { hero: { ...HERO, gender: 'f' } });
  assert.equal(woman.game.state.chapter, 'b2c16');
  clean(woman.text);
  for (const promise of ['agreed', 'hedged', 'refused']) {
    for (const paper of ['carried', 'recorded', 'refused']) {
      const run = await play('b2c15', { 'b2.prisca_promise': promise, 'b2.paper': paper, 'b2.medici_paper': 'lent' });
      assert.equal(run.game.state.chapter, 'b2c16', JSON.stringify([promise, paper]));
      clean(run.text);
    }
  }
});

test('chapter 15 records the Prince, the company, the faction, the warning and Prisca', async () => {
  const cases = [
    [/Prince's loggia/, /break the law, quietly/, 'b2.prince_plan', 'guard'],
    [/Prince's loggia/, /keep the law, and keep the court out/, 'b2.prince_plan', 'forbid'],
    [/Prince's loggia/, /it is his city/, 'b2.prince_plan', 'trust'],
    [/company at Campi/, /Bring the company into the city/, 'b2.company_day', 'city'],
    [/company at Campi/, /take the money, and the company/, 'b2.company_day', 'away'],
    [/company at Campi/, /Send the company to Collesanto/, 'b2.company_day', 'hill'],
    [/civil man in black/, /Accept it/, 'b2.ring_task', 'accepted'],
    [/civil man in black/, /ask what is behind the door/, 'b2.ring_task', 'bargained'],
    [/civil man in black/, /Burn the card/, 'b2.ring_task', 'declined'],
    [/Ser Bartolo, at the Medici/, /there is a plot/, 'b2.warning', 'open'],
    [/Ser Bartolo, at the Medici/, /different Mass/, 'b2.warning', 'veiled'],
    [/Ser Bartolo, at the Medici/, /news of the Pope's money/, 'b2.warning', 'silent'],
    [/Prince's loggia/, /Tell her everything/, 'b2.prisca_told', 'before'],
    [/Prince's loggia/, /out of the city, and no more/, 'b2.prisca_told', 'half'],
    [/Prince's loggia/, /nothing to tell/, 'b2.prisca_told', 'none'],
  ];
  for (const [door, answer, key, value] of cases) {
    const run = await play('b2c15', {}, [door, answer]);
    assert.equal(run.vars[key], value, key + ' ' + value);
    clean(run.text);
  }
});

test('chapter 15 leaves exactly one door unseen, and the unseen value is set on entry', async () => {
  const keys = ['b2.prince_plan', 'b2.company_day', 'b2.ring_task', 'b2.warning'];
  const run = await play('b2c15', {});
  const unseen = keys.filter((k) => run.vars[k] === 'unseen');
  assert.equal(unseen.length, 1);
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  for (const k of keys) assert.ok(flags[k].values.includes('unseen'), k);
  assert.equal(flags['b2.prisca_told'].values.includes('unseen'), false);
});

test('chapter 16 plays through every answer to the girl, the clerk and the thread seller, and the last choice', async () => {
  for (const sire of ['sired', 'later', 'refused']) {
    for (const bond of ['begun', 'guarded']) {
      for (const regard of ['warm', 'wary', 'cold']) {
        const run = await play('b2c16', { 'b2.sire': sire, 'b2.watcher_bond': bond, 'b2.trader_regard': regard });
        assert.equal(run.game.state.chapter, 'b2c17', JSON.stringify([sire, bond, regard]));
        assert.notEqual(run.vars['b2.easter_stand'], undefined);
        clean(run.text);
      }
    }
  }
  for (const told of ['before', 'half', 'none']) {
    for (const plan of ['guard', 'forbid', 'trust']) {
      const run = await play('b2c16', { 'b2.prisca_told': told, 'b2.prince_plan': plan, 'b2.company_day': 'city', 'b2.ring_task': 'accepted', 'b2.warning': 'open' });
      assert.equal(run.game.state.chapter, 'b2c17', JSON.stringify([told, plan]));
      clean(run.text);
    }
  }
});

test('chapter 16 plays through when very hungry and for a woman', async () => {
  const hungry = await play('b2c16', { hunger: 95 }, [/Benedetto's back room/]);
  clean(hungry.text);
  const woman = await play('b2c16', {}, [], { hero: { ...HERO, gender: 'f' } });
  clean(woman.text);
});

test('chapter 16 records the church, the thread seller, the clerk, the girl and the last stand', async () => {
  const cases = [
    [/great church, and walk about/, /Measure it/, 'b2.duomo', 'measured'],
    [/great church, and walk about/, /Give the sacristan/, 'b2.duomo', 'barred'],
    [/great church, and walk about/, /Kneel in the Lady Chapel/, 'b2.duomo', 'prayed'],
    [/seller of thread/, /what he would do/, 'b2.nanni_eve', 'asked'],
    [/seller of thread/, /Tell him what you mean/, 'b2.nanni_eve', 'told'],
    [/seller of thread/, /Buy a spool/, 'b2.nanni_eve', 'bought'],
    [/river stair/, /stay away from the church/, 'b2.agent_easter', 'away'],
    [/river stair/, /to stand where you can see/, 'b2.agent_easter', 'near'],
    [/river stair/, /as it was ordered/, 'b2.agent_easter', 'silent'],
    [/girl from the hill/, /Send her home/, 'b2.fiammetta_easter', 'home'],
    [/girl from the hill/, /Take her to the church/, 'b2.fiammetta_easter', 'near'],
    [/girl from the hill/, /leave it with her/, 'b2.fiammetta_easter', 'chose'],
    [/nothing matches/, /Stand beside the family/, 'b2.easter_stand', 'beside'],
    [/nothing matches/, /Go to the south door/, 'b2.easter_stand', 'door'],
    [/nothing matches/, /Stay at the bank/, 'b2.easter_stand', 'away'],
  ];
  for (const [door, answer, key, value] of cases) {
    const run = await play('b2c16', {}, [door, answer]);
    assert.equal(run.vars[key], value, key + ' ' + value);
    clean(run.text);
  }
});

test('chapter 16 leaves exactly one door unseen, and the last choice is always reached', async () => {
  const keys = ['b2.duomo', 'b2.nanni_eve', 'b2.agent_easter', 'b2.fiammetta_easter'];
  const run = await play('b2c16', {});
  assert.equal(keys.filter((k) => run.vars[k] === 'unseen').length, 1);
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  for (const k of keys) assert.ok(flags[k].values.includes('unseen'), k);
  assert.equal(flags['b2.easter_stand'].values.includes('unseen'), false);
});
