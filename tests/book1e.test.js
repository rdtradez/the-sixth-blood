// Session 11: Book One, chapters 9 and 10. Played start to finish as different heroes and down the branches
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

async function playBook(hero, wants = [], seed = 3) {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {}, now: () => 5000 });
  await game.init();
  let { frame } = await game.startBook('burning-city', { from: 'new', hero, seed });
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

const DAY = [/Let the day end/];
const BEST = [/Follow the carts/, /Take the cart, smash/, /Aventine station/, /Tell him everything/, /Go through the Subura/, /Go door to door, in daylight/,
  /break the lamps/, /Soak the awnings/, /Put your shoulders under/, /Go down into the vaults and bring/, /Go in through the burning door/,
  /foot of the hill, where the insulae/, /Emporium, and the house/, /Subura, where Naevia/];
const WORST = [...DAY, /Let it come, and be the one/, /Stay where you are, and watch/, /Go up the hill, to the lamp bearers/, /Say nothing, and let him speak/,
  /foot of the hill, where the insulae/, /Work the bucket line/, /Subura, where Naevia/, /Pull down the wooden stair/];

test('chapters 9 and 10 are written and the book plays on to its end', async () => {
  const run = await playBook(HERO);
  assert.equal(run.frame.wait, 'book_end');
  assert.notEqual(run.frame.pending, true);
  for (const flag of ['b1.fire_stance', 'b1.circus', 'b1.evacuated', 'b1.vaults', 'b1.tiro_end', 'b1.rufus_saw', 'b1.fire_toll', 'b1.blame']) {
    assert.ok(run.vars[flag], `${flag} is always recorded`);
  }
});

test('prose has no dashes and no unresolved braces', async () => {
  for (const wants of [[], BEST, WORST, [/Hit him/, /Slip down/, /Run/, /Go for him/, /Go after the one who threw/]]) {
    const run = await playBook(HERO, wants);
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('what he does on the eve is recorded: the vigiles, the Subura and the vaults', async () => {
  const told = await playBook(HERO, [/Aventine station/, /Tell him everything/, ...DAY]);
  const silent = await playBook(HERO, [/Aventine station/, /Say nothing. There is no way/, ...DAY]);
  assert.equal(told.vars['b1.vigiles_ready'], true);
  assert.ok(!silent.vars['b1.vigiles_ready']);
  for (const [want, value] of [[/Go door to door, in daylight/, 'many'], [/Tell Naevia, and let her/, 'some'], [/Pay the criers/, 'some'], [/should not sleep in the shop/, 'none']]) {
    const run = await playBook(HERO, [/Go through the Subura/, want, ...DAY]);
    assert.equal(run.vars['b1.evacuated'], value, String(want));
  }
  const moved = await playBook(HERO, [/vaults of the Emporium/, /Ask her to move the sleepers/, ...DAY]);
  const stayed = await playBook(HERO, [/vaults of the Emporium/, /Tell her the stone will hold/, ...DAY]);
  assert.equal(moved.vars['b1.vaults'], 'moved');
  assert.equal(stayed.vars['b1.vaults'], 'stayed');
});

test('the three stances are recorded, and each plays through the first watch', async () => {
  for (const [want, value] of [[/break the lamps/, 'stop'], [/Hold the line where the fire will come/, 'survive'], [/Let it come, and be the one/, 'use']]) {
    const run = await playBook(HERO, [...DAY, want]);
    assert.equal(run.vars['b1.fire_stance'], value);
    assert.equal(run.frame.wait, 'book_end');
  }
  for (const want of [/Soak the awnings/, /Take the cell at the awnings/, /Put the buckets and ladders/, /door to door through the shops/, /Walk with the lamp bearers/, /Stay where you are, and watch/]) {
    const run = await playBook(HERO, [...DAY, /break the lamps/, /Hold the line where/, /Let it come, and be/, want]);
    assert.equal(run.frame.wait, 'book_end', String(want));
  }
});

test('the carts: each way of meeting the driver is allowed, and a lone cart can be stopped', async () => {
  for (const want of [/Take the cart, smash/, /kill the driver/, /Let it go, and watch/]) {
    const run = await playBook(HERO, [/Follow the carts/, want, ...DAY]);
    assert.equal(run.frame.wait, 'book_end', String(want));
    assert.equal(run.vars['b1.posts'], 'all');
  }
});

test('the Circus goes up differently when he has done enough, watched, or done nothing', async () => {
  const stopped = await playBook(HERO, [/Follow the carts/, /Take the cart, smash/, ...DAY, /break the lamps/, /Soak the awnings/]);
  const watched = await playBook(HERO, [...DAY, /Let it come, and be the one/, /Stay where you are, and watch/]);
  const burned = await playBook(HERO, [...DAY, /Hold the line where the fire will come/, /door to door through the shops/]);
  assert.equal(stopped.vars['b1.circus'], 'stopped');
  assert.equal(watched.vars['b1.circus'], 'let');
  assert.equal(burned.vars['b1.circus'], 'burned');
});

test('Tiro dies in every path, in the circle or out of it, and how he is let go is recorded', async () => {
  for (const [want, value] of [[/Stay with him/, 'held'], [/Carry him to the river/, 'carried'], [/Go after the one who threw it/, 'avenged']]) {
    for (const coven of [/swear it all/, /go alone/]) {
      const run = await playBook(HERO, [coven, want]);
      assert.equal(run.vars['b1.tiro_end'], value, `${want} ${coven}`);
      assert.equal(run.game.state.sys.people.tiro.fate, 'dead');
      if (value !== 'x' && run.vars['b1.coven'] === 'stayed') assert.equal(run.game.state.sys.circle.tiro.status, 'dead');
    }
  }
});

test('where he goes in the night is what he saves, and the other places are lost', async () => {
  const foot = await playBook(HERO, [/foot of the hill, where the insulae/, /Go up the burning stair/, /Go up the hill, to the lamp bearers/, /Say nothing, and let him speak/, /Subura, where Naevia/, /Lead the street out/]);
  assert.equal(foot.vars['b1.saved_foot'], true);
  assert.equal(foot.vars['b1.saved_subura'], true);
  assert.ok(!foot.vars['b1.saved_house']);
  assert.equal(foot.vars['b1.flavus_night'], 'heard');
  const house = await playBook(HERO, [/Emporium, and the house/, /Roll the oil into the river/, /Go up the hill, to the lamp bearers/, /Say nothing, and let him speak/, /foot of the hill, where the insulae/, /Work the bucket line/]);
  assert.ok(!house.vars['b1.saved_subura']);
});

test('the lamp seller is faced, heard or never met, and the fights on the wharf and the hill all end the chapter', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const wants of [
      [/Go up the hill, to the lamp bearers/, /Go for him/, /Break through the kneeling men/, /Emporium, and the house/, /Take the wharf from them/, /Break through them/],
      [/Go up the hill, to the lamp bearers/, /Go for him/, /Run/, /Emporium, and the house/, /Take the wharf from them/, /Run/],
      [/Go up the hill, to the lamp bearers/, /Go for him/, /Talk to him/, /Emporium, and the house/, /Take the wharf from them/, /Talk to the young one/],
    ]) {
      const run = await playBook(HERO, wants, seed);
      assert.equal(run.frame.wait, 'book_end', `seed ${seed} ${wants.map(String)}`);
      assert.ok(['faced', 'heard', 'unmet'].includes(run.vars['b1.flavus_night']));
    }
  }
});

test('the toll runs from light to terrible depending on what he did', async () => {
  const best = await playBook(HERO, BEST, 2);
  const worst = await playBook(HERO, WORST, 2);
  assert.equal(best.vars['b1.fire_toll'], 'light');
  assert.equal(worst.vars['b1.fire_toll'], 'terrible');
});

test('the vigil sees what he did, and the Senate quiet is answered three ways', async () => {
  const mercy = await playBook(HERO, [/foot of the hill, where the insulae/, /Put your shoulders under/, /Subura, where Naevia/, /Go in through the burning door/, /Emporium, and the house/, /Roll the oil/, /Stay with him/]);
  assert.ok(['mercy', 'both'].includes(mercy.vars['b1.rufus_saw']));
  const blood = await playBook(HERO, [/Go after the one who threw it/, /Go up the hill, to the lamp bearers/, /Go for him/]);
  assert.ok(['slaughter', 'both'].includes(blood.vars['b1.rufus_saw']));
  for (const [want, value] of [[/Give him a name/, 'named'], [/Tell him that he knows exactly/, 'pressed'], [/Say nothing. Watch the city burn/, 'silent']]) {
    const run = await playBook(HERO, [want]);
    assert.equal(run.vars['b1.blame'], value);
  }
});

test('the Great Fire is in the codex', async () => {
  const run = await playBook(HERO, []);
  assert.ok(run.game.state.sys.lore.codex.the_great_fire);
});

test('a firm that can afford it may buy the burned lots after a night spent watching, and one that cannot is not offered them', async () => {
  for (const [wealth, offered] of [[5000, true], [0, false]]) {
    const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {}, now: () => 5000 });
    await game.init();
    game.setSetting('dev', true);
    let frame = await dev.jump(game, 'b1c10', { scene: 'blame' });
    dev.setVar(game, 'wealth', wealth);
    dev.setVar(game, 'b1.fire_stance', 'use');
    dev.setVar(game, 'b1.circus', 'let');
    frame = await game.choose(frame.choices.findIndex((c) => /Say nothing. Watch the city burn/.test(c.text)));
    const buy = frame.wait === 'choices' ? frame.choices.findIndex((c) => /burned lots/.test(c.text)) : -1;
    assert.equal(buy >= 0, offered, `wealth ${wealth}`);
    if (offered) {
      await game.choose(buy);
      assert.ok(game.state.sys.ventures['rome.insulae'], 'the lots become a venture');
    }
  }
});

test('every mortal role plays chapters 9 and 10 to the end of the book, in the house and alone', async () => {
  for (const role of ['gladiator', 'legionary', 'merchant', 'physician_aide', 'house_slave']) {
    for (const oath of [/swear it all/, /go alone/]) {
      const run = await playBook({ ...HERO, role }, [oath]);
      assert.equal(run.frame.wait, 'book_end', `${role} ${oath}`);
      assert.notEqual(run.frame.pending, true);
    }
  }
});
