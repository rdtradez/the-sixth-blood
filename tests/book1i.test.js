// Session 15: Book One, chapters 17 and 18. Played as different heroes and down the branches that later chapters
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

async function playFrom(chapter, scene, vars, wants = [], { seed = 3, hero = HERO, general = 'hero', stopAt = null } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero, seed });
  await dev.jump(game, chapter, {});
  const sys = game.state.sys;
  sys.originals.general = { state: 'awake', by: general, fate: '', name: false, book: 'burning-city' };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { scene: scene ?? undefined, keep: true });
  return drive(game, frame, wants, stopAt);
}

const DAY = { room: /down to the strongroom/, study: /Go to Prisca, in her study/, caelian: /up the Caelian/, lane: /out into the lane/ };
const MEAL = { wrist: /Offer him your wrist/, donor: /willing donor/, animal: /Bring him a lamb/, none: /let it be hers/ };
const NIGHT = { counting: /Go to Hanno/, talk: /Go down to the strongroom, for the last talk/, garden: /out into the garden/, gate: /Go to the gate/ };
const FATE = { loosed: /^Let him go$/, bargain: /Make terms with him/, drunk: /old right of judgment/, sealed: /Give him to the cedar/ };
const general = (run) => run.game.state.sys.originals.general;

test('chapters 17 and 18 are written, a fate is always chosen, and the book plays on', async () => {
  const run = await playFrom('b1c17', null, {});
  assert.equal(run.frame.wait, 'book_end');
  assert.notEqual(run.frame.pending, true);
  assert.ok(run.vars['b1.general_meal']);
  assert.ok(run.vars['b1.senate_ruling']);
  assert.ok(run.vars['b1.tarrax_after']);
  assert.ok(['loosed', 'bargain', 'drunk', 'sealed'].includes(general(run).fate), 'the General always gets a fate');
});

test('prose has no dashes and no unresolved braces', async () => {
  for (const wants of [
    [],
    [DAY.room, /how he is/, /Move the screen/, DAY.study, /Senate will do/, MEAL.wrist, FATE.loosed],
    [DAY.caelian, /Senate will do/, DAY.lane, /Ask Theron/, MEAL.donor, FATE.bargain],
    [DAY.room, DAY.lane, MEAL.animal, NIGHT.counting, NIGHT.talk, NIGHT.garden, FATE.drunk],
    [MEAL.none, NIGHT.gate, NIGHT.garden, NIGHT.talk, FATE.sealed],
  ]) {
    const run = await playFrom('b1c17', null, { 'b1.galerius_aid': true, 'b1.company': 'hunters', wealth: 40 }, wants);
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('the first drink is recorded for each choice', async () => {
  for (const [key, value] of [['wrist', 'wrist'], ['donor', 'donor'], ['animal', 'animal'], ['none', 'none']]) {
    const run = await playFrom('b1c17', 'dusk', {}, [MEAL[key]]);
    assert.equal(run.vars['b1.general_meal'], value);
    assert.equal(run.frame.wait, 'book_end');
  }
});

test('only the wrist, or standing in the light, tells the General what he is', async () => {
  const wrist = await playFrom('b1c17', 'dusk', {}, [MEAL.wrist]);
  assert.equal(wrist.vars['b1.general_knows'], true);
  const lamb = await playFrom('b1c17', 'dusk', {}, [MEAL.animal]);
  assert.notEqual(lamb.vars['b1.general_knows'], true);
  const light = await playFrom('b1c17', null, {}, [DAY.room, /Move the screen/, /That is enough/, MEAL.animal]);
  assert.equal(light.vars['b1.general_knows'], true);
});

test('a hero who leaves the drink to Prisca costs her, and the Senate still lets him judge', async () => {
  const run = await playFrom('b1c17', 'dusk', { 'bond.prisca': 5 }, [MEAL.none], { stopAt: 'b1c19' });
  assert.ok(run.vars['bond.prisca'] < 5);
  const senate = await playFrom('b1c18', 'senate', { 'b1.general_meal': 'none' }, [FATE.sealed]);
  assert.match(senate.text, /You are mistaken|you are mistaken/);
  assert.equal(general(senate).fate, 'sealed');
});

test('each fate is recorded, logged, and sets how the Senate and the Commander stand', async () => {
  const cases = [
    ['loosed', 'defied', 'vowed'],
    ['bargain', null, 'wary'],
    ['drunk', 'defied', 'vowed'],
    ['sealed', null, null],
  ];
  for (const [fate, ruling, after] of cases) {
    const run = await playFrom('b1c18', 'hearing', {}, [FATE[fate]]);
    assert.equal(run.frame.wait, 'book_end', fate);
    assert.equal(general(run).fate, fate, fate);
    assert.ok(run.game.state.decisions.some((d) => d.name === 'original.general' && d.value === fate), `${fate} is a logged decision`);
    if (ruling) assert.equal(run.vars['b1.senate_ruling'], ruling, fate);
    if (after) assert.equal(run.vars['b1.tarrax_after'], after, fate);
  }
  const sealed = await playFrom('b1c18', 'hearing', {}, [FATE.sealed]);
  assert.equal(general(sealed).state, 'sealed');
  assert.equal(sealed.vars['b1.senate_ruling'], 'accepted');
  assert.equal(sealed.vars['b1.tarrax_after'], 'satisfied');
});

test('a bargain is only lawful when it was witnessed, and records its terms', async () => {
  const witnessed = await playFrom('b1c18', 'hearing', { 'b1.witnessed': true }, [FATE.bargain, /feed on Rome/, /come when you call/, /it is enough/]);
  assert.equal(witnessed.vars['b1.senate_ruling'], 'deferred');
  assert.equal(witnessed.vars['b1.general_terms'], 2);
  const bare = await playFrom('b1c18', 'hearing', {}, [FATE.bargain, /feed on Rome/, /it is enough/]);
  assert.equal(bare.vars['b1.senate_ruling'], 'defied');
  assert.equal(bare.vars['b1.general_terms'], 1);
});

test('the true name is only on offer to a hero the General has come to trust', async () => {
  const cold = await playFrom('b1c18', 'hearing', { 'bond.general': 0 }, [FATE.bargain, /feed on Rome/, /it is enough/]);
  assert.equal(general(cold).name, false);
  const warm = await playFrom('b1c18', 'hearing', { 'bond.general': 5 }, [FATE.bargain, /true name/, /it is enough/]);
  assert.equal(general(warm).name, true);
});

test('the three ways to seal him follow what he bought or carries', async () => {
  const senate = await playFrom('b1c18', 'hearing', {}, [FATE.sealed]);
  assert.equal(senate.vars['b1.seal_kind'], 'senate');
  const cell = await playFrom('b1c18', 'hearing', { 'b1.cedar_cell': true }, [FATE.sealed, /Merchant house's cell/]);
  assert.equal(cell.vars['b1.seal_kind'], 'yours');
  const pegs = await playFrom('b1c18', 'hearing', { 'b1.cedar': true }, [FATE.sealed, /nine pegs/]);
  assert.equal(pegs.vars['b1.seal_kind'], 'thin');
  assert.ok(!pegs.vars['b1.cedar'], 'the pegs are used up');
});

test('drinking him raises his age tier and makes a lasting enemy', async () => {
  const before = await playFrom('b1c18', 'hearing', { age: 1 }, [FATE.loosed]);
  const run = await playFrom('b1c18', 'hearing', { age: 1 }, [FATE.drunk, /Take it. All of it/]);
  assert.equal(run.vars.age, before.vars.age + 1);
  assert.ok(run.vars['bond.general'] <= -50);
  assert.equal(general(run).fate, 'drunk');
});

test('buying cedar and a road costs coin, and is refused without it', async () => {
  const rich = await playFrom('b1c18', null, { wealth: 40 }, [NIGHT.counting, /in cedar/, /Have it brought out/, /what the house has in the way of a road/, /Have the road made ready/, /That is enough/]);
  assert.equal(rich.vars['b1.cedar_cell'], true);
  assert.equal(rich.vars['b1.escort'], true);
  const poor = await playFrom('b1c18', null, { wealth: 0 }, [NIGHT.counting, /in cedar/, /Leave it in its crate/, /That is enough/]);
  assert.ok(!poor.vars['b1.cedar_cell']);
});

test('the fight at the mouth of the quarry ends the chapter however it goes', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const run = await playFrom('b1c18', 'hearing', {}, [FATE.loosed], { seed });
    assert.equal(run.frame.wait, 'book_end', `seed ${seed}`);
    assert.equal(general(run).fate, 'loosed', `seed ${seed}`);
  }
  const held = await playFrom('b1c18', null, {}, [NIGHT.gate, /hold the mouth/, FATE.loosed]);
  assert.equal(held.frame.wait, 'book_end');
});

test('every way the General was woken plays through both chapters', async () => {
  for (const by of ['bloodline', 'faction', 'hero']) {
    for (const fate of ['loosed', 'bargain', 'drunk', 'sealed']) {
      const run = await playFrom('b1c17', null, {}, [FATE[fate]], { general: by });
      assert.equal(run.frame.wait, 'book_end', `${by} ${fate}`);
      assert.equal(general(run).fate, fate, `${by} ${fate}`);
    }
  }
});

test('the other origins and roles reach the end too', async () => {
  for (const hero of [
    { gender: 'f', origin: 'briton', role: 'gladiator', path: 'captured' },
    { gender: 'x', origin: 'judean', role: 'physician_aide', path: 'exile' },
    { gender: 'm', origin: 'north_african', role: 'merchant', path: 'trader' },
  ]) {
    const run = await playFrom('b1c17', null, {}, [FATE.bargain], { hero });
    assert.equal(run.frame.wait, 'book_end');
    assert.doesNotMatch(run.text, /[{}]/);
  }
});
