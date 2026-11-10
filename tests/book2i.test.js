// Session 26: Book Two, chapters 17 and 18 (the Elevation, and the night after). Played down their branches. (This file says what is guaranteed, not what happens.)

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
  return drive(game, frame, wants, stopAt ?? (chapter === 'b2c17' ? 'b2c18' : null));
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

test('chapter 17 plays through to chapter 18 from every stand, with every plan and company', async () => {
  for (const stand of ['beside', 'door', 'away']) {
    for (const plan of ['guard', 'forbid', 'trust']) {
      for (const company of ['city', 'away', 'hill']) {
        const run = await play('b2c17', { 'b2.easter_stand': stand, 'b2.prince_plan': plan, 'b2.company_day': company, 'b2.duomo': 'barred', 'b2.ring_task': 'bargained' });
        assert.equal(run.game.state.chapter, 'b2c18', JSON.stringify([stand, plan, company]));
        clean(run.text);
      }
    }
  }
});

test('chapter 17 plays through when very hungry, for a woman, and for every girl and clerk', async () => {
  const hungry = await play('b2c17', { hunger: 95 }, [/Benedetto's back room/]);
  clean(hungry.text);
  const woman = await play('b2c17', {}, [], { hero: { ...HERO, gender: 'f' } });
  clean(woman.text);
  for (const girl of ['home', 'near', 'chose']) {
    for (const agent of ['unseen', 'away', 'near', 'silent']) {
      for (const stand of ['beside', 'door', 'away']) {
        const run = await play('b2c17', { 'b2.fiammetta_easter': girl, 'b2.agent_easter': agent, 'b2.easter_stand': stand });
        assert.equal(run.game.state.chapter, 'b2c18', JSON.stringify([girl, agent, stand]));
        clean(run.text);
      }
    }
  }
});

test('chapter 17 records the Elevation and the wounded clerk', async () => {
  const cases = [
    ['beside', [/Go for Lorenzo/], 'b2.elevation', 'lorenzo'],
    ['beside', [/Go for Giuliano/], 'b2.elevation', 'giuliano'],
    ['beside', [/Take the priest/], 'b2.elevation', 'priest'],
    ['door', [/Stand where you are/], 'b2.elevation', 'stood'],
    ['door', [/Break from it/], 'b2.elevation', 'broke'],
    ['door', [/Speak to him/], 'b2.elevation', 'spoke'],
    ['away', [/Put on your hat/], 'b2.elevation', 'late'],
    ['away', [/Stay in the chair/], 'b2.elevation', 'books'],
  ];
  for (const [stand, wants, key, value] of cases) {
    const run = await play('b2c17', { 'b2.easter_stand': stand }, wants);
    assert.equal(run.vars[key], value, key + ' ' + value);
    clean(run.text);
  }
  const oiled = await play('b2c17', { 'b2.easter_stand': 'beside', 'b2.duomo': 'measured' }, [/oiled door/]);
  assert.equal(oiled.vars['b2.elevation'], 'sacristy');
  const carried = await play('b2c17', { 'b2.easter_stand': 'beside', 'b2.agent_easter': 'near' }, [/Go for Lorenzo/, /carry/]);
  assert.equal(carried.vars['b2.agent_fall'], 'carried');
  const left = await play('b2c17', { 'b2.easter_stand': 'beside', 'b2.agent_easter': 'near' }, [/Go for Lorenzo/, /Leave/]);
  assert.equal(left.vars['b2.agent_fall'], 'left');
  const away = await play('b2c17', { 'b2.easter_stand': 'beside', 'b2.agent_easter': 'away' }, [/Go for Lorenzo/]);
  assert.equal(away.vars['b2.agent_fall'], 'unseen');
});

test('chapter 17 fights the priest over several seeds without getting stuck', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const run = await play('b2c17', { 'b2.easter_stand': 'beside' }, [/Take the priest/], { seed });
    assert.equal(run.game.state.chapter, 'b2c18', 'seed ' + seed);
    clean(run.text);
  }
});

test('chapter 18 plays through every ending of every door, hungry and for a woman', async () => {
  const hungry = await play('b2c18', { hunger: 95 }, [/Benedetto's back room/]);
  clean(hungry.text);
  assert.equal(hungry.frame.wait === 'choices', false);
  const woman = await play('b2c18', {}, [], { hero: { ...HERO, gender: 'f' } });
  clean(woman.text);
  for (const fall of ['unseen', 'carried', 'left']) {
    for (const told of ['before', 'half', 'none']) {
      for (const faction of ['joined', 'feigned', 'refused']) {
        const run = await play('b2c18', { 'b2.agent_fall': fall, 'b2.prisca_told': told, 'b2.faction': faction, 'b2.company_day': 'city', 'b2.paper': 'carried' });
        assert.equal(run.frame.wait === 'choices', false, JSON.stringify([fall, told, faction]));
        clean(run.text);
      }
    }
  }
});

test('chapter 18 records every answer and always turns the clerk', async () => {
  const cases = [
    [/Piazza della Signoria/, /names of the faction/, 'b2.hunt', 'named'],
    [/Piazza della Signoria/, /Take the straw hats/, 'b2.hunt', 'sheltered'],
    [/Piazza della Signoria/, /Say that you know nothing/, 'b2.hunt', 'stood'],
    [/river stair/, /Kneel, and tell/, 'b2.agent_end', 'truth'],
    [/river stair/, /say nothing, and let it be done/, 'b2.agent_end', 'hold'],
    [/river stair/, /he will not/, 'b2.agent_end', 'bar'],
    [/Go to the bank/, /Open the doors at the first bell/, 'b2.panic', 'steady'],
    [/Go to the bank/, /Open, but pay slowly/, 'b2.panic', 'hedge'],
    [/Go to the bank/, /Buy the Pazzi paper/, 'b2.panic', 'profit'],
    [/Fiesole road/, /Take the ring back/, 'b2.villa', 'broke'],
    [/Fiesole road/, /Keep the ring/, 'b2.villa', 'kept'],
    [/Fiesole road/, /going to the Prince/, 'b2.villa', 'handed'],
  ];
  for (const [door, answer, key, value] of cases) {
    const run = await play('b2c18', {}, [door, answer]);
    assert.equal(run.vars[key], value, key + ' ' + value);
    assert.equal(run.vars['b2.agent_turned'], true);
    clean(run.text);
  }
});

test('chapter 18 leaves exactly one door unseen, with the other three walked', async () => {
  const keys = ['b2.hunt', 'b2.agent_end', 'b2.panic', 'b2.villa'];
  const run = await play('b2c18', {});
  assert.equal(keys.filter((k) => run.vars[k] === 'unseen').length, 1);
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  for (const k of keys) assert.ok(flags[k].values.includes('unseen'), k);
  const skipped = await play('b2c18', {}, [/Piazza della Signoria/, /river stair/, /Go to the bank/]);
  assert.equal(skipped.vars['b2.villa'], 'unseen');
  assert.match(skipped.text, /Baptistery/);
  assert.equal(skipped.vars['b2.agent_turned'], true);
});
