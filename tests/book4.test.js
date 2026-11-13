// Sessions 40 to 46: Book Four, chapters 1 to 14. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

test('Book Four lists its fourteen written chapters and is still incomplete', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'house-divided');
  assert.equal(book.incomplete, true);
  assert.equal(book.chapterCount, 14);
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
  // Later chapters play on and the mission resolves, so what lasts is the recorded errand.
  assert.ok(['scout', 'protect'].includes(run.vars['b4.errand']));
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

const CH5 = { 'b4.circle': 'all', 'b4.compact': 'signed', 'b4.houses': 'pledged', 'b4.rival': 'allied', 'b4.errand': 'scout', 'b4.papers': 'forged', 'b4.paper': 'silent' };

test('chapter 5 plays through every circle, houses answer and waking, and carries on into chapter 6', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const houses of ['pledged', 'conditional', 'withheld']) {
        for (const rival of ['heard', 'allied', 'told']) {
          const run = await play('b4c05', {}, { ...START, hunger, 'b4.circle': circle, 'b4.houses': houses, 'b4.rival': rival, 'b4.errand': circle === 'stay' ? 'none' : 'scout' }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /Septimus Roan|Resident/);
          assert.match(run.text, /blockade|Federal|Passes/);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 5 takes each choice and records it', async () => {
  const sets = [
    ['b4.envoy', [['heard', /no quarrel with the Senate/], ['bargained', /Offer neutrality/], ['refused', /has not earned a promise/]], /Senate's Resident/],
    ['b4.levy', [['gave', /Give the state what it asks/], ['lent', /Lend it/], ['refused', /not at the state's disposal/]], /Exchange, where the river houses/],
    ['b4.shelter', [['hid', /has room, and take them in/], ['sent', /Offer passage/], ['left', /cannot take a hand/]], /Bayou St. John, to Madame/],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b4c05', {}, { ...START, wealth: 400000, ...CH5 }, [night, re, /That will do/], { sys: coven });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('the coven house in chapter 5 can be built out and given its posts', async () => {
  const run = await play('b4c05', {}, { ...START, wealth: 900000, ...CH5, 'b4.errand': 'protect' }, [/haven and the coven's quarter/, /Open a way out/, /a few eyes/, /second house/, /Set Fiammetta/, /Ask Prisca/, /That will do/], { sys: coven });
  assert.equal(run.game.state.sys.circle.fiammetta.task, 'guard');
  assert.equal(run.game.state.sys.circle.prisca.task, 'business');
  clean(run);
});

test('chapter 6 plays through every circle, blockade choice and waking, and pauses at the end of the book so far', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const shelter of ['hid', 'sent', 'left']) {
        for (const wants of [[], [/Run the Passes/], [/carry people north/]]) {
          const run = await play('b4c06', {}, { ...START, hunger, 'b4.circle': circle, 'b4.shelter': shelter, 'b4.rival': 'allied', 'b4.errand': circle === 'stay' ? 'none' : 'protect', 'b4.papers': 'forged' }, wants, { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /blockade|Passes/);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 6 takes each choice and records it', async () => {
  const sets = [
    ['b4.thorne', [['listened', /keep both doors open/], ['traded', /Trade: give him/], ['turned', /of no side by nature/]], /Thorne of Boston/],
    ['b4.blockade', [['tied', /Lay them up/], ['ran', /Run the Passes/], ['hid', /carry people north/]], /nine idle boats/],
    ['b4.raid', [['warned', /Send word, by a boy/], ['watched', /watch what the houses do/]], /Bayou St. John, where something/],
    ['b4.guards', [['funded', /Pay for the Guards/], ['warned', /Tell them, plainly/], ['apart', /not your quarrel/]], /Tremé, to Dr/],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b4c06', {}, { ...START, wealth: 400000, ...CH5, 'b4.shelter': 'hid' }, [night, re, /That is all/], { sys: coven });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('every way of meeting the raid on the Bayou plays to the end', async () => {
  for (const re of [/Go for the nearest/, /Use the dark/, /Say Lucien/, /^Go$/, /old blood/]) {
    for (const seed of [1, 3, 7]) {
      const run = await play('b4c06', {}, { ...START, ...CH5, 'b4.rival': 'allied' }, [/Bayou St. John, where something/, /under the protection of Colline/, re], { sys: coven, seed });
      assert.equal(run.vars['b4.raid'], 'defended');
      assert.match(run.text, /Lachapelle/);
      clean(run);
    }
  }
});

const CH7 = { ...CH5, 'b4.shelter': 'hid', 'b4.blockade': 'tied', 'b4.guards': 'funded', 'b4.raid': 'defended', 'b4.thorne': 'listened', 'b4.levy': 'gave' };

test('chapter 7 plays through every circle, houses answer and waking, and carries on into chapter 8', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const compact of ['signed', 'refused']) {
        for (const houses of ['pledged', 'withheld']) {
          const run = await play('b4c07', {}, { ...START, hunger, ...CH7, 'b4.circle': circle, 'b4.compact': compact, 'b4.houses': houses, 'b4.errand': circle === 'stay' ? 'none' : 'protect' }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /forts|fleet/);
          assert.match(run.text, /Occupation|Provost/);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 7 takes each choice and records it', async () => {
  const sets = [
    ['b4.fires', [['burned', /Do as the order says/], ['hoarded', /Hide it/], ['opened', /Open the sheds/]], /levee, where the cotton/],
    ['b4.exodus', [['rode', /Ride with them/], ['stayed', /Stay: say that the Compact/], ['kept', /Keep what cannot be moved/]], /Belle Rive, where the river houses/],
    ['b4.honorine', [['walked', /Stay through the night/], ['helped', /Take the children down/], ['apart', /send a servant with a purse/]], /Tremé, to the school/],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b4c07', {}, { ...START, wealth: 400000, ...CH7 }, [night, re, /That will do/], { sys: coven });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('the coven in chapter 7 can be sent out, and the house given its works', async () => {
  for (const [re, flag] of [[/Send Fiammetta to the Tremé/, 'school'], [/Send Prisca to take the firm's paper/, 'paper']]) {
    const run = await play('b4c07', {}, { ...START, wealth: 900000, ...CH7 }, [/Go home to the Marigny/, re, /a place cut for sleeping/, /vaults/, /Set Hanno/, /That will do/], { sys: coven });
    assert.equal(run.vars['b4.vigil'], flag);
    assert.equal(run.game.state.sys.circle.hanno.task, 'watch');
    clean(run);
  }
});

const CH8 = { ...CH7, 'b4.fires': 'opened', 'b4.exodus': 'kept', 'b4.vigil': 'school', 'b4.honorine': 'walked', 'b4.estate': 'held' };

test('chapter 8 plays through every circle, exodus, estate and waking, and pauses at the end of the book so far', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const exodus of ['rode', 'stayed', 'kept']) {
        for (const fires of ['burned', 'hoarded', 'opened']) {
          const run = await play('b4c08', {}, { ...START, hunger, ...CH8, 'b4.circle': circle, 'b4.exodus': exodus, 'b4.fires': fires, 'b4.estate': exodus === 'kept' ? 'held' : 'unseen' }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /Wren/);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 8 takes each choice and records it', async () => {
  const sets = [
    ['b4.provost', [['swore', /Take the oath/], ['neutral', /Register as a French subject/], ['refused', /Refuse: say that you have sworn/]], /Receive Captain Wren/],
    ['b4.camp', [['deeded', /Deed the land/], ['funded', /Fund the camp/], ['apart', /Give them what you have in your purse/]], /Camp Parapet, where the people/],
    ['b4.lucien', [['returned', /Take him in/], ['held', /Refuse: send him back/], ['bargained', /Name the price/]], /knock at the Marigny gate/],
  ];
  for (const exodus of ['kept', 'stayed']) {
    for (const [flag, branches, night] of sets) {
      for (const [value, re] of branches) {
        const run = await play('b4c08', {}, { ...START, wealth: 400000, ...CH8, 'b4.exodus': exodus }, [night, re, /That will do/], { sys: coven });
        assert.equal(run.vars[flag], value, `${flag} ${value}`);
        clean(run);
      }
    }
  }
});

test('the coven in chapter 8 can be sent out and the house built up', async () => {
  const run = await play('b4c08', {}, { ...START, wealth: 900000, ...CH8 }, [/See to the coven/, /Send Prisca to the Treasury/, /Send Fiammetta to stand watch/, /blood supply/, /training hall/, /That will do/], { sys: coven });
  assert.ok(run.game.state.sys.holdings?.blood_network || JSON.stringify(run.game.state.sys).includes('blood_network'));
  clean(run);
});


const CH9 = { ...CH8, 'b4.provost': 'swore', 'b4.camp': 'funded', 'b4.lucien': 'bargained' };

test('chapter 9 plays through every circle, waking, return of the agent and river house answer', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const lucien of ['returned', 'held', 'bargained']) {
        for (const honorine of ['walked', 'apart']) {
          const run = await play('b4c09', {}, { ...START, hunger, ...CH9, 'b4.circle': circle, 'b4.lucien': lucien, 'b4.honorine': honorine }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /Colline|knock/);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 9 takes each choice and records it', async () => {
  const sets = [
    ['b4.watcher', [['open', /Tell \w+ everything/], ['guarded', /Give \w+ a bed/], ['refused', /Send \w+ away/]], /Open the door to the knock/],
    ['b4.seal', [['wrote', /Write to the Resident/], ['trap', /false one/], ['silent', /Say nothing, and keep/]], /Take the Senate's letter/],
    ['b4.school', [['built', /Mend the roof/], ['lent', /Lend the school/], ['apart', /Sit with her through/]], /Go to the school in the Trem/],
  ];
  for (const honorine of ['walked', 'apart']) {
    for (const [flag, branches, night] of sets) {
      for (const [value, re] of branches) {
        const run = await play('b4c09', {}, { ...START, wealth: 400000, ...CH9, 'b4.honorine': honorine }, [night, re, /That will do/], { sys: coven });
        assert.equal(run.vars[flag], value, `${flag} ${value}`);
        clean(run);
      }
    }
  }
});

test('the coven in chapter 9 can be sent out and the house built up', async () => {
  const run = await play('b4c09', {}, { ...START, wealth: 900000, ...CH9 }, [/See to the coven/, /Send Prisca to the Treasury/, /Send Fiammetta to the Lake road/, /blood supply/, /training hall/, /That will do/], { sys: coven });
  assert.ok(JSON.stringify(run.game.state.sys).includes('blood_network'));
  clean(run);
});

const CH10 = { ...CH9, 'b4.watcher': 'open', 'b4.seal': 'wrote', 'b4.school': 'built' };

test('chapter 10 plays through every circle, waking and river house answer, and pauses at the end of the book so far', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const lucien of ['returned', 'held', 'bargained']) {
        for (const watcher of ['open', 'guarded', 'refused']) {
          const run = await play('b4c10', {}, { ...START, hunger, ...CH10, 'b4.circle': circle, 'b4.lucien': lucien, 'b4.watcher': watcher }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /Port Hudson|Guards/);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 10 takes each choice and records it', async () => {
  const sets = [
    ['b4.hospital', [['went', /Go up with them/], ['sent', /Send the boat and the surgeons/], ['money', /Pay for it/]], /Take the steamboat upriver/],
    ['b4.works', [['warned', /Send word back at once/], ['told', /to Captain Wren tonight/], ['silent', /Keep it, and say nothing/]], /Answer the river house/],
    ['b4.waiting', [['sat', /Sit with her until/], ['read', /Read the copybooks/], ['apart', /Stay for an hour/]], /Go to the Trem/],
  ];
  for (const honorine of ['walked', 'apart']) {
    for (const [flag, branches, night] of sets) {
      for (const [value, re] of branches) {
        const run = await play('b4c10', {}, { ...START, wealth: 400000, ...CH10, 'b4.honorine': honorine }, [night, re, /That will do/], { sys: coven });
        assert.equal(run.vars[flag], value, `${flag} ${value}`);
        clean(run);
      }
    }
  }
});

test('the coven in chapter 10 can be sent out and Hanno put to the lists', async () => {
  const run = await play('b4c10', {}, { ...START, wealth: 900000, ...CH10 }, [/See to the coven/, /Send Prisca upriver/, /Send Fiammetta to the landing/, /Put Hanno to the lists/, /That will do/], { sys: coven });
  assert.equal(run.game.state.sys.circle.hanno.task, 'watch');
  clean(run);
});


const CH11 = { ...CH10, 'b4.hospital': 'went', 'b4.works': 'warned', 'b4.waiting': 'sat' };

test('chapter 11 plays through every circle, waking and river house answer', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const works of ['warned', 'told', 'silent']) {
        for (const hospital of ['went', 'money']) {
          const run = await play('b4c11', {}, { ...START, hunger, ...CH11, 'b4.circle': circle, 'b4.works': works, 'b4.hospital': hospital }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /river is open|Fontenot/i);
          clean(run);
        }
      }
    }
  }
});

test('chapter 11 takes each choice and records it', async () => {
  const sets = [
    ['b4.coven_home', [['raised', /second house/], ['hidden', /Spread the family/], ['kept', /Leave it, and spend/]], /Take the old cotton press/],
    ['b4.firm', [['coven', /Found a company/], ['partner', /Back Brault/], ['alone', /Leave it to the market/]], /Go down to the Levee/],
    ['b4.fontenot', [['parleyed', /Hear what he wants/], ['showed', /Let him see what the house/], ['refused', /Refuse to see him/]], /Receive the gentleman of Mobile/],
    ['b4.homecoming', [['carried', /Take him up yourself/], ['sat', /Send for a carriage/], ['apart', /See that he is taken home/]], /Go to the Trem/],
  ];
  for (const honorine of ['walked', 'apart']) {
    for (const [flag, branches, night] of sets) {
      for (const [value, re] of branches) {
        const run = await play('b4c11', {}, { ...START, wealth: 900000, ...CH11, 'b4.honorine': honorine }, [night, re, /That will do/], { sys: coven });
        assert.equal(run.vars[flag], value, `${flag} ${value}`);
        clean(run);
      }
    }
  }
});

test('the coven in chapter 11 runs the firm and builds the house', async () => {
  const run = await play('b4c11', {}, { ...START, wealth: 900000, ...CH11 }, [/Take the old cotton press/, /second house/, /Go down to the Levee/, /Found a company/, /That will do/], { sys: coven });
  assert.equal(run.vars['b4.firm'], 'coven');
  assert.equal(run.vars['b4.coven_home'], 'raised');
  clean(run);
});

const CH12 = { ...CH11, 'b4.coven_home': 'raised', 'b4.firm': 'coven', 'b4.fontenot': 'parleyed', 'b4.homecoming': 'carried' };

test('chapter 12 plays through every circle, house, firm and the unwatched night, and carries on', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const home of ['raised', 'hidden', 'kept']) {
        for (const estate of ['held', 'unseen']) {
          const run = await play('b4c12', {}, { ...START, hunger, ...CH12, 'b4.circle': circle, 'b4.coven_home': home, 'b4.estate': estate }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /Delorme|frost/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 12 takes each choice and records it', async () => {
  const sets = [
    ['b4.defense', [['stood', /Stand at the door/], ['struck', /Go out the back/], ['parleyed', /Send the family's own word/]], /Keep watch on the house/],
    ['b4.labor', [['land', /Buy the land/], ['wages', /Sign the Army's contract/], ['apart', /Sign nothing/]], /Go below the city/],
    ['b4.christmas', [['table', /Sit in the kept chair/], ['gift', /Bring them a gift/], ['apart', /Stay a quarter/]], /Go to the school in the Trem/],
  ];
  for (const estate of ['held', 'sale']) {
    for (const [flag, branches, night] of sets) {
      for (const [value, re] of branches) {
        const run = await play('b4c12', {}, { ...START, wealth: 900000, ...CH12, 'b4.estate': estate }, [night, re, /That will do/], { sys: coven });
        assert.equal(run.vars[flag], value, `${flag} ${value}`);
        clean(run);
      }
    }
  }
});

test('the fight at the door can be won, talked down or lost without breaking the chapter', async () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const strike of [/Slip inside/, /Meet him squarely/, /Say who the house is/, /Go$/]) {
      const run = await play('b4c12', {}, { ...START, ...CH12 }, [/Keep watch on the house/, /Stand at the door/, strike, /That will do/], { sys: coven, seed });
      assert.equal(run.vars['b4.defense'], 'stood');
      clean(run);
    }
  }
});

test('the coven in chapter 12 can be sent out and the house built up', async () => {
  const run = await play('b4c12', {}, { ...START, wealth: 900000, ...CH12 }, [/See to the family/, /Send Prisca to the Treasury/, /Send Fiammetta down the river road/, /Put Hanno to the watch/, /Put a few eyes/, /Lay a stair/, /That will do/], { sys: coven });
  assert.ok(JSON.stringify(run.game.state.sys).includes('informants'));
  clean(run);
});

const CH13 = { ...CH12, 'b4.defense': 'stood', 'b4.labor': 'land', 'b4.christmas': 'table' };

test('chapter 13 plays through every circle, house, firm and Chapter, and carries on into chapter 14', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const home of ['raised', 'hidden', 'kept']) {
        for (const defense of ['stood', 'struck', 'parleyed', 'unwatched']) {
          const run = await play('b4c13', {}, { ...START, hunger, ...CH13, 'b4.circle': circle, 'b4.coven_home': home, 'b4.defense': defense }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /Crane|Pearl Street/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 13 takes each choice and records it', async () => {
  const sets = [
    ['b4.guest', [['housed', /Take him up to the house/], ['wharf', /Walk him to the hotel/], ['tested', /Take him to a quiet room/]], /Go down to the foot of Canal Street/],
    ['b4.chapter', [['stood', /Stand with Beaumont/], ['spoke', /Speak for the sixth blood/], ['absent', /Stay away/]], /Ride to Belle Rive/],
    ['b4.petition', [['funded', /Fund the delegation/], ['signed', /Sign it, in your own name/], ['apart', /Listen from the back/]], /Go to the hall in the Trem/],
  ];
  for (const defense of ['stood', 'unwatched']) {
    for (const [flag, branches, night] of sets) {
      for (const [value, re] of branches) {
        const run = await play('b4c13', {}, { ...START, wealth: 900000, ...CH13, 'b4.defense': defense }, [night, re, /That will do/], { sys: coven });
        assert.equal(run.vars[flag], value, `${flag} ${value}`);
        clean(run);
      }
    }
  }
});

test('the coven in chapter 13 can be sent out and the house built up', async () => {
  const run = await play('b4c13', {}, { ...START, wealth: 900000, ...CH13 }, [/See to the family/, /Send Prisca to the Levee/, /Send Fiammetta to the Chapter/, /Put Hanno to the Ice/, /Open the old drains/, /Set up a hall/, /That will do/], { sys: coven });
  assert.ok(JSON.stringify(run.game.state.sys).includes('escape_tunnels'));
  clean(run);
});

const CH14 = { ...CH13, 'b4.guest': 'housed', 'b4.chapter': 'stood', 'b4.petition': 'funded' };

test('chapter 14 plays through every circle, house, firm and Chapter, and pauses at the end of the book so far', async () => {
  for (const circle of ['all', 'ahead', 'stay']) {
    for (const hunger of [10, 90]) {
      for (const home of ['raised', 'hidden', 'kept']) {
        for (const firm of ['coven', 'partner', 'alone']) {
          const run = await play('b4c14', {}, { ...START, hunger, ...CH14, 'b4.circle': circle, 'b4.coven_home': home, 'b4.firm': firm, 'b4.chapter': circle === 'all' ? 'absent' : 'spoke' }, [], { sys: circle === 'stay' ? null : coven });
          assert.match(run.text, /convention|Constitution/);
          assert.equal(run.frame.wait, 'book_end');
          assert.equal(run.frame.pending, true);
          clean(run);
        }
      }
    }
  }
});

test('chapter 14 takes each choice and records it', async () => {
  const sets = [
    ['b4.gulf', [['seated', /Move that the Gulf house/], ['bound', /Seat it, but bind it/], ['refused', /Refuse the seat/]], /Take the chair at the head/],
    ['b4.atlantic', [['signed', /Sign the articles/], ['bargained', /Bargain: sign the court/], ['refused', /Refuse, politely/]], /Go to the hotel on the Rue Saint Charles/],
    ['b4.warehouse', [['rebuilt', /Keep the crew/], ['guarded', /Take Brault's offer/], ['moved', /Let it burn/]], /Go down to the Levee/],
  ];
  for (const firm of ['coven', 'alone']) {
    for (const [flag, branches, night] of sets) {
      for (const [value, re] of branches) {
        const run = await play('b4c14', {}, { ...START, wealth: 900000, ...CH14, 'b4.firm': firm }, [night, re, /That will do/], { sys: coven });
        assert.equal(run.vars[flag], value, `${flag} ${value}`);
        clean(run);
      }
    }
  }
});

test('the coven in chapter 14 can be sent out and the house built up', async () => {
  const run = await play('b4c14', {}, { ...START, wealth: 900000, ...CH14 }, [/See to the family/, /Send Prisca to Madame/, /Send Fiammetta to watch/, /Set Hanno to guard/, /Build a blood supply/, /Fit a vault/, /That will do/], { sys: coven });
  assert.ok(JSON.stringify(run.game.state.sys).includes('blood_network'));
  clean(run);
});
