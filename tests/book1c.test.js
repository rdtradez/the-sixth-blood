// Session 9: Book One, chapters 5 and 6. Played start to finish as different heroes and down the branches
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

async function playBook(hero, wants = [], seed = 3) {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {}, now: () => 5000 });
  await game.init();
  let { frame } = await game.startBook('burning-city', { from: 'new', hero, seed });
  const pages = [];
  for (let i = 0; i < 1200 && frame.wait !== 'book_end'; i++) {
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

// Histories that decide which breaking point chapter 6 gives the hero.
const CLEAN = [/Hunt in the oak wood/, /leave him to the village/, /Hunt/, /cattle pens/, /Go down to the cup room/, /Refuse, and hunt animals/];
const DRAINED = [/Go down to the crossroads/, /Drink from the sleeping man/, /leave him to the village/, /Hunt/, /cattle pens/, /Go down to the cup room/, /Refuse, and hunt animals/];
const KIN = [/Go down to the crossroads/, /End it/];
// A hero with a stolen strongbox can afford anything the day offers.
const FLUSH = [/Go down to the crossroads/, /End it/, /Take it/, /Keep it/];

test('chapters 5 and 6 are written and the book still pauses after them', async () => {
  const run = await playBook(HERO);
  assert.equal(run.frame.wait, 'book_end');
  assert.equal(run.frame.pending, true);
  assert.ok(run.game.state.vars['b1.collis_start'], 'a first deal is always recorded');
  assert.ok(run.game.state.vars['b1.vow'], 'a vow (or none) is always recorded');
});

test('prose has no dashes and no unresolved braces', async () => {
  for (const wants of [[], CLEAN, DRAINED, KIN]) {
    const run = await playBook(HERO, wants);
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test("Prisca's three terms are each recorded", async () => {
  const partner = await playBook(HERO, [/Keep it/, /Take her stake/]);
  assert.equal(partner.vars['b1.collis_terms'], 'partner');
  const loan = await playBook(HERO, [/Keep it/, /Borrow what you need/]);
  assert.equal(loan.vars['b1.collis_terms'], 'loan');
  const alone = await playBook(HERO, [...FLUSH, /Go alone/]);
  assert.equal(alone.vars['b1.collis_terms'], 'alone');
  assert.ok(alone.vars.standing <= partner.vars.standing, 'going alone earns no favor from the house');
});

test('each honest deal can be struck and is recorded as the first deal', async () => {
  const wine = await playBook(HERO, [/Keep it/, /Go down to the Subura/, /honest price/]);
  assert.equal(wine.vars['b1.collis_start'], 'wine');
  const ship = await playBook(HERO, [/Keep it/, /Take the road to Ostia/, /Buy half his barge/]);
  assert.equal(ship.vars['b1.collis_start'], 'shipping');
  const debts = await playBook(HERO, [/Keep it/, /Follow the grain factor/, /Offer him a choice/, /Buy the good debts/]);
  assert.equal(debts.vars['b1.factor'], 'bound');
  assert.equal(debts.vars['b1.collis_start'], 'lending');
  const land = await playBook(HERO, [/Keep it/, /Take her stake/, /Walk the burned lots/, /Bid for a lot/]);
  assert.equal(land.vars['b1.collis_start'], 'insulae');
});

test('the grain factor can be exposed, bound or spared', async () => {
  for (const [want, value] of [[/Take it to Prisca/, 'exposed'], [/Offer him a choice/, 'bound'], [/Say nothing, and let him go/, 'spared']]) {
    const run = await playBook(HERO, [/Follow the grain factor/, want]);
    assert.equal(run.vars['b1.factor'], value);
  }
});

test('the dark offers cost Humanity, and refusing them keeps it', async () => {
  const refused = await playBook(HERO, [/Keep it/, /Take her stake/, /Walk the burned lots/, /Ask about the other kind/, /Refuse, and make sure/]);
  assert.ok(!['gladiators', 'slaves'].includes(refused.vars['b1.collis_start']));
  const school = await playBook(HERO, [/Keep it/, /Take her stake/, /Walk the burned lots/, /Ask about the other kind/, /Buy a share in the school/]);
  if (school.vars['b1.collis_start'] === 'gladiators') {
    assert.ok(school.vars.humanity < refused.vars.humanity, 'a gladiator school costs Humanity');
  }
  for (const wants of [[/Keep it/, /Take her stake/, /Walk the burned lots/, /Ask about the other kind/, /Buy the other thing/], [/Keep it/, /Take her stake/, /Walk the burned lots/, /Ask about the other kind/, /Say nothing, and walk away/]]) {
    const run = await playBook(HERO, wants);
    assert.equal(run.frame.wait, 'book_end');
  }
});

test('a day with no deal still starts the firm, and a hero starved by the sun is fed at dusk', async () => {
  const idle = await playBook(HERO, [/Go home before the light turns/]);
  assert.ok(['wine', 'none'].includes(idle.vars['b1.collis_start']));
  assert.equal(idle.frame.pending, true);
  const long = await playBook(HERO, [/Take the road to Ostia/, /Follow the grain factor/, /Walk the burned lots/, /Hunt in the oak wood/]);
  assert.equal(long.frame.wait, 'book_end');
});

test('the name: keeping the link and hiding it are different', async () => {
  const tribute = await playBook(HERO, [/Keep the name/]);
  const hidden = await playBook(HERO, [/Hide the link/]);
  assert.equal(tribute.vars['b1.collis_name'], 'tribute');
  assert.equal(hidden.vars['b1.collis_name'], 'hidden');
  assert.ok(hidden.vars.standing < tribute.vars.standing, 'hiding the link costs standing');
  assert.ok(hidden.vars.secrecy > tribute.vars.secrecy, 'and buys secrecy');
  assert.ok(tribute.game.state.sys.lore.codex.collis, 'the codex learns the firm');
});

test('who knows about the sun does not break the offer', async () => {
  for (const want of [/Lie still/, /put your hand in the bar of light/, /Go up and tell Prisca/]) {
    const run = await playBook(HERO, [want]);
    assert.equal(run.frame.wait, 'book_end', String(want));
  }
});

test('the breaking point depends on how the hero has fed', async () => {
  const kin = await playBook(HERO, KIN);
  assert.equal(kin.vars['b1.breaking'], 'kin');
  assert.ok(kin.game.state.sys.people.vibia, 'the widow is met');
  const drained = await playBook(HERO, DRAINED);
  assert.equal(drained.vars['b1.breaking'], 'drained');
  const clean = await playBook(HERO, CLEAN);
  assert.equal(clean.vars['b1.breaking'], 'clean');
});

test('the widow can be told, helped or paid', async () => {
  for (const [want, value] of [[/Tell her the truth/, 'told'], [/river searched/, 'helped'], [/Give her coin/, 'paid']]) {
    const run = await playBook(HERO, [...KIN, want]);
    assert.equal(run.vars['b1.vibia'], value);
  }
  const told = await playBook(HERO, [...KIN, /Tell her the truth/]);
  const paid = await playBook(HERO, [...KIN, /Give her coin/]);
  assert.ok(told.vars.humanity > paid.vars.humanity, 'the truth is worth more to him than coin');
  assert.ok(told.vars.secrecy < paid.vars.secrecy, 'and costs more in secrecy');
});

test('the man on the quay can be hired, passed or followed', async () => {
  for (const [want, value] of [[/Hire him/, 'helped'], [/Walk past/, 'met'], [/Follow them home/, 'met']]) {
    const run = await playBook(HERO, [...DRAINED, want]);
    assert.equal(run.vars['b1.vibia'], value);
    assert.equal(run.vars['b1.breaking'], 'drained');
  }
});

test('the alley can be fought, paid off or drunk through, and the book still reaches its pause', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const wants of [[/Drop the knife/], [/Fight on/, /Take the knife man/], [/Fight on/, /Feint, and drag/], [/Fight on/, /Take the knife man/, /Drink from him/]]) {
      const run = await playBook(HERO, [...CLEAN, ...wants], seed);
      assert.equal(run.frame.wait, 'book_end', `seed ${seed} ${wants.map(String)}`);
      assert.equal(run.frame.pending, true);
    }
  }
});

test('the three vows are recorded, with costs that point the right way', async () => {
  const animal = await playBook(HERO, [...CLEAN, /Swear it off/]);
  const donor = await playBook(HERO, [...CLEAN, /only the willing/]);
  const none = await playBook(HERO, [...CLEAN, /Swear nothing/]);
  assert.equal(animal.vars['b1.vow'], 'animal');
  assert.equal(donor.vars['b1.vow'], 'donor');
  assert.equal(none.vars['b1.vow'], 'human');
  assert.ok(animal.vars.humanity > none.vars.humanity, 'beast blood keeps Humanity higher');
  assert.ok(animal.game.state.sys.lore.codex.the_lesser_cup, 'the lesser cup is in the codex');
});

test('a sworn hero can keep the vow or break it, and the break is remembered', async () => {
  const kept = await playBook(HERO, [...CLEAN, /Swear it off/, /Bind the arm, and take him/]);
  assert.equal(kept.vars['b1.vow'], 'animal');
  assert.ok(!kept.vars['b1.relapse'], 'no relapse when he helps the drover');
  const broke = await playBook(HERO, [...CLEAN, /Swear it off/, /^Drink$/]);
  assert.equal(broke.vars['b1.relapse'], true);
  assert.ok(broke.vars.humanity < kept.vars.humanity);
  const donor = await playBook(HERO, [...CLEAN, /only the willing/, /^Drink$/]);
  assert.equal(donor.vars['b1.relapse'], true);
});

test('a hero who swore nothing meets the house watching, not the drover', async () => {
  const run = await playBook(HERO, [...CLEAN, /Swear nothing/]);
  assert.match(run.text, /Hanno/);
  assert.match(run.text, /the Lictors can count/);
  assert.ok(!run.vars['b1.relapse']);
});

test('every mortal role plays chapters 5 and 6 to the pause, under every vow', async () => {
  for (const role of ['gladiator', 'legionary', 'merchant', 'physician_aide', 'house_slave']) {
    for (const vow of [/Swear it off/, /only the willing/, /Swear nothing/]) {
      const run = await playBook({ ...HERO, role }, [vow]);
      assert.equal(run.frame.wait, 'book_end', `${role} ${vow}`);
      assert.equal(run.frame.pending, true);
    }
  }
  for (const gender of ['f', 'x']) {
    const run = await playBook({ ...HERO, gender }, KIN);
    assert.equal(run.frame.wait, 'book_end');
    assert.doesNotMatch(run.text, /\{|\}/);
  }
});
