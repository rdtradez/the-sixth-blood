// Session 14: Book One, chapters 15 and 16. Played as different heroes and down the branches that later chapters
// depend on. (This file says what is guaranteed, not what happens.)

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

async function playFrom(chapter, scene, vars, wants = [], { seed = 3, hero = HERO } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero, seed });
  await dev.jump(game, chapter, {});
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { scene: scene ?? undefined, keep: true });
  return drive(game, frame, wants);
}

const DAY = { prisca: /Go to Prisca's house/, scribe: /Scribe line's undercroft/, camp: /Theron's camp/, lictors: /Lictors' barracks/ };
const NIGHT = { cordon: /Go to the cordon/, captains: /Go to Theron's captains/, table: /Meritamun's table/, door: /Go to the door itself/ };
const SIDE = { theron: /Stand with the General's line/, tarrax: /Stand with the Lictors/, alone: /Go to the door yourself/, seal: /keep both of them off/ };
const general = (run) => run.game.state.sys.originals.general;

test('chapters 15 and 16 are written, the General wakes, and the book plays on', async () => {
  const run = await playFrom('b1c15', null, {});
  assert.equal(run.frame.wait, 'book_end');
  assert.notEqual(run.frame.pending, true);
  for (const flag of ['b1.tarrax_answer', 'b1.theron_door', 'b1.door_side', 'b1.cordon']) {
    assert.ok(run.vars[flag], `${flag} is always recorded`);
  }
  assert.equal(general(run).state, 'awake');
  assert.ok(['bloodline', 'hero', 'faction'].includes(general(run).by));
});

test('prose has no dashes and no unresolved braces', async () => {
  for (const wants of [
    [],
    [DAY.prisca, /Ask her what the Senate teaches/, /Ask her for coin/, DAY.scribe, /Ask her to take you to the lintel/, SIDE.theron],
    [DAY.camp, /Ask him to hold them/, DAY.lictors, /Ask him for the roster/, /Tell him the truth/, SIDE.tarrax, NIGHT.cordon, NIGHT.captains, NIGHT.door],
    [DAY.lictors, DAY.camp, /Lie. Say that you were made/, SIDE.alone, NIGHT.table, /Ask her for a little of the cedar/, NIGHT.door, NIGHT.cordon],
    [/Say nothing/, SIDE.seal, NIGHT.captains, NIGHT.table, NIGHT.door],
  ]) {
    const run = await playFrom('b1c15', null, { 'b1.felt_below': true, 'b1.galerius': 'watching', wealth: 40 }, wants);
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('whom he stands with is recorded for each choice', async () => {
  for (const [side, value] of [['theron', 'theron'], ['tarrax', 'tarrax'], ['alone', 'alone'], ['seal', 'seal']]) {
    const run = await playFrom('b1c15', 'choose', {}, [SIDE[side]]);
    assert.equal(run.vars['b1.door_side'], value);
    assert.equal(run.frame.wait, 'book_end');
  }
});

test('what he tells the Commander is recorded', async () => {
  for (const [want, value] of [[/Tell him the truth/, 'truth'], [/Lie. Say that you were made/, 'lie'], [/Say nothing/, 'silent']]) {
    const run = await playFrom('b1c15', 'quarry', {}, [want]);
    assert.equal(run.vars['b1.tarrax_answer'], value);
  }
});

test('Theron and Galerius are only helpful where he earned it', async () => {
  const asked = await playFrom('b1c15', null, {}, [DAY.camp, /Ask him to hold them/, /That is enough/]);
  assert.equal(asked.vars['b1.theron_door'], 'asked');
  const warned = await playFrom('b1c15', null, {}, [DAY.camp, /Tell him that the Commander will bring/, /That is enough/]);
  assert.equal(warned.vars['b1.theron_door'], 'warned');
  const aid = await playFrom('b1c15', null, { 'b1.galerius': 'watching' }, [DAY.lictors, /Ask him for the roster/]);
  assert.equal(aid.vars['b1.galerius_aid'], true);
  const hostile = await playFrom('b1c15', null, { 'b1.galerius': 'hostile' }, [DAY.lictors]);
  assert.notEqual(hostile.vars['b1.galerius_aid'], true, 'a hostile Lictor gives nothing');
});

test('reading the lintel is what lets him have the cedar', async () => {
  const none = await playFrom('b1c16', null, {}, [NIGHT.table, /That is enough/]);
  assert.ok(!none.vars['b1.cedar']);
  assert.ok(!none.text.includes('nine small pegs'));
  const run = await playFrom('b1c16', null, { 'b1.door_read': true, 'b1.door_side': 'alone' }, [NIGHT.table, /Ask her for a little of the cedar/, NIGHT.door, NIGHT.cordon]);
  assert.equal(run.vars['b1.cedar'], true);
  const refused = await playFrom('b1c16', 'night', {}, [NIGHT.table]);
  assert.ok(!refused.vars['b1.cedar']);
});

test('every stand wakes the General, and who woke him follows the stand', async () => {
  for (const [side, by] of [['theron', 'bloodline'], ['tarrax', 'faction'], ['alone', 'hero'], ['seal', 'bloodline']]) {
    const run = await playFrom('b1c16', null, { 'b1.door_side': side }, [NIGHT.cordon, NIGHT.captains, NIGHT.table]);
    assert.equal(run.frame.wait, 'book_end');
    assert.equal(general(run).state, 'awake', side);
    assert.equal(general(run).by, by, side);
    assert.ok(run.game.state.decisions.some((d) => d.name === 'original.general.by'), 'the awakening is a logged decision');
  }
});

test('the cordon, the captains and the four fights end the chapter however they go', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const side of ['theron', 'tarrax', 'alone', 'seal']) {
      const run = await playFrom('b1c16', null, { 'b1.door_side': side, 'b1.galerius_aid': side === 'alone' }, [NIGHT.cordon, /Go through them/, NIGHT.captains, NIGHT.door], { seed });
      assert.equal(run.frame.wait, 'book_end', `${side} seed ${seed}`);
      assert.equal(general(run).state, 'awake', `${side} seed ${seed}`);
    }
  }
});

test('the cordon is recorded however he gets past it', async () => {
  for (const [wants, value, vars] of [
    [[NIGHT.cordon, /Take the shadow/], 'slipped', {}],
    [[NIGHT.cordon, /know his name/], 'passed', { 'b1.galerius_aid': true }],
    [[NIGHT.cordon], 'passed', { 'b1.door_side': 'tarrax' }],
  ]) {
    const run = await playFrom('b1c16', null, { 'b1.door_side': 'alone', ...vars }, wants);
    assert.equal(run.vars['b1.cordon'], value);
  }
});

test('the Scribe line is at the door, the old man is spared, and nobody important dies', async () => {
  for (const side of ['theron', 'tarrax', 'alone', 'seal']) {
    const run = await playFrom('b1c16', null, { 'b1.door_side': side }, []);
    assert.match(run.text, /What is the year/);
    assert.match(run.text, /anything to drink/);
  }
});
