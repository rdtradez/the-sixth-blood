// Session 8: Book One, chapters 3 and 4. Played start to finish as different heroes and down the branches
// that later chapters depend on. (This file says what is guaranteed, not what happens.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeLoader } from '../engine/node-loader.js';
import { MemoryStorage } from '../engine/saves.js';
import { Game } from '../engine/game.js';
import { texts } from './helpers.js';

const root = join(fileURLToPath(import.meta.url), '../..');
const real = createNodeLoader(root);
const HERO = { gender: 'm', origin: 'roman', role: 'legionary', path: 'born_in_rome' };

async function playBook(hero, wants = [], seed = 3, stopAt = null) {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {}, now: () => 5000 });
  await game.init();
  let { frame } = await game.startBook('burning-city', { from: 'new', hero, seed });
  const pages = [];
  for (let i = 0; i < 900 && frame.wait !== 'book_end' && !(stopAt && game.state.chapter === stopAt); i++) {
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

test('Rome by night: every first feeding is recorded and the hunger is dealt with', async () => {
  const market = await playBook(HERO, [/Hunt/, /cattle pens/]);
  assert.equal(market.vars['b1.rome_feed'], 'market');
  const drunk = await playBook(HERO, [/Hunt/, /drunk asleep/]);
  assert.equal(drunk.vars['b1.rome_feed'], 'drunk');
  const hunted = await playBook(HERO, [/Hunt/, /gambling den/]);
  assert.equal(hunted.vars['b1.rome_feed'], 'hunted');
  assert.ok(hunted.vars.humanity < market.vars.humanity, 'a killing in the city costs Humanity');
});

test('Tiro finds the hero whatever he does, and a starving hero is stopped from a killing', async () => {
  const idle = await playBook(HERO, [/Walk until the sky begins to pale/]);
  assert.ok(idle.game.state.sys.people.tiro, 'Tiro is met');
  assert.ok(idle.game.state.sys.people.prisca && idle.game.state.sys.people.hanno);
  assert.ok(idle.game.state.sys.lore.codex.merchant_house, 'the Merchant line entry is found');
  const watched = await playBook(HERO, [/Follow the feeling/, /Call up to him/]);
  assert.ok(watched.vars['bond.tiro'] >= 4, 'a friendly first meeting on the rooftops earns his regard');
});

test('the three answers about the maker, and the three terms, can each be played', async () => {
  for (const [want, value] of [[/Tell her everything/, 'told'], [/do not know/, 'withheld'], [/Name a dead stranger/, 'lied']]) {
    const run = await playBook(HERO, [want]);
    assert.equal(run.vars['b1.maker_told'], value);
  }
  for (const [want, value] of [[/Accept the terms/, 'accepted'], [/Bargain over/, 'bargained'], [/Refuse to be ruled/, 'defied']]) {
    const run = await playBook(HERO, [want]);
    assert.equal(run.vars['b1.prisca_terms'], value);
  }
});

test('who learns that the hero walks in daylight depends on the dawn he chooses', async () => {
  const hidden = await playBook(HERO, [/Lie still/]);
  const tiro = await playBook(HERO, [/put your hand in the bar of light/]);
  const prisca = await playBook(HERO, [/Go up and tell Prisca/]);
  assert.equal(hidden.vars['b1.sun_known'], 'none');
  assert.equal(tiro.vars['b1.sun_known'], 'tiro');
  assert.equal(prisca.vars['b1.sun_known'], 'prisca');
});

test('the cup is a real choice with different costs', async () => {
  const cup = await playBook(HERO, [/Go down to the cup room/, /Take the cup/], 3, 'b1c05');
  const alone = await playBook(HERO, [/Go down to the cup room/, /hunt on your own/], 3, 'b1c05');
  assert.equal(cup.vars['b1.cup'], 'accepted');
  assert.equal(alone.vars['b1.cup'], 'alone');
  assert.ok(cup.vars.secrecy > alone.vars.secrecy, 'feeding alone leaves a trail');
});

test('the Lictor: each answer plays, and the watch is set from it', async () => {
  const truth = await playBook(HERO, [/Tell him the truth/]);
  assert.equal(truth.vars['b1.maker_answer'], 'truth');
  assert.equal(truth.vars['b1.galerius'], 'wary');
  const vague = await playBook(HERO, [/Say that you were dying/]);
  assert.equal(vague.vars['b1.maker_answer'], 'vague');
  assert.equal(vague.vars['b1.galerius'], 'watching');
  const lie = await playBook(HERO, [/Give him the name of a dead stranger/]);
  assert.equal(lie.vars['b1.maker_answer'], 'lie');
  for (const run of [truth, vague, lie]) assert.ok(run.game.state.sys.people.galerius, 'Galerius is met');
  const held = await playBook(HERO, [/Refuse to answer/, /Let them take your arms/]);
  assert.equal(held.vars['b1.maker_answer'], 'refuse');
  assert.equal(held.vars['b1.galerius'], 'wary');
  const fought = await playBook(HERO, [/Refuse to answer/, /Break away/, /Break his guard/]);
  assert.equal(fought.vars['b1.maker_answer'], 'refuse');
  assert.ok(['hostile', 'wary'].includes(fought.vars['b1.galerius']), 'a fight with a Lictor ends in enmity or a debt');
});

test('the Senate quarter finds the codex entries on the Lictors and the Senate', async () => {
  const run = await playBook(HERO, [/Walk to the Forum/, /Slip away/]);
  assert.ok(run.game.state.sys.lore.codex.senate_of_blood);
  assert.ok(run.game.state.sys.lore.codex.lictors);
});

test('a hero who refuses the Lictor and fights never reaches a dead end, whatever the result', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const run = await playBook(HERO, [/Refuse to answer/, /Break away/, /Break his guard/], seed);
    assert.equal(run.frame.wait, 'book_end', `seed ${seed}`);
    assert.notEqual(run.frame.pending, true);
    assert.doesNotMatch(run.text, /[–—]/);
  }
});
