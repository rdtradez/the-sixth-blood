// Session 7: Book One, chapters 1 and 2. The two chapters are played start to finish as different
// heroes, down different paths, and the facts that later chapters and books depend on are checked.
// (This file says what is guaranteed, not what happens: chapter details stay out of the tests.)

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

async function realGame() {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {}, now: () => 5000 });
  await game.init();
  return game;
}

const HERO = { gender: 'm', origin: 'roman', role: 'legionary', path: 'born_in_rome' };

/**
 * Play from a new game until the written part of the book pauses. `wants` is a list of patterns in
 * priority order: at every choice the first pattern that matches an option is picked, otherwise the
 * first option is.
 */
async function playBook(hero, wants = [], seed = 3, stopAt = null) {
  const game = await realGame();
  let { frame } = await game.startBook('burning-city', { from: 'new', hero, seed });
  const pages = [];
  const picked = [];
  for (let i = 0; i < 600 && frame.wait !== 'book_end' && !(stopAt && game.state.chapter === stopAt); i++) {
    pages.push(...texts(frame));
    if (frame.wait === 'choices') {
      let at = 0;
      for (const want of wants) {
        const hit = frame.choices.findIndex((c) => want.test(c.text));
        if (hit >= 0) { at = hit; break; }
      }
      picked.push(frame.choices[at].text);
      frame = await game.choose(at);
    } else {
      frame = await game.continue();
    }
  }
  pages.push(...texts(frame));
  return { game, frame, text: pages.join('\n'), vars: game.state.vars, picked };
}

test('chapters 1 to 4 play to the end of the book for every mortal role, with no leftovers or dashes', async () => {
  for (const [role, origin, path] of [
    ['gladiator', 'gaul', 'captured'],
    ['legionary', 'briton', 'auxiliary'],
    ['merchant', 'north_african', 'trader'],
    ['physician_aide', 'judean', 'wanderer'],
    ['house_slave', 'egyptian', 'freed'],
  ]) {
    const run = await playBook({ gender: 'f', origin, role, path });
    assert.equal(run.frame.wait, 'book_end', role);
    assert.notEqual(run.frame.pending, true, `${role}: the book ends rather than pausing`);
    assert.doesNotMatch(run.text, /\{|\}|undefined|NaN|\[object|\bnull\b/, role);
    assert.doesNotMatch(run.text, /[–—]/, `${role}: no dashes in the story text`);
  }
});

test('every path the branch explorer walks through chapters 1 and 2 is free of errors', async () => {
  const game = await realGame();
  for (const id of ['b1c01', 'b1c02', 'b1c03', 'b1c04']) {
    const base = game.quickState('burning-city', { hero: game.suggestHero({ ...HERO }) });
    const report = await dev.explore(game, id, { base });
    assert.deepEqual(report.errors, [], id);
  }
});

test('the evening in Collesanto: the window, the door and the square can each be played', async () => {
  const window = await playBook(HERO, [/Look in at your own window/, /Let her see you/, /Wait in the dark/]);
  assert.equal(window.vars['b1.reveal'], 'aelia');
  const door = await playBook(HERO, [/Knock at your own door/, /Tell the truth/, /Wait in the dark/]);
  assert.equal(door.vars['b1.reveal'], 'spouse');
  assert.equal(door.vars['b1.spouse_told'], 'truth');
  const sextus = await playBook(HERO, [/Wait for the dawn/, /Go down to the square/, /Step out of the shadow/]);
  assert.equal(sextus.vars['b1.first_blood'], 'forced');
  assert.ok(sextus.game.state.sys.people.sextus);
  assert.ok(sextus.vars['bond.sextus'] > 0, 'the shepherd becomes a friend');
  const boy = await playBook(HERO, [/Hunt in the oak wood/, /Go down to the square/, /Trim the wick/]);
  assert.ok(boy.game.state.sys.people.quintus);
  assert.ok(boy.vars['bond.quintus'] > 0);
});

test('the fire takes the spouse and spares the children, whatever the player does', async () => {
  const paths = [
    [/Run for your house/, /Go in through the fire/],
    [/Run for your house/, /Hold back/],
    [/Carry the old/, /Break the torchmen/, /Put the villagers/, /Go in through the fire/],
    [/Carry the old/, /Break the torchmen/, /Put the villagers/, /Hold back/],
  ];
  for (const wants of paths) {
    const run = await playBook(HERO, wants);
    const st = run.game.state;
    assert.equal(st.sys.people.spouse.fate, 'dead', wants.join(' '));
    assert.notEqual(st.sys.people.aelia.fate, 'dead');
    assert.notEqual(st.sys.people.felix.fate, 'dead');
    assert.ok(st.sys.lore.kin.aelia && st.sys.lore.kin.felix, 'the children are known to the family tree');
    const wentIn = wants.some((w) => /Go in/.test(w.source));
    assert.equal(run.vars['b1.spouse_fire'], wentIn ? 'went_in' : 'held_back');
    assert.equal(Boolean(run.vars['b1.saw_marks']), wentIn, 'the marks are seen only by a hero who goes in');
    assert.ok(run.vars.injury >= 0);
  }
});

test('going into the fire wounds the hero; blood from the prisoner heals him', async () => {
  // Stop as chapter 3 opens: later chapters add wounds of their own.
  const wounded = await playBook(HERO, [/Run for your house/, /Go in through the fire/, /Ask him who sent him/], 3, 'b1c03');
  const healed = await playBook(HERO, [/Run for your house/, /Go in through the fire/, /Feed/], 3, 'b1c03');
  assert.ok(wounded.vars.injury >= 30, 'the burns stay with a hero who does not feed');
  assert.equal(healed.vars.injury, 0);
  assert.equal(healed.vars['b1.prisoner'], 'fed');
  assert.equal(wounded.vars['b1.prisoner'], 'village');
});

test('the first night: a hero who never feeds is taken by the hunger, and the village hears of it', async () => {
  const forced = await playBook(HERO, [/Wait for the dawn/], 3, 'lc01');
  assert.equal(forced.vars['b1.first_blood'], 'forced');
  assert.ok(forced.game.state.sys.people.sextus, 'Sextus has been met');
  assert.ok(forced.game.state.sys.lore.codex.the_hunger, 'the hunger entry is found');
  const hunter = await playBook(HERO, [/Hunt in the oak wood/], 3, 'lc01');
  assert.equal(hunter.vars['b1.first_blood'], 'animal');
  const kill = await playBook(HERO, [/Go down to the crossroads/, /End it/, /Leave it/], 3, 'lc01');
  assert.equal(kill.vars['b1.first_blood'], 'killed');
  assert.equal(kill.vars['b1.collector'], 'killed');
  assert.ok(kill.vars.humanity < hunter.vars.humanity, 'a killing costs Humanity');
});

test('the strangers in the wood: following them, warning the village and silence all play', async () => {
  const outcome = {};
  for (const [name, want] of [['followed', /Follow them/], ['warned', /Go down and warn/], ['none', /Say nothing/]]) {
    const run = await playBook(HERO, [/Watch the village from the ridge/, want, /Run for your house/, /Hold back/]);
    outcome[name] = run.vars;
    assert.equal(run.vars['b1.warning'], name);
  }
  assert.ok(outcome.warned.collesanto > outcome.none.collesanto, 'a village that was warned loses less to the fire');
});

test('the daylight is survived and the sun is in the codex', async () => {
  for (const want of [/Hide in the cellar/, /Put your hand into the light/, /Walk out into it/]) {
    const run = await playBook(HERO, [want]);
    assert.ok(run.game.state.sys.lore.codex.the_sun, String(want));
    assert.ok(run.game.state.sys.lore.codex.the_villa === undefined || run.game.state.sys.lore.codex.the_villa);
  }
});

test('a quick start into Book Two finds the spouse and the children dead, a thousand years on', async () => {
  const game = await realGame();
  const q = game.quickState('blood-and-gold', { hero: { origin: 'roman' } });
  assert.equal(q.sys.lore.kin.spouse.status, 'dead');
  for (const id of ['aelia', 'felix']) assert.equal(q.sys.lore.kin[id].status, 'dead', id);
});
