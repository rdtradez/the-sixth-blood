// Session 16: Book One, chapters 19 and 20, the Velati journal and the end of the book. Played as different heroes and down the
// branches that later books depend on. (This file says what is guaranteed, not what happens.)

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

async function playFrom(chapter, scene, vars, wants = [], { seed = 3, hero = HERO, circle = true, setup, stopAt = null } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero, seed });
  await dev.jump(game, chapter, {});
  const sys = game.state.sys;
  sys.originals.general = { state: 'awake', by: 'hero', fate: 'loosed', name: false, book: 'burning-city' };
  if (circle) {
    for (const [id, tier] of [['prisca', 3], ['hanno', 3], ['tiro', 1]]) {
      sys.circle[id] = { id, injured: false, mission: null, quest: null, role: '', status: 'active', joined: 'burning-city', kind: 'vampire', line: 'merchant', sire: 'other', tier, daywalk: false };
      sys.circle[id].loyalty = 60;
      game.state.vars[`loyalty.${id}`] = 60;
    }
  }
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  if (setup) setup(game);
  const frame = await dev.jump(game, chapter, { scene: scene ?? undefined, keep: true });
  return drive(game, frame, wants, stopAt);
}

// Chapter 20's sleep is the first stretch of the Lost Centuries: stop where the first interlude chapter begins.
const playSleep = (vars, wants, opts = {}) => playFrom('b1c20', null, vars, wants, { stopAt: 'lc01', ...opts });

const DAY = { rufus: /Aventine station/, study: /counting room, for the accounts/, senate: /Senate house, where the Commander/, gate: /gate on the Appian road/ };
const RUFUS = { told: /Tell him the truth/, buried: /different story/, left: /cannot tell him/ };
const COLLIS = { house: /Leave it in the house's hands/, yours: /Keep it as your own/, village: /greater part of it to the hill/ };
const PEACE = { promised: /Promise to go/, none: /Refuse, and say/, charter: /Bargain: you will go/ };
const OATH = { sworn: /Take their oath/, spared: /Refuse\. They are to live/ };
const NIGHT = { aelia: /with Aelia, on the old wall/, felix: /with Felix, in the fields/, both: /with both, at the table/, alone: /alone, on the hill/ };
const PLACE = { collesanto: /cellar under the villa/, haven: /haven in the city/, tomb: /tomb in the rock/ };
const STEWARD = { bank: /Merchant house, as a bank/, prisca: /Prisca, in her own person/, hanno: /Hanno, who has kept/, tiro: /Tiro, who is young/, keepers: /Valerius keepers/ };
const ORDERS = { safe: /Play it safe/, aggressive: /Grow it aggressively/, dark: /Take the dark ventures/ };

test('Book One is no longer marked incomplete, and has twenty chapters and a journal', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'burning-city');
  assert.equal(book.incomplete, false);
  assert.equal(book.chapterCount, 20);
  const manifest = await real.manifest();
  assert.equal(manifest.books[0].journal, 'journal/burning-city.tsb');
  assert.ok(manifest.books[0].recap.length > 50, 'a quick start recap is written');
});

test('chapters 19 and 20 play through, the sleep is resolved and the book ends', async () => {
  const run = await playFrom('b1c19', null, {});
  assert.equal(run.frame.wait, 'book_end');
  assert.notEqual(run.frame.pending, true);
  assert.ok(run.game.state.sys.sleep.wake, 'the long sleep was resolved');
  assert.equal(run.game.state.sys.sleep.wake.from, 'burning-city');
  assert.ok(run.game.state.booksDone.includes('burning-city'));
});

test('prose has no dashes and no unresolved braces', async () => {
  for (const wants of [
    [],
    [DAY.rufus, RUFUS.told, DAY.study, COLLIS.house, OATH.sworn, NIGHT.aelia, PLACE.collesanto, STEWARD.prisca, ORDERS.safe],
    [DAY.senate, PEACE.charter, DAY.gate, OATH.spared, NIGHT.felix, PLACE.tomb, STEWARD.bank, ORDERS.dark],
    [DAY.rufus, RUFUS.buried, DAY.gate, NIGHT.both, PLACE.haven, STEWARD.hanno, ORDERS.aggressive, /Lay traps/, /Pay the people/, /Hire guardians/],
    [DAY.study, COLLIS.village, DAY.senate, PEACE.promised, NIGHT.alone, STEWARD.tiro],
  ]) {
    const run = await playFrom('b1c19', null, { 'b1.survivor': 'kept', wealth: 80 }, wants);
    assert.doesNotMatch(run.text, /[–—]/);
    assert.doesNotMatch(run.text, /[{}]/);
  }
});

test('the day in Rome offers four places for two actions and records each choice', async () => {
  const rufus = await playFrom('b1c19', null, {}, [DAY.rufus, RUFUS.told, DAY.study, COLLIS.house]);
  assert.equal(rufus.vars['b1.velati_seed'], 'told');
  assert.equal(rufus.vars['b1.collis_legacy'], 'house');
  for (const key of ['told', 'buried', 'left']) {
    const run = await playFrom('b1c19', null, {}, [DAY.rufus, RUFUS[key]]);
    assert.equal(run.vars['b1.velati_seed'], key);
  }
  for (const key of ['promised', 'none', 'charter']) {
    const run = await playFrom('b1c19', null, { standing: 10 }, [DAY.senate, PEACE[key]]);
    assert.equal(run.vars['b1.senate_peace'], key);
  }
  for (const key of ['house', 'yours', 'village']) {
    const run = await playFrom('b1c19', null, {}, [DAY.study, COLLIS[key]]);
    assert.equal(run.vars['b1.collis_legacy'], key);
  }
});

test('the day can only spend two actions', async () => {
  const run = await playFrom('b1c19', null, {}, [DAY.rufus, RUFUS.told, DAY.study, COLLIS.house, DAY.senate, PEACE.promised, DAY.gate]);
  assert.equal(run.vars['b1.senate_peace'], 'none', 'the third place was never reached');
});

test('the oath of the keepers makes Aelia and Felix keepers; refusing leaves them out', async () => {
  const sworn = await playFrom('b1c19', 'hill', { wealth: 100 }, [OATH.sworn], { setup: (g) => { g.state.sys.path = 'lone'; } });
  assert.equal(sworn.vars['b1.keepers'], 'sworn');
  assert.equal(sworn.game.state.sys.circle.aelia.kind, 'keeper');
  assert.equal(sworn.game.state.sys.circle.felix.kind, 'keeper');
  assert.ok(Object.hasOwn(sworn.game.state.sys.holdings, 'keeper_oath'));
  const spared = await playFrom('b1c19', 'hill', {}, [OATH.spared]);
  assert.equal(spared.vars['b1.keepers'], 'spared');
  assert.equal(spared.game.state.sys.circle.aelia, undefined);
});

test('each steward is recorded, and only those in the circle (or sworn) are offered', async () => {
  for (const key of ['bank', 'prisca', 'hanno', 'tiro']) {
    const run = await playSleep({ 'b1.keepers': 'spared' }, [PLACE.collesanto, STEWARD[key], ORDERS.safe]);
    const logged = run.game.state.decisions.find((d) => d.name === 'steward.burning-city');
    assert.equal(logged.value, key);
    assert.equal(run.game.state.sys.sleep.wake.steward, key);
  }
  const keepers = await playSleep({}, [PLACE.collesanto, STEWARD.keepers, ORDERS.safe], {
    circle: false,
    setup: (game) => {
      game.state.vars['b1.keepers'] = 'sworn';
      game.state.sys.circle.aelia = { id: 'aelia', injured: false, mission: null, quest: null, role: '', status: 'active', joined: 'burning-city', kind: 'keeper', line: 'human', sire: '', tier: 0, daywalk: true };
      game.state.vars['loyalty.aelia'] = 75;
    },
  });
  assert.equal(keepers.game.state.sys.sleep.wake.steward, 'keepers');
  // Without the circle or the oath, the bank is the only steward, and the game does not get stuck.
  const lone = await playSleep({}, [PLACE.tomb, ORDERS.safe], { circle: false });
  assert.equal(lone.game.state.sys.sleep.wake.steward, 'bank');
});

test('the resting place and the orders are recorded in the wake report', async () => {
  for (const place of ['collesanto', 'haven', 'tomb']) {
    const run = await playSleep({}, [PLACE[place], STEWARD.bank, ORDERS.safe]);
    assert.equal(run.game.state.sys.sleep.wake.place, place);
  }
  for (const orders of ['safe', 'aggressive', 'dark']) {
    const run = await playSleep({}, [PLACE.collesanto, STEWARD.bank, ORDERS[orders]]);
    assert.equal(run.game.state.sys.sleep.wake.orders, orders);
  }
});

test('protections cost coin, can only be bought once each, and the choice can always be ended', async () => {
  const base = [PLACE.collesanto, STEWARD.bank, ORDERS.safe];
  const rich = await playSleep({ wealth: 200 }, [...base, /Lay traps/, /Pay the people/, /Hire guardians/, /That will do/]);
  const bare = await playSleep({ wealth: 200 }, [...base, /That will do/]);
  assert.ok(rich.game.state.sys.sleep.wake.before < bare.game.state.sys.sleep.wake.before, 'protections were paid for');
  assert.equal(rich.game.state.chapter, 'lc01');
  const poor = await playSleep({ wealth: 0 }, [PLACE.collesanto, STEWARD.bank, ORDERS.safe]);
  assert.equal(poor.game.state.chapter, 'lc01', 'a hero with no coin is not stuck at the guard');
  assert.equal(poor.vars.wealth >= 0, true);
});

test('the dark orders cost Humanity at the wake', async () => {
  const safe = await playSleep({ humanity: 90 }, [PLACE.collesanto, STEWARD.bank, ORDERS.safe]);
  const dark = await playSleep({ humanity: 90 }, [PLACE.collesanto, STEWARD.bank, ORDERS.dark]);
  assert.ok(dark.vars.humanity < safe.vars.humanity);
});

test('the sleep is seeded: the same choices give the same wake report', async () => {
  const wants = [PLACE.tomb, STEWARD.bank, ORDERS.safe];
  const setup = (g) => { g.state.rng = 11; };
  const a = await playSleep({}, wants, { setup });
  const b = await playSleep({}, wants, { setup });
  assert.deepEqual(a.game.state.sys.sleep.wake, b.game.state.sys.sleep.wake);
});

test('the journal reads the choices, has a title and never prints a raw flag', async () => {
  const told = await playFrom('b1c20', null, { 'b1.velati_seed': 'told', 'b1.fire_toll': 'light' }, []);
  const buried = await playFrom('b1c20', null, { 'b1.velati_seed': 'buried', 'b1.fire_toll': 'terrible' }, []);
  const entry = (run) => run.game.state.journal.find((e) => e.kind === 'velati' && e.book === 'burning-city');
  assert.ok(entry(told) && entry(buried));
  assert.match(entry(told).title, /Rufus/);
  assert.notEqual(entry(told).text, entry(buried).text, 'the journal changes with the choices');
  assert.doesNotMatch(entry(told).text, /[–—]/);
  assert.doesNotMatch(entry(told).text, /[{}]/);
  assert.doesNotMatch(entry(told).text, /undefined|NaN/);
  for (const fate of ['loosed', 'bargain', 'drunk', 'sealed']) {
    const run = await playFrom('b1c20', null, {}, [], { setup: (g) => { g.state.sys.originals.general.fate = fate; } });
    assert.ok(entry(run).text.length > 500, fate);
  }
});

test('Book Two is unlocked after the book ends, and a quick start past Book One keeps its recap', async () => {
  const run = await playFrom('b1c20', null, {}, []);
  assert.equal(run.frame.nextBook, 'blood-and-gold');
  assert.equal(run.game.library().find((b) => b.id === 'blood-and-gold').unlocked, true);
  const quick = await newGame();
  const q = quick.quickState('blood-and-gold', { hero: HERO });
  assert.ok(q.journal.some((e) => e.book === 'burning-city' && /Rome burned/.test(e.text)), 'the recap is the skipped book\'s journal entry');
});

test('every new flag is registered with a quick start default', async () => {
  const flags = JSON.parse((await import('node:fs')).readFileSync(join(root, 'content/flags.json'), 'utf8')).flags;
  for (const name of ['b1.velati_seed', 'b1.collis_legacy', 'b1.senate_peace', 'b1.theron_end', 'b1.keepers', 'b1.last_night']) {
    assert.ok(flags[name], `${name} is registered`);
    assert.equal(flags[name].book, 'burning-city');
    assert.equal(flags[name].major, true);
    assert.ok(flags[name].values.includes(flags[name].default), `${name} has a valid default`);
  }
});
