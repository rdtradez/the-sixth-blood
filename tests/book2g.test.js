// Session 24: Book Two, chapters 13 and 14 (the old brother at San Miniato, and the hill by daylight). Played down their branches. (This file says what is guaranteed, not what happens.)

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
  return drive(game, frame, wants, stopAt ?? (chapter === 'b2c13' ? 'b2c14' : chapter === 'b2c14' ? 'b2c15' : null));
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

test('chapter 13 plays through to chapter 14 for every pointer, answer to the girl and bond', async () => {
  for (const answer of ['told', 'traded', 'closed']) {
    for (const sire of ['sired', 'later', 'refused']) {
      for (const bond of ['begun', 'guarded']) {
        const run = await play('b2c13', { 'b2.answer': answer, 'b2.sire': sire, 'b2.watcher_bond': bond, 'b2.berengaria_debt': answer === 'traded' });
        assert.equal(run.game.state.chapter, 'b2c14', JSON.stringify([answer, sire, bond]));
        clean(run.text);
      }
    }
  }
});

test('chapter 13 plays through when very hungry and for a woman', async () => {
  const hungry = await play('b2c13', { hunger: 95 }, [/Benedetto's back room/]);
  assert.equal(hungry.game.state.chapter, 'b2c14');
  clean(hungry.text);
  const woman = await play('b2c13', {}, [], { hero: { ...HERO, gender: 'f' } });
  assert.equal(woman.game.state.chapter, 'b2c14');
  clean(woman.text);
});

test('chapter 13 records the old brother, the girl, the banker, the clerk and the promise', async () => {
  for (const [re, key] of [[/ask him what he painted/, 'asked'], [/wait for the bell/, 'waited'], [/Tell him that you know about the sixth panel/, 'pressed']]) {
    const run = await play('b2c13', {}, [/San Miniato/, re]);
    assert.equal(run.vars['b2.anselm'], key);
  }
  for (const sire of ['sired', 'later', 'refused']) {
    for (const [i, key] of [['0', 'taught'], ['1', 'trusted'], ['2', 'forbade']]) {
      const game = await newGame();
      game.setSetting('dev', true);
      await game.startBook('burning-city', { from: 'new', hero: HERO, seed: 3 });
      await dev.jump(game, 'b2c13', {});
      game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', years: 1410 };
      dev.setVar(game, 'wealth', 50000);
      dev.setVar(game, 'b2.sire', sire);
      let frame = await dev.jump(game, 'b2c13', { keep: true });
      let girl = false;
      for (let n = 0; n < 400 && game.state.chapter === 'b2c13'; n++) {
        if (frame.wait === 'choices') {
          const hit = frame.choices.findIndex((c) => /See to the girl/.test(c.text));
          if (hit >= 0 && !girl) { girl = true; frame = await game.choose(hit); continue; }
          if (girl && game.state.vars['b2.fiammetta_night'] === 'unseen' && frame.choices.length === 3) { frame = await game.choose(Number(i)); continue; }
          if (game.state.vars['b2.fiammetta_night'] !== 'unseen') break;
          frame = await game.choose(0);
        } else frame = await game.continue();
      }
      assert.equal(game.state.vars['b2.fiammetta_night'], key, `${sire} ${key}`);
    }
  }
  for (const [re, key] of [[/Lend it at a fair rate/, 'lent'], [/Buy a good quantity/, 'bought'], [/does not lend in Lent/, 'aloof']]) {
    const run = await play('b2c13', {}, [/back office of Ser Bartolo/, re]);
    assert.equal(run.vars['b2.medici_paper'], key);
  }
  for (const bond of ['begun', 'guarded']) {
    for (const [re, key] of [[/Tell {them}|Tell them|Tell her|Tell him|the whole of it|that you would be sorry/, 'told'], [/do not know how it ends|right to recall/, 'kept']]) {
      const run = await play('b2c13', { 'b2.watcher_bond': bond }, [/river stair/, re]);
      assert.equal(run.vars['b2.watcher_night'], key, `${bond} ${key}`);
    }
  }
  for (const [re, key] of [[/Say that you will tell her, before/, 'agreed'], [/what you can, when you can/, 'hedged'], [/things that you cannot tell her/, 'refused']]) {
    const run = await play('b2c13', { 'b2.prisca_deal': 'partner' }, [re]);
    assert.equal(run.vars['b2.prisca_promise'], key);
  }
});

test('chapter 13 gives the border scrap only to a man who asked, and pays the debt only then', async () => {
  const asked = await play('b2c13', { 'b2.answer': 'traded', 'b2.berengaria_debt': true }, [/San Miniato/, /ask him what he painted/]);
  assert.ok(asked.game.state.sys.items.sixth_border);
  assert.notEqual(asked.vars['b2.berengaria_debt'], true);
  const waited = await play('b2c13', { 'b2.answer': 'traded', 'b2.berengaria_debt': true }, [/San Miniato/, /wait for the bell/]);
  assert.equal(waited.game.state.sys.items.sixth_border, undefined);
  assert.equal(waited.vars['b2.berengaria_debt'], true);
});

test('chapter 13 leaves things unseen when he does not go there', async () => {
  const run = await play('b2c13', {}, [/river stair/, /back office of Ser Bartolo/, /See to the girl/]);
  assert.equal(run.vars['b2.anselm'], 'unseen');
});

test('chapter 14 plays through for every faction answer, gender, hunger and each decision', async () => {
  for (const faction of ['joined', 'feigned', 'refused']) {
    for (const sire of ['sired', 'later', 'refused']) {
      for (const valerii of ['sworn', 'trusted', 'distant']) {
        const run = await play('b2c14', { 'b2.faction': faction, 'b2.sire': sire, 'b2.valerii': valerii });
        assert.notEqual(run.game.state.chapter, 'b2c13');
        assert.equal(run.game.state.chapter, 'b2c15', JSON.stringify([faction, sire, valerii]));
        clean(run.text);
      }
    }
  }
  const hungry = await play('b2c14', { hunger: 95 }, [/kitchen yard|lower fold|woman of the village/]);
  clean(hungry.text);
  const woman = await play('b2c14', {}, [], { hero: { ...HERO, gender: 'f' } });
  clean(woman.text);
});

test('chapter 14 records the cellar, the walls, the table, the ridge and the gate', async () => {
  for (const [re, key] of [[/Change the lock/, 'relocked'], [/Set a watch on the shrine/, 'guarded'], [/Leave the shrine to the keeping/, 'trusted']]) {
    const run = await play('b2c14', {}, [/cellar of the shrine/, re]);
    assert.equal(run.vars['b2.shrine'], key);
  }
  for (const [re, key] of [[/Raise the walls properly/, 'raised'], [/Levy the men/, 'levied'], [/Leave the walls as they are/, 'left']]) {
    const run = await play('b2c14', {}, [/Walk the walls/, re]);
    assert.equal(run.vars['b2.walls'], key);
  }
  for (const [re, key] of [[/Tell her all of it/, 'told'], [/barred, and ask no more|doors barred/, 'kept'], [/Ask her what she would do/, 'asked']]) {
    const run = await play('b2c14', {}, [/Ginevra's table/, re]);
    assert.equal(run.vars['b2.ginevra'], key);
  }
  for (const [re, key] of [[/Follow them/, 'followed'], [/Take Tommaso down/, 'warned'], [/Leave them alone/, 'ignored']]) {
    const run = await play('b2c14', {}, [/ridge above the vineyard/, re]);
    assert.equal(run.vars['b2.ridge'], key);
  }
  for (const [re, key] of [[/Take the deed/, 'heard'], [/Tear it across/, 'refused'], [/Take him by the front of his coat/, 'fought']]) {
    const run = await play('b2c14', {}, [re]);
    assert.equal(run.vars['b2.ormanno_man'], key);
  }
});

test('chapter 14 builds the walls only when he can pay, and leaves a thing unseen when he does not go', async () => {
  const rich = await play('b2c14', {}, [/Walk the walls/, /Raise the walls properly/]);
  assert.equal(rich.vars['b2.walls'], 'raised');
  assert.ok(Object.hasOwn(rich.game.state.sys.village.built, 'walls'));
  const poor = await play('b2c14', { wealth: 0 }, [/Walk the walls/, /Levy the men/]);
  assert.equal(poor.vars['b2.walls'], 'levied');
  assert.ok(!Object.hasOwn(poor.game.state.sys.village.built, 'walls'));
  const skipped = await play('b2c14', {}, [/Ginevra's table/, /Walk the walls/, /cellar of the shrine/]);
  assert.equal(skipped.vars['b2.ridge'], 'unseen');
});

test('every flag these chapters set is registered with a quick start default', async () => {
  const flags = JSON.parse(await readFile(join(root, 'content/flags.json'), 'utf8')).flags;
  for (const k of ['b2.anselm', 'b2.fiammetta_night', 'b2.medici_paper', 'b2.watcher_night', 'b2.prisca_promise', 'b2.shrine', 'b2.walls', 'b2.ginevra', 'b2.ridge', 'b2.ormanno_man']) {
    assert.ok(flags[k], k);
    assert.equal(flags[k].major, true, k);
    assert.ok(flags[k].values.includes(flags[k].default), k);
  }
});
