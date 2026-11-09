// Session 13: Book One, chapters 13 and 14. Played start to finish as different heroes and down the branches
// that later chapters depend on. (This file says what is guaranteed, not what happens.)

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

/** Play from a frame to the end of the written part, choosing the first option that matches the earliest `wants` entry. */
async function drive(game, frame, wants = []) {
  const pages = [];
  for (let i = 0; i < 3000 && frame.wait !== 'book_end'; i++) {
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

async function playBook(hero, wants = [], seed = 3) {
  const game = await newGame();
  const { frame } = await game.startBook('burning-city', { from: 'new', hero, seed });
  return drive(game, frame, wants);
}

/** Jump straight into a chapter (developer jump) with some variables set first, then play on. */
async function playFrom(chapter, scene, vars, wants = [], hero = HERO) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero, seed: 3 });
  await dev.jump(game, chapter, {});
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { scene: scene ?? undefined, keep: true });
  return drive(game, frame, wants);
}

/** The first frame of a scene, with variables set before it is shown. */
async function frameAt(chapter, scene, vars) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed: 3 });
  await dev.jump(game, chapter, {});
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  return dev.jump(game, chapter, { scene, keep: true });
}

const ROAD = {
  run: /Run the Via Salaria flat out/, ferry: /ferry at Eretum/, track: /shepherds' track/, courier: /Send word ahead/,
};
const DAY = { thatch: /strip the thatch/, watch: /set a watch/, aelia: /Sit down with Aelia/, villa: /open the cellar/ };
const STAND = { ridge: /Meet them at the bridge/, square: /Hold the square, with the village/, villa: /Hold the villa, and the children/ };
const NIGHT = { bridge: /Hold the bridge and the north road/, row: /Hold the north row/, square: /Hold the square, and the old men/, gate: /Hold the villa gate/ };
const ENDS = { hero: /End it yourself, quickly/, village: /Let the village do what it will/, fire: /Do nothing. Let him go up the stair/ };
const REST = { spared: /put the lamps down, and go home/, given: /Give them to Sextus and the village/, slain: /Finish it, while they are standing/ };

const HUB = [ROAD.run, ROAD.ferry, ROAD.track];
const DAYS3 = [DAY.thatch, DAY.watch, DAY.aelia];

test('chapters 13 and 14 are written and the book still pauses after them', async () => {
  const run = await playFrom('b1c13', null, { 'b1.hill_known': true });
  assert.equal(run.frame.wait, 'book_end');
  assert.equal(run.frame.pending, true);
  for (const flag of ['b1.company', 'b1.hill_warned', 'b1.column', 'b1.hill_ready', 'b1.aelia_talk', 'b1.hill_stand', 'b1.flavus_end', 'b1.remnant', 'b1.hill_toll', 'b1.survivor']) {
    assert.ok(run.vars[flag], `${flag} is always recorded`);
  }
});

test('prose has no dashes and no unresolved braces', async () => {
  for (const wants of [
    [],
    [ROAD.courier, /Tell her plainly/, ROAD.track, /Wake the one on watch/, ROAD.run, DAY.villa, DAY.watch, DAY.aelia],
    [ROAD.ferry, /Go in, and ask them/, ROAD.run, /Take the shepherd's ewe/, ROAD.track, /Go down, and put out the lamps/, ...DAYS3],
    [ROAD.ferry, /Do what the war says/, ROAD.courier, /Do not write/, ROAD.track, /Go round them/, DAY.villa, DAY.thatch, DAY.watch, /Go to Sextus, and ask for his wrist/],
    [STAND.villa, NIGHT.gate, NIGHT.row, NIGHT.square, ENDS.fire, REST.spared],
    [STAND.ridge, NIGHT.bridge, NIGHT.gate, NIGHT.row, ENDS.village, REST.given],
    [STAND.square, NIGHT.square, NIGHT.row, NIGHT.bridge, ENDS.hero, REST.slain],
  ]) {
    const run = await playFrom('b1c13', null, { 'b1.cell': 'theron', 'b1.boy': 'vigiles', 'b1.hill_known': true, 'b1.felt_below': true, 'b1.saw_marks': true }, wants);
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('who goes north is recorded, and only offered to a hero who can have them', async () => {
  for (const [vars, label] of [
    [{ 'b1.cell': 'theron' }, /Go with the captain and her hunters/],
    [{ 'b1.boy': 'vigiles' }, /Go with Aulus/],
  ]) {
    const frame = await frameAt('b1c13', 'company', vars);
    assert.ok(frame.choices.some((c) => label.test(c.text)), String(label));
  }
  const none = await frameAt('b1c13', 'company', { 'b1.cell': 'alone', 'b1.boy': 'dead', 'b1.war_terms': 'limited', 'b1.coven': 'alone', 'bond.theron': 0 });
  assert.ok(!none.choices.some((c) => /captain and her hunters|Aulus/.test(c.text)));
  for (const [want, value, vars] of [
    [/Go alone, and fast/, 'alone', {}],
    [/captain and her hunters/, 'hunters', { 'b1.cell': 'theron' }],
    [/Go with Aulus/, 'aulus', { 'b1.boy': 'vigiles' }],
  ]) {
    const run = await playFrom('b1c13', null, vars, [want]);
    assert.equal(run.vars['b1.company'], value);
  }
});

test('the road can be run, ferried, cut over the hills or warned ahead, and the lead is recorded', async () => {
  for (const [want, flag, value] of [
    [[ROAD.courier, /Tell her plainly/], 'b1.hill_warned', 'runner'],
    [[ROAD.courier, /Do not write/], 'b1.hill_warned', 'none'],
    [[ROAD.track, /Wake the one on watch/], 'b1.column', 'stopped'],
  ]) {
    const run = await playFrom('b1c13', null, { wealth: 40 }, [...want, ...DAYS3]);
    assert.equal(run.vars[flag], value, String(want));
    assert.equal(run.frame.wait, 'book_end');
  }
});

test('the ferry and the hollow fights end the chapter however they go', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const wants of [
      [ROAD.ferry, /Go in, and ask them/, ...DAYS3],
      [ROAD.track, /Go down, and put out the lamps/, ...DAYS3],
    ]) {
      const game = await newGame();
      game.setSetting('dev', true);
      await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
      await dev.jump(game, 'b1c13', {});
      const frame = await dev.jump(game, 'b1c13', { keep: true });
      const run = await drive(game, frame, wants);
      assert.equal(run.frame.wait, 'book_end', `seed ${seed}`);
    }
  }
});

test('how ready the village is depends on the day, and the arrival is spoken for every farewell', async () => {
  const ready = await playFrom('b1c13', 'day', { 'b1.farewell': 'promise' }, [DAY.thatch, DAY.watch, DAY.aelia, /Tell her the truth, all of it/]);
  assert.equal(ready.vars['b1.hill_ready'], 'some');
  const full = await playFrom('b1c13', 'day', {}, [DAY.thatch, /Bring up the water/, DAY.villa, /Bring the old and the small/, DAY.watch, /Tell him that if he sees them/]);
  assert.equal(full.vars['b1.hill_ready'], 'full');
  const idle = await playFrom('b1c13', 'day', {}, [DAY.aelia, /Tell her that there are things/, DAY.watch, /Tell him to blow it and stay/, DAY.thatch, /Let the men do it/]);
  assert.notEqual(idle.vars['b1.hill_ready'], 'full');
  for (const farewell of ['promise', 'truth', 'silent']) {
    const run = await playFrom('b1c13', 'arrival', { 'b1.farewell': farewell });
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('what he tells Aelia is recorded', async () => {
  for (const [want, value] of [[/Tell her the truth, all of it/, 'truth'], [/Tell her that there are things/, 'kept'], [/Tell her that you are her father/, 'kept']]) {
    const run = await playFrom('b1c13', 'day', {}, [DAY.aelia, want, ...DAYS3]);
    assert.equal(run.vars['b1.aelia_talk'], value, String(want));
  }
});

test('the stand is recorded for each place he can choose', async () => {
  for (const [want, value] of [[STAND.ridge, 'ridge'], [STAND.square, 'square'], [STAND.villa, 'villa']]) {
    const run = await playFrom('b1c14', null, { 'b1.column': 'counted' }, [want]);
    assert.equal(run.vars['b1.hill_stand'], value);
    assert.equal(run.frame.wait, 'book_end');
  }
});

test('Flavus dies on every path and the way he dies is recorded', async () => {
  for (const end of Object.keys(ENDS)) {
    for (const stand of [STAND.ridge, STAND.square, STAND.villa]) {
      const run = await playFrom('b1c14', null, {}, [stand, ENDS[end], REST.spared]);
      assert.equal(run.vars['b1.flavus_end'], end);
      assert.equal(run.frame.wait, 'book_end');
    }
  }
});

test('the fire ending lets him reach for the dying man or leave him', async () => {
  const reach = await playFrom('b1c14', null, {}, [ENDS.fire, /Run up the stair/]);
  assert.match(reach.text, /put your hand over the flame/);
  const leave = await playFrom('b1c14', null, {}, [ENDS.fire, /Leave it. Let it burn down/]);
  assert.match(leave.text, /goes out of its own accord/);
});

test('the rest of the column can be spared, given or slain, and a survivor is only kept if they live', async () => {
  for (const [want, value] of [[REST.spared, 'spared'], [REST.given, 'given'], [REST.slain, 'slain']]) {
    const run = await playFrom('b1c14', null, {}, [want]);
    assert.equal(run.vars['b1.remnant'], value);
  }
  const kept = await playFrom('b1c14', null, {}, [REST.spared, /Take the youngest of them/]);
  assert.equal(kept.vars['b1.survivor'], 'kept');
  const slain = await playFrom('b1c14', null, {}, [REST.slain, /Take the youngest of them/]);
  assert.equal(slain.vars['b1.survivor'], 'none', 'nobody to keep once the column is slain');
});

test('the village is better off for a hero who held more places and a better prepared hill', async () => {
  const strong = await playFrom('b1c14', null, { 'b1.hill_ready': 'full' }, [STAND.square, NIGHT.square, NIGHT.row, NIGHT.gate, REST.spared]);
  const weak = await playFrom('b1c14', null, { 'b1.hill_ready': 'none' }, [STAND.square, NIGHT.bridge, NIGHT.bridge, NIGHT.bridge, REST.spared]);
  const rank = { light: 0, heavy: 1, terrible: 2 };
  assert.ok(rank[strong.vars['b1.hill_toll']] <= rank[weak.vars['b1.hill_toll']]);
  assert.equal(weak.vars['b1.hill_toll'] !== undefined, true);
});

test('the three night fights end the chapter however they go', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const game = await newGame();
    game.setSetting('dev', true);
    await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
    await dev.jump(game, 'b1c14', {});
    const frame = await dev.jump(game, 'b1c14', { keep: true });
    const run = await drive(game, frame, [STAND.ridge, NIGHT.bridge, NIGHT.row, NIGHT.square, /Take him by the arm/, ENDS.hero, REST.spared]);
    assert.equal(run.frame.wait, 'book_end', `seed ${seed}`);
  }
});

test('Collesanto is the same village in every chapter: the family is known after the hill', async () => {
  const run = await playFrom('b1c14', null, {}, []);
  assert.ok(run.game.state.sys.lore, 'lore state exists');
  assert.match(run.text, /door has begun to knock/);
});
