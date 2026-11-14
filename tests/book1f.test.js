// Session 12: Book One, chapters 11 and 12. Played start to finish as different heroes and down the branches
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
      let at = Math.max(0, frame.choices.findIndex((c) => /^(That is the whole of it|That is the nine boats settled)/.test(c.text)));
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

const DAYS = [/Let the day go/];
const COUNCIL = [...DAYS, /Keep with the house, and watch/];
const NIGHT = (...leads) => leads;
const SHOP = /lamp seller's shop in the Velabrum/;
const FARM = /Appian Way, where a cell/;
const STATION = /Aventine station, where Rufus is holding/;
const SCRIBE = /Egyptian quarter, to the Scribe/;

test('chapters 11 and 12 are written and the book plays on to its end', async () => {
  const run = await playBook(HERO);
  assert.equal(run.frame.wait, 'book_end');
  assert.notEqual(run.frame.pending, true);
  for (const flag of ['b1.council_voice', 'b1.war_terms', 'b1.theron_fear', 'b1.cell', 'b1.reckoning', 'b1.farm', 'b1.clerk', 'b1.boy', 'b1.scribe']) {
    assert.ok(run.vars[flag], `${flag} is always recorded`);
  }
  assert.equal(run.vars['b1.hill_known'], true, 'every path ends knowing where the lamp seller has gone');
});

test('prose has no dashes and no unresolved braces', async () => {
  for (const wants of [
    [],
    [...COUNCIL, /Stand with Theron/, /Go with Theron's people/, SHOP, FARM, STATION, /Go in with the hunters/],
    [/Walk the burned quarters/, /Take them to the house's cellars/, /Aventine station, where Rufus has sent/, /Tell him the truth/, /Back Prisca/, /Go with the Scribe line/, SHOP, SCRIBE, /Give it to her/, STATION],
    [/Go to the counting house/, /Put a part of the week/, /Argue for mercy/, /Go alone, and do it/, FARM, /Go round to the back door/, SHOP, STATION],
    [/Go to Tiro's room/, /Let the house burn it/, /Walk the burned quarters/, /Pay for a berth/, /Say nothing. Let them decide/, FARM, /Sort them at the door/],
  ]) {
    const run = await playBook(HERO, wants);
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('the days after the fire record what he did about Tiro, the edict and Rufus', async () => {
  for (const [want, value] of [[/Take it/, 'kept'], [/Let the house burn it/, 'burned']]) {
    const run = await playBook(HERO, [/Go to Tiro's room/, want, ...COUNCIL]);
    assert.equal(run.vars['b1.tiro_keep'], value);
  }
  for (const [want, value] of [[/Take them to the house's cellars/, 'hid'], [/Pay for a berth/, 'shipped'], [/Tell him that you are sorry/, 'none']]) {
    const run = await playBook(HERO, [/Walk the burned quarters/, want, ...COUNCIL]);
    assert.equal(run.vars['b1.refuge'], value, String(want));
  }
  for (const [want, value] of [[/Tell him the truth/, 'told'], [/Tell him that he saw a man in a great fire/, 'lied'], [/Ask him what he would do/, 'deflected']]) {
    const run = await playBook(HERO, [/Aventine station, where Rufus has sent/, want, ...COUNCIL]);
    assert.equal(run.vars['b1.rufus_told'], value);
  }
  const rebuilt = await playBook(HERO, [/Go to the counting house/, /Put a part of the week/, ...COUNCIL]);
  assert.equal(rebuilt.vars['b1.rebuilt'], true);
});

test('a hero too poor to buy a berth is not stranded: the cellars take the cobbler', async () => {
  const run = await playFrom('b1c11', null, { wealth: 0 }, [/Walk the burned quarters/, /Pay for a berth/, ...COUNCIL]);
  assert.equal(run.vars['b1.refuge'], 'hid');
  assert.equal(run.frame.wait, 'book_end');
});

test('what he says in the quarry sets the terms of the hunt', async () => {
  for (const [want, voice, terms] of [
    [/Stand with Theron/, 'war', 'total'],
    [/Back Prisca/, 'limits', 'limited'],
    [/Say nothing. Let them decide/, 'silent', 'limited'],
  ]) {
    const run = await playBook(HERO, [...COUNCIL, want]);
    assert.equal(run.vars['b1.council_voice'], voice);
    assert.equal(run.vars['b1.war_terms'], terms);
  }
});

test('mercy is carried by a humane hero and fails, as limits, for one with no standing in the quarry', async () => {
  const humane = await playFrom('b1c11', 'voice', { humanity: 80 }, [/Argue for mercy/]);
  assert.equal(humane.vars['b1.war_terms'], 'mercy');
  const cold = await playFrom('b1c11', 'voice', { humanity: 10, 'b1.rufus_saw': 'unseen' }, [/Argue for mercy/]);
  assert.equal(cold.vars['b1.council_voice'], 'mercy');
  assert.equal(cold.vars['b1.war_terms'], 'limited');
});

test('asking who is glad is only offered to a hero who has a reason to', async () => {
  for (const [vars, expect] of [
    [{ 'b1.flavus_night': 'heard', 'b1.blame': 'silent' }, true],
    [{ 'b1.blame': 'named', 'b1.flavus_night': 'unmet' }, true],
    [{ 'b1.blame': 'pressed', 'b1.flavus_night': 'faced' }, true],
    [{ 'b1.blame': 'silent', 'b1.flavus_night': 'unmet' }, false],
  ]) {
    const frame = await frameAt('b1c11', 'voice', vars);
    assert.equal(frame.wait, 'choices');
    assert.equal(frame.choices.some((c) => /Ask who is glad/.test(c.text)), expect, JSON.stringify(vars));
  }
  const run = await playFrom('b1c11', 'voice', { 'b1.flavus_night': 'heard' }, [/Ask who is glad/]);
  assert.equal(run.vars['b1.council_voice'], 'glad');
  assert.equal(run.vars['b1.war_terms'], 'limited');
});

test('the old soldier\'s fear is met three ways, and the bronze door can be listened to or left', async () => {
  for (const [want, value] of [[/Ask him, now, in front of all of them/, 'pressed'], [/Say that you will speak to him afterward/, 'private'], [/Say nothing, and let it pass/, 'ignored']]) {
    const run = await playBook(HERO, [...DAYS, /Keep with the house, and watch/, want]);
    assert.equal(run.vars['b1.theron_fear'], value);
    assert.ok(!run.vars['b1.felt_below']);
  }
  const listened = await playBook(HERO, [...DAYS, /Go close to the bronze door and listen/, /Say that you will speak to him afterward/]);
  assert.equal(listened.vars['b1.felt_below'], true);
  assert.match(listened.text, /Do not stand at that door again/);
});

test('each hunt can be joined, and the lone hunter can go it alone', async () => {
  for (const [want, value] of [[/Go with the house/, 'house'], [/Go with Theron's people/, 'theron'], [/Go with the Scribe line/, 'meritamun'], [/Go alone, and do it/, 'alone']]) {
    const run = await playBook(HERO, [/swear it all/, ...COUNCIL, want]);
    assert.equal(run.vars['b1.cell'], value);
    assert.equal(run.frame.wait, 'book_end');
  }
  const alone = await playBook(HERO, [/go alone/, ...COUNCIL]);
  assert.equal(alone.vars['b1.coven'], 'alone');
  assert.notEqual(alone.vars['b1.cell'], 'house', 'a hero outside the house is not offered its hunt');
});

test('the farm can be joined, sorted, emptied or watched, and every ending is recorded', async () => {
  for (const [want, value] of [[/Go in with the hunters/, 'joined'], [/Sort them at the door/, 'sorted'], [/Go round to the back door/, 'stopped'], [/Stand aside, and do nothing/, 'stood_aside']]) {
    for (const terms of ['total', 'limited', 'mercy']) {
      const run = await playFrom('b1c12', null, { 'b1.war_terms': terms, 'b1.cell': 'theron' }, [FARM, want]);
      assert.equal(run.vars['b1.farm'], value, `${terms} ${want}`);
      assert.equal(run.frame.wait, 'book_end', `${terms} ${want}`);
    }
  }
});

test('the farm fight ends the chapter however it goes', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const strike of [/Hold the door/, /Tell her that she has a son's age/, /Go over the orchard wall/]) {
      const game = await newGame();
      game.setSetting('dev', true);
      await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
      const frame = await dev.jump(game, 'b1c12', {});
      dev.setVar(game, 'b1.war_terms', 'total');
      dev.setVar(game, 'b1.cell', 'theron');
      const run = await drive(game, frame, [FARM, /Go round to the back door/, strike]);
      assert.equal(run.frame.wait, 'book_end', `seed ${seed} ${strike}`);
      assert.equal(run.vars['b1.farm'], 'stopped');
    }
  }
});

test('the clerk is kept, freed or killed, and the book goes with whoever did it', async () => {
  for (const [want, value] of [[/bring them to Meritamun/, 'kept'], [/put him on the road with silver/, 'freed'], [/do what the war says/, 'dead']]) {
    const run = await playFrom('b1c12', null, { 'b1.war_terms': 'limited', 'b1.cell': 'alone' }, [SHOP, want]);
    assert.equal(run.vars['b1.clerk'], value);
    assert.equal(run.vars['b1.ledger'], true);
    assert.equal(run.vars['b1.hill_known'], true);
  }
});

test('young hunters at the shop can be fought off or allowed past, and either way the night ends', async () => {
  const stepped = await playFrom('b1c12', null, { 'b1.war_terms': 'total', 'b1.cell': 'theron' }, [SHOP, /Step aside/]);
  assert.equal(stepped.vars['b1.clerk'], 'dead');
  for (const seed of [1, 2, 3, 4, 5]) {
    const game = await newGame();
    game.setSetting('dev', true);
    await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
    const frame = await dev.jump(game, 'b1c12', {});
    dev.setVar(game, 'b1.war_terms', 'total');
    dev.setVar(game, 'b1.cell', 'theron');
    const run = await drive(game, frame, [SHOP, /Stand between them/, /Put him behind you/, /bring them to Meritamun/]);
    assert.equal(run.frame.wait, 'book_end', `seed ${seed}`);
    assert.ok(['kept', 'dead', 'freed'].includes(run.vars['b1.clerk']), `seed ${seed}`);
  }
});

test('the vigiles\' prisoner can be kept, freed or handed over', async () => {
  for (const [want, value] of [[/Tell Rufus that the man is in his keeping/, 'vigiles'], [/Let him go, by the back stair/, 'freed'], [/Take him to Theron's people/, 'dead']]) {
    for (const told of ['told', 'lied', 'deflected', 'unmet']) {
      const run = await playFrom('b1c12', null, { 'b1.rufus_told': told, 'b1.saved_house': told === 'told' }, [STATION, want]);
      assert.equal(run.vars['b1.boy'], value, `${told} ${want}`);
    }
  }
  const avenged = await playFrom('b1c12', null, { 'b1.tiro_end': 'avenged' }, [STATION, /Tell Rufus that the man is in his keeping/]);
  assert.equal(avenged.vars['b1.boy'], 'vigiles');
});

test('the Scribe line gives its hint to everyone, and its bargain to a hero who brings the book', async () => {
  const withBook = await playFrom('b1c12', null, { 'b1.war_terms': 'limited', 'b1.cell': 'alone' }, [SHOP, /bring them to Meritamun/, SCRIBE, /Give it to her/]);
  assert.equal(withBook.vars['b1.scribe'], 'deal');
  const refused = await playFrom('b1c12', null, { 'b1.war_terms': 'limited', 'b1.cell': 'alone' }, [SHOP, /bring them to Meritamun/, SCRIBE, /Keep it, and tell her/]);
  assert.equal(refused.vars['b1.scribe'], 'none');
  const without = await playFrom('b1c12', null, { 'b1.cell': 'meritamun' }, [SCRIBE]);
  assert.equal(without.vars['b1.scribe'], 'hint');
  assert.ok(without.game.state.sys.lore.codex.scribe_house);
});

test('the first night is summed up as mercy, mixed or slaughter by what was done', async () => {
  const mercy = await playFrom('b1c12', null, { 'b1.war_terms': 'mercy', 'b1.cell': 'alone' }, [FARM, /Go round to the back door/, SHOP, /bring them to Meritamun/, STATION, /Tell Rufus that the man is in his keeping/]);
  assert.equal(mercy.vars['b1.reckoning'], 'mercy');
  const blood = await playFrom('b1c12', null, { 'b1.war_terms': 'total', 'b1.cell': 'theron' }, [FARM, /Go in with the hunters/, SHOP, /Step aside/, STATION, /Take him to Theron's people/]);
  assert.equal(blood.vars['b1.reckoning'], 'slaughter');
  const mixed = await playFrom('b1c12', null, { 'b1.war_terms': 'limited', 'b1.cell': 'house' }, [FARM, /Sort them at the door/, SHOP, /bring them to Meritamun/, STATION, /Let him go/]);
  assert.equal(mixed.vars['b1.reckoning'], 'mixed');
});

test('the codex gains the quarry and the two lines', async () => {
  const run = await playBook(HERO, [...DAYS, /Keep with the house, and watch/, /Go with the Scribe line/, SCRIBE]);
  for (const id of ['the_old_quarry', 'general_house']) assert.ok(run.game.state.sys.lore.codex[id], id);
});

test('every mortal role plays chapters 11 and 12 to the end of the book, in the house and alone', async () => {
  for (const role of ['gladiator', 'legionary', 'merchant', 'physician_aide', 'house_slave']) {
    for (const oath of [/swear it all/, /go alone/]) {
      const run = await playBook({ ...HERO, role }, [oath, ...COUNCIL]);
      assert.equal(run.frame.wait, 'book_end', `${role} ${oath}`);
      assert.notEqual(run.frame.pending, true);
    }
  }
});

test('the hunt night spends its three actions and then ends, whichever leads he follows', async () => {
  const run = await playFrom('b1c12', null, { 'b1.cell': 'alone' }, [STATION, SCRIBE, SHOP, /bring them to Meritamun/, /Tell Rufus/]);
  assert.equal(run.frame.wait, 'book_end');
  assert.ok(run.vars['b1.clerk'] === 'kept' && run.vars['b1.boy'] === 'vigiles' && run.vars['b1.scribe'] !== 'none');
});
