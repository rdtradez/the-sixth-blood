// Session 10: Book One, chapters 7 and 8. Played start to finish as different heroes and down the branches
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
  for (let i = 0; i < 1500 && frame.wait !== 'book_end' && !(stopAt && game.state.chapter === stopAt); i++) {
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

test('chapters 7 and 8 are written and the book plays on to its end', async () => {
  const run = await playBook(HERO);
  assert.equal(run.frame.wait, 'book_end');
  assert.notEqual(run.frame.pending, true);
  assert.ok(run.vars['b1.coven'], 'the offer is always answered');
  assert.ok(run.vars['b1.igni_warned'], 'a warning (or none) is always recorded');
});

test('prose has no dashes and no unresolved braces', async () => {
  for (const wants of [[], [/go alone/], [/Hit him/], [/Slip down/, /Run/]]) {
    const run = await playBook(HERO, wants);
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('the offer: staying, staying with a reservation and going alone are recorded and different', async () => {
  const full = await playBook(HERO, [/swear it all/]);
  const reserved = await playBook(HERO, [/keep one thing back/]);
  const alone = await playBook(HERO, [/go alone/]);
  assert.equal(full.vars['b1.coven'], 'stayed');
  assert.equal(full.vars['b1.oath'], 'full');
  assert.equal(reserved.vars['b1.coven'], 'stayed');
  assert.equal(reserved.vars['b1.oath'], 'reserved');
  assert.equal(alone.vars['b1.coven'], 'alone');
  assert.equal(alone.vars['b1.oath'], 'none');
  assert.ok(full.game.state.sys.circle.prisca, 'the house joins his circle when he stays');
  assert.ok(full.game.state.sys.circle.tiro);
  assert.ok(!alone.game.state.sys.circle.prisca, 'and does not when he goes alone');
  assert.equal(full.game.state.sys.path, 'coven');
  assert.equal(alone.game.state.sys.path, 'lone');
  assert.ok(reserved.vars.defiance > full.vars.defiance, 'a reserved oath is a defiant one');
  assert.ok(alone.vars.defiance > full.vars.defiance);
});

test('every vow and every way of reaching the offer plays to the end of the book', async () => {
  for (const vow of [/Swear it off/, /only the willing/, /Swear nothing/]) {
    for (const oath of [/swear it all/, /keep one thing back/, /go alone/]) {
      const run = await playBook(HERO, [vow, oath]);
      assert.equal(run.frame.wait, 'book_end', `${vow} ${oath}`);
    }
  }
});

test('the two nights give four ways to spend them and each can be taken', async () => {
  for (const want of [/Tiro keeps his watch/, /open ledger/, /Walk the city alone/, /ask her plainly/]) {
    const run = await playBook(HERO, [want]);
    assert.equal(run.frame.wait, 'book_end', String(want));
  }
  for (const want of [/Lose him/, /Let him follow/, /Turn on him/]) {
    const run = await playBook(HERO, [/Walk the city alone/, want]);
    assert.equal(run.frame.wait, 'book_end', String(want));
  }
});

test('the vigil can be told the truth, lied to or pressed', async () => {
  for (const [want, value] of [[/Tell him the truth/, 'trusted'], [/a surveyor/, 'none'], [/Press him hard/, 'wary']]) {
    const run = await playBook(HERO, [/burned warehouse/, want]);
    assert.equal(run.vars['b1.rufus'], value);
    assert.ok(run.game.state.sys.lore.codex.the_vigiles, 'the codex learns the vigiles');
  }
});

test('the lamp seller can be questioned, struck or left, and a blow is seen', async () => {
  const spoke = await playBook(HERO, [/lamp seller in the Velabrum/, /Keep your face/], 3, 'b1c09');
  const struck = await playBook(HERO, [/lamp seller in the Velabrum/, /Hit him/], 3, 'b1c09');
  const left = await playBook(HERO, [/lamp seller in the Velabrum/, /Say nothing, and leave/]);
  assert.equal(spoke.vars['b1.flavus'], 'spoke');
  assert.equal(struck.vars['b1.flavus'], 'struck');
  assert.equal(left.vars['b1.flavus'], 'spoke');
  assert.ok(struck.vars.secrecy < spoke.vars.secrecy, 'a blow in daylight costs secrecy');
  assert.match(struck.text, /remember your face/);
});

test('the cellar: watching gives the whole plan, and every way of being found still ends the chapter', async () => {
  const watch = await playBook(HERO, [/Watch from the grate/]);
  assert.equal(watch.vars['b1.plan'], 'full');
  assert.ok(watch.game.state.sys.lore.codex.the_igniferi);
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const wants of [[/Slip down/, /Run/], [/Slip down/, /Break through/], [/Take a man alone/, /Talk your way out/], [/Take a man alone/, /Feint/]]) {
      const run = await playBook(HERO, wants, seed);
      assert.equal(run.frame.wait, 'book_end', `seed ${seed} ${wants.map(String)}`);
      assert.ok(['full', 'partial'].includes(run.vars['b1.plan']));
    }
  }
});

test('who he tells is recorded, and telling the Lictors raises Standing more than telling no one', async () => {
  const none = await playBook(HERO, [/Tell no one/]);
  const house = await playBook(HERO, [/Go to Prisca, and the house/]);
  const lictors = await playBook(HERO, [/Go to Galerius/]);
  const both = await playBook(HERO, [/both, one after the other/]);
  assert.equal(none.vars['b1.igni_warned'], 'none');
  assert.equal(house.vars['b1.igni_warned'], 'house');
  assert.equal(lictors.vars['b1.igni_warned'], 'lictors');
  assert.equal(both.vars['b1.igni_warned'], 'both');
  assert.ok(lictors.vars.standing > none.vars.standing);
  assert.ok(none.vars.defiance > house.vars.defiance, 'keeping it to himself is a defiant act');
});

test('every mortal role plays chapters 7 and 8 to the end of the book, in the house and alone', async () => {
  for (const role of ['gladiator', 'legionary', 'merchant', 'physician_aide', 'house_slave']) {
    for (const oath of [/swear it all/, /go alone/]) {
      const run = await playBook({ ...HERO, role }, [oath]);
      assert.equal(run.frame.wait, 'book_end', `${role} ${oath}`);
      assert.notEqual(run.frame.pending, true);
    }
  }
});
