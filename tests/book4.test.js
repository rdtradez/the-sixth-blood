// Sessions 40 and 41: Book Four, chapters 1 to 4. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

async function play(chapter, wake, vars, wants = [], { sys = null, seed = 3 } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', orders: 'safe', years: 65, invest: [], ...wake };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  if (sys) sys(game);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants);
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
  assert.doesNotMatch(run.text, /in the sun\b|last of the sun|in the daylight/);
};

const WAKES = [
  {},
  { place: 'collesanto', steward: 'keepers' },
  { place: 'tomb', steward: 'prisca', outcome: 'prospered', orders: 'aggressive' },
  { place: 'haven', steward: 'adelaide', outcome: 'losses', orders: 'dark' },
  { place: 'collesanto', steward: 'baptiste', orders: 'dark' },
  { place: 'haven', steward: 'bank', outcome: 'woken_early', by: 'hunters' },
  { place: 'collesanto', steward: 'bank', outcome: 'woken_early', by: 'government', orders: 'aggressive' },
  { place: 'tomb', steward: 'keepers', outcome: 'woken_early', by: 'steward', orders: 'dark' },
];

const START = { hunger: 10, wealth: 120000 };

// A coven of three, on the coven path, as Book Three leaves one.
const coven = (g) => {
  const s = g.state.sys;
  s.path = 'coven';
  for (const [id, role] of [['prisca', 'head of the house'], ['fiammetta', 'fledgling of the hill'], ['hanno', 'keeper of the ledgers']]) {
    s.circle[id] = { id, kind: 'vampire', line: 'merchant', injured: false, mission: null, quest: null, task: '', taskResult: '', role, status: 'active', joined: 'blood-and-gold', age: 3 };
    g.state.vars[`loyalty.${id}`] = 70;
  }
};

test('Book Four lists its four written chapters and is still incomplete', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'house-divided');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 4);
});

test('chapter 1 plays through every kind of waking and reaches chapter 2', async () => {
  for (const wake of WAKES) {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play('b4c01', wake, { ...START, hunger }, [], { sys: circle ? coven : null });
        assert.match(run.text, /Havre|train/, JSON.stringify(wake));
        assert.equal(run.frame.wait, 'book_end');
        clean(run);
      }
    }
  }
});

test('chapter 1 takes each choice and records it', async () => {
  const sets = [
    ['b4.emperor', [['bluffed', /ask after his health/], ['asked', /Ask which one/], ['blustered', /passing thing/]]],
    ['b4.books', [['trusted', /on trust/], ['audited', /line by line/]]],
    ['b4.street', [['read', /read the news/], ['spoke', /Talk to the man/], ['watched', /watch the faces/]]],
    ['b4.circle', [['all', /Let a keeper go/], ['stay', /go alone/]]],
    ['b4.crane_reply', [['burned', /Burn it/], ['kept', /Keep it/], ['answered', /Answer it/]]],
    ['b4.passage', [['cabin', /in the cabin/], ['hold', /in the hold/], ['cargo', /Be freight/]]],
    ['b4.first_feed', [['animal', /young goat/], ['donor', /willing arm/], ['human', /passing strangers/], ['none', /Go without/]]],
  ];
  const night = { 'b4.books': /Go through the books/, 'b4.street': /Go out, and look/, 'b4.circle': /Gather the household/, 'b4.crane_reply': /Open the letters/, 'b4.passage': /Open the letters/ };
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b4c01', { outcome: 'on_schedule' }, { ...START, hunger: flag === 'b4.first_feed' ? 90 : 10 }, night[flag] ? [re, night[flag]] : [re]);
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 1 offers the estate only after a dark order', async () => {
  for (const [value, re] of [['held', /nothing is to be changed/], ['sale', /sold, land and mill/], ['inquiry', /every means/]]) {
    const run = await play('b4c01', { orders: 'dark' }, START, [re, /Go through the books/]);
    assert.equal(run.vars['b4.estate'], value);
    assert.match(run.text, /Belle Isle/);
    clean(run);
  }
  const safe = await play('b4c01', { orders: 'safe' }, START, [/Go through the books/]);
  assert.equal(safe.vars['b4.estate'], 'unseen');
});

test('chapter 1 offers a coven its three courses', async () => {
  for (const [value, re] of [['all', /Take them all/], ['ahead', /Go first/], ['stay', /Leave them here/]]) {
    const run = await play('b4c01', {}, START, [re, /Gather the household/], { sys: coven });
    assert.equal(run.vars['b4.circle'], value);
    clean(run);
  }
});

test('chapter 1 handles being woken early with each way out', async () => {
  for (const by of ['hunters', 'government', 'steward']) {
    for (const [value, re] of [['fled', /Slip out/], ['fought', /Put out the lamp/], ['talked', /what the weather is like/]]) {
      const run = await play('b4c01', { outcome: 'woken_early', by }, START, [re]);
      assert.equal(run.vars['b4.trouble'], value, `${by} ${value}`);
      clean(run);
    }
  }
});

test('chapter 2 plays through every passage, circle and waking, and pauses at the end of the book so far', async () => {
  for (const passage of ['cabin', 'hold', 'cargo']) {
    for (const circle of ['all', 'ahead', 'stay']) {
      for (const orders of ['safe', 'dark']) {
        for (const hunger of [10, 90]) {
          const run = await play('b4c02', { orders }, { ...START, hunger, 'b4.passage': passage, 'b4.circle': circle, 'b4.estate': orders === 'dark' ? 'held' : 'unseen' }, []);
          assert.match(run.text, /Beaumont/, `${passage} ${circle} ${orders}`);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 2 takes each choice and records it', async () => {
  const sets = [
    ['b4.planter', [['heard', /Hear him out/], ['crossed', /Answer him, mildly/], ['charmed', /Turn the talk to sugar/]]],
    ['b4.doctor', [['talked', /hard thing to come home to/], ['helped', /Offer him your cabin/], ['avoided', /leave a man his book/]]],
    ['b4.photograph', [['sat', /Sit for him/], ['refused', /Refuse, politely/], ['hid', /Turn your face/]]],
    ['b4.valere', [['sworn', /Tell them everything/], ['trusted', /what they need/], ['distant', /rich old cousin/]]],
    ['b4.venture', [['steamboats', /steamboats/], ['banking', /into the bank/], ['sugar', /share in the sugar/], ['schools', /school for the freed/], ['cotton', /Take the cotton/], ['none', /think about it/]]],
    ['b4.auction', [['left', /Leave, and say/], ['stood', /ask the dealer questions/], ['bought', /Buy them/]]],
    ['b4.haven', [['tomb', /Take the tomb/], ['rented', /Rent a house/], ['built', /Buy a house on the Esplanade/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const night = { 'b4.valere': /Sit down at the Valère/, 'b4.venture': /Exchange, where the money/, 'b4.auction': /depot on Baronne/, 'b4.haven': /place to lie by day/ }[flag];
      const wants = night ? [re, night] : [re];
      const run = await play('b4c02', {}, { ...START, wealth: 400000 }, night ? [night, re] : wants);
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('buying the woman and her son makes them known', async () => {
  const run = await play('b4c02', {}, { ...START, wealth: 400000 }, [/depot on Baronne/, /Buy them/]);
  assert.equal(run.vars['b4.auction'], 'bought');
  assert.match(run.text, /Théo/);
});

test('every origin and path plays the dealer\'s yard', async () => {
  for (const hero of [
    { origin: 'roman', role: 'legionary', path: 'born_in_rome' },
    { origin: 'gaul', role: 'gladiator', path: 'captured' },
    { origin: 'judean', role: 'house_slave', path: 'freed' },
    { origin: 'north_african', role: 'house_slave', path: 'captured' },
  ]) {
    const game = await newGame();
    game.setSetting('dev', true);
    await game.startBook('burning-city', { from: 'new', hero: { gender: 'f', ...hero }, seed: 3 });
    await dev.jump(game, 'b4c02', {});
    game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', orders: 'safe', years: 65, invest: [] };
    const frame = await dev.jump(game, 'b4c02', { keep: true });
    const run = await drive(game, frame, [/depot on Baronne/, /Leave, and say/]);
    assert.match(run.text, /dealer|Ferrand/);
    clean(run);
  }
});

test('the coven can be given a house and posts in the haven scene', async () => {
  const run = await play('b4c02', {}, { ...START, wealth: 900000, 'b4.circle': 'all' }, [/place to lie by day/, /Take the tomb/, /Take a house for the coven/, /Set one of them to watch/, /Set one of them to keep/, /Put one of them to the business/, /That is enough/], { sys: coven });
  assert.equal(run.game.state.sys.circle.prisca.task, 'watch');
  assert.equal(run.game.state.sys.circle.fiammetta.task, 'guard');
  assert.equal(run.game.state.sys.circle.hanno.task, 'business');
  assert.ok(run.game.state.sys.holdings?.coven_house || run.text.match(/Marigny/));
  clean(run);
});

const CH3 = { 'b4.circle': 'all', 'b4.haven': 'rented', 'b4.auction': 'bought', 'b4.crane_reply': 'answered' };

test('chapter 3 plays through every circle, auction and crane reply, and runs on into chapter 4', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const auction of ['left', 'stood', 'bought']) {
      for (const reply of ['burned', 'kept', 'answered']) {
        for (const hunger of [10, 90]) {
          const run = await play('b4c03', {}, { ...START, hunger, 'b4.circle': circle, 'b4.auction': auction, 'b4.crane_reply': reply }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /Beaumont/, `${circle} ${auction} ${reply}`);
          assert.match(run.text, /returns|Illinois/);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 3 takes each choice and records it', async () => {
  const sets = [
    ['b4.supper', [['guest', /Take the chair/], ['equal', /as an equal/], ['stranger', /to be quiet/]], null],
    ['b4.compact', [['signed', /^Sign it$/], ['bargained', /named in the asking/], ['refused', /keep to it without signing/]], null],
    ['b4.armand', [['ally', /you will help, in whatever/], ['patient', /Offer him money/], ['distant', /can promise nothing/]], /physician/],
    ['b4.rival', [['heard', /Hear her out/], ['allied', /make an understanding|Make an understanding/], ['told', /speaking of it to Monsieur/]], /Bayou St. John/],
    ['b4.office', [['opened', /Open the firm in the open/], ['shared', /Share the firm/], ['none', /Shut it for the present/]], /counting house/],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b4c03', {}, { ...START, wealth: 400000, ...CH3 }, night ? [night, re] : [re], { sys: coven });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('the coven house in chapter 3 can be built out and given its posts', async () => {
  const run = await play('b4c03', {}, { ...START, wealth: 900000, ...CH3 }, [/coven's quarter/, /training room/, /blood supply/, /front over the carriage/, /Set Prisca/, /Set Hanno/, /That will do/], { sys: coven });
  assert.equal(run.game.state.sys.circle.prisca.task, 'watch');
  assert.equal(run.game.state.sys.circle.hanno.task, 'business');
  clean(run);
});

test('chapter 4 plays through every circle, paper and waking, and pauses at the end of the book so far', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const wants of [[], [/Run the other/], [/praises the South|Run the one that praises/]]) {
        const run = await play('b4c04', {}, { ...START, hunger, 'b4.circle': circle, 'b4.auction': 'bought' }, wants, { sys: circle === 'stay' ? null : coven });
        assert.match(run.text, /Illinois lawyer/);
        assert.equal(run.frame.wait, 'book_end');
        assert.equal(run.frame.pending, true);
        clean(run);
      }
    }
  }
});

test('chapter 4 takes each choice and records it', async () => {
  const sets = [
    ['b4.paper', [['silent', /Run neither/], ['dissent', /Run the other/], ['praise', /Run the one that praises/]], null],
    ['b4.houses', [['pledged', /stand with the houses/], ['conditional', /where you are asked/], ['withheld', /will not stand with the state/]], /river house, where the houses/],
    ['b4.errand', [['scout', /Send Prisca/], ['protect', /Send Fiammetta/], ['none', /Keep them home/]], /coven's table/],
    ['b4.papers', [['forged', /Have the papers made/], ['bought', /Buy people out/], ['refused', /will not put your hand/]], /Tremé, to Dr/],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b4c04', {}, { ...START, wealth: 400000, 'b4.circle': 'all', 'b4.compact': 'signed' }, night ? [night, re, /That is all/] : [re], { sys: coven });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('the errand sends a coven member out on a mission', async () => {
  const run = await play('b4c04', {}, { ...START, 'b4.circle': 'all' }, [/coven's table/, /Send Prisca/], { sys: coven });
  assert.ok(run.game.state.sys.circle.prisca.mission || run.vars['b4.errand'] === 'scout');
  clean(run);
});

test('every way of meeting Lucien in the yard plays to the end', async () => {
  for (const re of [/Slip inside/, /Meet him squarely/, /Say his father/, /^Go$/, /old blood/]) {
    for (const seed of [1, 3, 7]) {
      const run = await play('b4c04', {}, { ...START, 'b4.circle': 'all' }, [/river house, where the houses/, /stand where you are asked/, re], { sys: coven, seed });
      assert.match(run.text, /Lucien/);
      clean(run);
    }
  }
});
