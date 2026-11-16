// Session 62: Book Six, chapters 1 and 2. Played from different wake reports and down the branches. (This file says what is guaranteed, not what happens.)

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

async function play(chapter, wake, vars, wants = [], { sys = null, seed = 3, stopAt = null, flags = {} } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'haven', steward: 'bank', outcome: 'on_schedule', orders: 'safe', years: 20, invest: [], ...wake };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  for (const [k, v] of Object.entries(flags)) dev.setVar(game, k, v);
  if (sys) sys(game);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt);
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
  { place: 'tomb', steward: 'prisca', outcome: 'prospered', orders: 'aggressive', invest: ['munitions', 'motor_company', 'wireless'] },
  { place: 'haven', steward: 'fiammetta', outcome: 'losses', orders: 'dark' },
  { place: 'collesanto', steward: 'hanno', orders: 'dark', invest: ['electric_light'] },
  { place: 'haven', steward: 'bank', outcome: 'woken_early', by: 'hunters' },
  { place: 'collesanto', steward: 'thibault', outcome: 'woken_early', by: 'government', orders: 'aggressive' },
  { place: 'tomb', steward: 'keepers', outcome: 'woken_early', by: 'steward', orders: 'dark' },
];

const START = { hunger: 10, wealth: 300000 };

const coven = (g) => {
  const s = g.state.sys;
  s.path = 'coven';
  for (const [id, role] of [['prisca', 'head of the house'], ['fiammetta', 'fledgling of the hill'], ['hanno', 'keeper of the ledgers']]) {
    s.circle[id] = { id, kind: 'vampire', line: 'merchant', injured: false, mission: null, quest: null, task: '', taskResult: '', role, status: 'active', joined: 'blood-and-gold', age: 3 };
    g.state.vars[`loyalty.${id}`] = 70;
  }
};

test('Book Six lists chapters one to eighteen and is still incomplete', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'relics-lost-god');
  assert.ok(book.incomplete);
  assert.equal(book.chapterCount, 18);
});

test('chapters 1 and 2 play through every kind of waking, hungry or not, with and without a coven', async () => {
  for (const wake of WAKES) {
    for (const hunger of [10, 90]) {
      for (const circle of [0, 1]) {
        const run = await play('b6c01', wake, { ...START, hunger }, [], { sys: circle ? coven : null });
        assert.match(run.text, /LaSalle Street|Chicago/, JSON.stringify(wake));
        assert.equal(run.frame.wait, 'book_end');
        clean(run);
      }
    }
  }
});

test('chapter 1 takes each choice and records it', async () => {
  const sets = [
    ['b6.books', [['trusted', /on trust/], ['audited', /line by line/]], /Go through the books/],
    ['b6.street', [['read', /Take a paper/], ['spoke', /Talk to the man/], ['watched', /Walk on/]], /Go out, and look/],
    ['b6.crane', [['warm', /glad of the half/], ['cool', /inspect the half/], ['silent', /no answer/]], /Open the letters/],
    ['b6.passage', [['liner', /Take a cabin/], ['hold', /Go as freight/], ['steerage', /third class/]], /Open the letters/],
    ['b6.first_feed', [['animal', /young goat/], ['donor', /willing arm/], ['human', /passing strangers/], ['none', /Go without/]], null],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c01', { outcome: 'on_schedule' }, { ...START, hunger: flag === 'b6.first_feed' ? 90 : 10 }, night ? [re, night] : [re], { stopAt: 'b6c02' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 1 offers a coven its courses and the desk, and the London firm allows several answers', async () => {
  for (const [flag, value, re, night] of [
    ['b6.circle', 'all', /Take them all/, /Gather the household/],
    ['b6.circle', 'ahead', /Go first/, /Gather the household/],
    ['b6.circle', 'stay', /Leave them here/, /Gather the household/],
    ['b6.lead_desk', 'approved', /Approve the Exchange/, null],
    ['b6.lead_desk', 'pressed', /Go through every paper/, null],
    ['b6.lead_desk', 'thanked', /best house you have ever owned/, null],
  ]) {
    const run = await play('b6c01', {}, START, night ? [re, night] : [re], { sys: coven, stopAt: 'b6c02' });
    assert.equal(run.vars[flag], value, `${flag} ${value}`);
    clean(run);
  }
  const some = await play('b6c01', {}, START, [/Keep the Hales/, /Settle a pension/, /Move the firm's reserve/], { sys: coven, stopAt: 'b6c02' });
  assert.equal(some.vars['b6.london'], 'west');
  const pension = await play('b6c01', {}, START, [/Keep the Hales/, /Settle a pension/, /That will do/], { sys: coven, stopAt: 'b6c02' });
  assert.equal(pension.vars['b6.london'], 'pension');
});

test('chapter 1 gives the village letter a real choice', async () => {
  for (const [value, re] of [['built', /paved road/], ['sent', /Send coin to the hill/], ['waited', /you will think of it/]]) {
    const run = await play('b6c01', {}, START, [/Go through the books/, re], { sys: coven, stopAt: 'b6c02' });
    assert.equal(run.vars['b6.village'], value, value);
  }
});

test('chapter 2 takes each choice and records it', async () => {
  const sets = [
    ['b6.cab', [['bluff', /as if you had done it/], ['ask', /how it works/], ['gold', /Pay him in advance/]], null],
    ['b6.exchange', [['kept', /Say that he was/], ['pressed', /Go through every ledger/]], /LaSalle Street, and the Exchange/],
    ['b6.walk', [['bronzeville', /elevated train south/], ['pilsen', /go west, to Pilsen/i], ['yards', /Go to the Yards/]], /Walk the city/],
    ['b6.haven', [['brownstone', /brownstone/], ['tower', /floor of vaults/], ['keepers', /keeper house/]], /Find a roof/],
    ['b6.call', [['form', /Present yourself in form/], ['alone', /Go alone/], ['regrets', /Send regrets/]], /Answer the card/],
    ['b6.coin', [['kept', /Keep it/], ['melted', /melted down/], ['shown', /Show it to the family/]], null],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c02', {}, START, night ? [re, night] : [re], { sys: flag === 'b6.call' ? null : coven, stopAt: 'b6c03' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 2 lets the family stand in the room, and the ventures loop takes several', async () => {
  const fam = await play('b6c02', {}, START, [/Answer the card/, /Bring the family/], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c03' });
  assert.equal(fam.vars['b6.call'], 'family');
  const run = await play('b6c02', {}, { hunger: 10, wealth: 900000 }, [/Go to LaSalle Street/, /Real estate/, /The wireless/, /Motorcars/, /Community investment in Bronzeville/, /That will do/], { sys: coven, stopAt: 'b6c03' });
  const owned = run.game.state.sys.ventures;
  for (const id of ['chicago.realestate', 'chicago.radio', 'chicago.motorcars', 'chicago.bronzeville']) assert.ok(owned[id], id);
  clean(run);
});

test('no scene names a coven member who is not in the circle', async () => {
  for (const circle of [0, 1]) {
    const run = await play('b6c02', {}, START, [], { sys: circle ? coven : null, flags: { 'b6.circle': circle ? 'all' : 'stay' } });
    if (!circle) assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno/);
  }
});

test('chapters 3 and 4 play through every kind of waking, with and without a coven', async () => {
  for (const wake of WAKES.slice(0, 4)) {
    for (const circle of [0, 1]) {
      for (const [chapter, re] of [['b6c03', /Yards|second shift/], ['b6c04', /telephone|lake/]]) {
        const run = await play(chapter, wake, { ...START, hunger: 20 }, [], { sys: circle ? coven : null, flags: { 'b6.circle': circle ? 'all' : 'stay' } });
        assert.match(run.text, re);
        assert.equal(run.frame.wait, 'book_end');
        clean(run);
      }
    }
  }
});

test('chapter 3 takes each choice and records it', async () => {
  const sets = [
    ['b6.papers', [['shared', /Tell the family everything/], ['close', /Keep it to yourself/], ['hill', /send the copy to the hill/]], /grandfather's book/],
    ['b6.rudek', [['paid', /Pay the compliment/], ['bargained', /questions of your own/], ['warned', /learn the stranger|learn your habits/]], /day office/],
    ['b6.company', [['alone', /Go alone/], ['family', /Bring the family/]], null],
    ['b6.tallis', [['listened', /Listen to him/], ['pressed', /Press him/], ['held', /Take him, and hold him/]], null],
  ];
  for (const [flag, branches, day] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c03', {}, START, day ? [re, day] : [re], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c04' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 3 sends a family member ahead to the gate', async () => {
  const run = await play('b6c03', {}, START, [/Send one of the family/, /Fiammetta, who will see/, /Let the day end/], { sys: coven, flags: { 'b6.coin': 'kept' }, stopAt: 'b6c04' });
  assert.match(run.text, /find the second gate/);
  clean(run);
});

test('chapter 4 takes each choice and records it', async () => {
  const sets = [
    ['b6.song', [['waited', /Take the table by the wall/], ['followed', /Follow him out/], ['spoke', /Sit down in the booth/]], /club in the back/],
    ['b6.ames', [['partner', /Take the share/], ['bargain', /Bargain, and name/], ['refuse', /no need of Mr. Crane/]], /Meet Mr. Ames/],
    ['b6.benefit', [['funded', /cheque for the whole/], ['watched', /modest sum/], ['declined', /put nothing in the plate/]], /Orchestra Hall/],
    ['b6.lamp', [['told', /Tell the family, and Cordelia/], ['watched', /Watch it, alone/], ['left', /Leave it, and turn/]], null],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c04', {}, { hunger: 10, wealth: 900000 }, night ? [re, night] : [re], { sys: coven, stopAt: 'b6c05' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 4 lets the family do several things about the rival houses and the most committed wins', async () => {
  const picks = [/Set the family to the matter/, /Send .* to Miss Calloway/, /Buy the leases/, /Set a guard/, /That will do for the family/];
  const run = await play('b6c04', {}, { hunger: 10, wealth: 900000 }, picks, { sys: coven });
  assert.equal(run.vars['b6.rivals'], 'guarded');
  const talk = await play('b6c04', {}, { hunger: 10, wealth: 900000 }, [/Set the family to the matter/, /Send .* to Miss Calloway/, /Buy the leases/, /That will do for the family/]);
  assert.equal(talk.vars['b6.rivals'], 'bought');
  clean(run);
});

test('chapters 3 and 4 never name a coven member who is not in the circle', async () => {
  for (const chapter of ['b6c03', 'b6c04']) {
    const run = await play(chapter, {}, START, [], { sys: null, flags: { 'b6.circle': 'stay' } });
    assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno|Thibault/);
  }
});

test('chapters 5 and 6 play through every kind of waking, with and without a coven', async () => {
  for (const wake of WAKES.slice(0, 4)) {
    for (const circle of [0, 1]) {
      for (const [chapter, re] of [['b6c05', /crates|Midway/], ['b6c06', /Thursday|Calloway/]]) {
        const run = await play(chapter, wake, { ...START, hunger: 20 }, [], { sys: circle ? coven : null, flags: { 'b6.circle': circle ? 'all' : 'stay' } });
        assert.match(run.text, re);
        assert.equal(run.frame.wait, 'book_end');
        clean(run);
      }
    }
  }
});

test('chapter 5 takes each choice and records it', async () => {
  const sets = [
    ['b6.crates', [['opened', /Help her open it/], ['taken', /Take it, quietly/], ['guarded', /set a guard on the room/]], /Midway/],
    ['b6.yards', [['settled', /Settle it/], ['stood', /Stand, and let him/], ['traded', /Trade him/]], /supper at the Yards/],
    ['b6.pell', [['allied', /bring the family to her table/], ['civil', /Be civil/], ['refused', /nobody's heir/]], /Dine with Mrs. Pell/],
    ['b6.invite', [['accepted', /Mr. Collins will come/], ['family', /the family will come/], ['declined', /when the Loop has come/]], null],
  ];
  for (const [flag, branches, night] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c05', {}, { hunger: 10, wealth: 900000 }, night ? [re, night] : [re], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c06' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 5 lets the family do several things in Bronzeville and the most committed wins', async () => {
  const picks = [/Go to Bronzeville/, /Pay for the hall/, /Set up a clinic/, /Endow the school/, /That is enough for tonight/];
  const run = await play('b6c05', {}, { hunger: 10, wealth: 900000 }, picks, { sys: coven });
  assert.equal(run.vars['b6.bronzeville'], 'school');
  clean(run);
});

test('chapter 6 takes each choice and records it', async () => {
  const sets = [
    ['b6.claim', [['house', /say that the Sixth has come/], ['peace', /wants peace/], ['hidden', /Chicago has been misinformed/]]],
    ['b6.test', [['answered', /Rise to meet him/], ['family', /Let the family answer/], ['yielded', /weighed like a side of beef/]]],
    ['b6.cantor', [['sang', /Take the note, and sing it/], ['refused', /lamp for anyone's god/], ['asked', /Ask what the seventh is/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const strong = (g) => { coven(g); g.state.sys.circle.fiammetta.gifts = ['strength']; };
      const run = await play('b6c06', {}, { hunger: 10, wealth: 900000 }, [/Go down to the club/, re], { sys: strong, flags: { 'b6.circle': 'all', 'b6.invite': 'family' }, stopAt: 'b6c07' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapters 5 and 6 never name a coven member who is not in the circle', async () => {
  for (const chapter of ['b6c05', 'b6c06']) {
    const run = await play(chapter, {}, START, [], { sys: null, flags: { 'b6.circle': 'stay' } });
    assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno|Thibault/);
  }
});

test('chapter 7 takes each choice and records it', async () => {
  const sets = [
    ['b6.map', [['family', /family should hear this/, /read the map/], ['alone', /Take the tracings away/, /read the map/], ['gave', /Give the whole of it/, /read the map/]]],
    ['b6.heir', [['lent', /lend her one of its own/, /Answer the note/], ['kept', /Offer her a keeper/, /Answer the note/], ['declined', /not the Exchange's to lend/, /Answer the note/]]],
    ['b6.tuesday', [['sang', /sing the six notes/, /viaduct/], ['listened', /listen, and do not interrupt/, /viaduct/], ['asked', /what the song is meant to do/, /viaduct/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re, night] of branches) {
      const run = await play('b6c07', {}, { hunger: 10, wealth: 900000 }, [night, re], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c08' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 7 lets the family take several roofs and trades and the most committed wins', async () => {
  const picks = [/See to the family's roofs/, /keepers a lodge/, /cold storage works/, /old brewery/, /enough roofs/];
  const run = await play('b6c07', {}, { hunger: 10, wealth: 900000 }, picks, { sys: coven, stopAt: 'b6c08' });
  assert.equal(run.vars['b6.houses'], 'brewery');
  clean(run);
});

test('chapter 8 plays down to the hall with and without a coven and records each choice', async () => {
  const sets = [
    ['b6.party', [['family', /Take the family/], ['doctor', /only Dr. Whitcombe/], ['alone', /Go alone/]]],
    ['b6.hall', [['lit', /Sit in the sixth chair/], ['house', /Open the hall to the family/], ['institute', /Let Dr. Whitcombe have it/], ['sealed', /seal it again/]]],
    ['b6.door', [['opened', /Set the disc/], ['bloodline', /Lay a palm/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c08', {}, { hunger: 10, wealth: 900000 }, [re], { sys: coven, flags: { 'b6.circle': 'all', 'b6.cantor': 'sang', 'b6.map': 'gave' }, stopAt: 'b6c09' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
  const solo = await play('b6c08', {}, START, [], { sys: null, stopAt: 'b6c09' });
  assert.equal(solo.vars['b6.party'], 'doctor');
  clean(solo);
});

test('chapters 7 and 8 never name a coven member who is not in the circle', async () => {
  for (const chapter of ['b6c07', 'b6c08']) {
    const run = await play(chapter, {}, START, [], { sys: null, flags: { 'b6.circle': 'stay' }, stopAt: 'b6c09' });
    assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno|Thibault/);
  }
});

test('chapter 9 takes each choice and records it', async () => {
  const sets = [
    ['b6.chairs', [['family', /Take the drawings to the family/, /copied from the chair arms/], ['cantor', /Mr. Sorrel, at the water/, /copied from the chair arms/], ['kept', /keep the sheets close/, /copied from the chair arms/]]],
    ['b6.respect', [['sworn', /place at the Exchange's table/, /what the Yards have to say/], ['paid', /Pay it in coin/, /what the Yards have to say/], ['declined', /nobody's friend and nobody's servant/, /what the Yards have to say/]]],
    ['b6.pellsecret', [['shared', /the family will help/, /pale house/], ['kept', /keep her confidence/, /pale house/], ['pressed', /Press her to take you down/, /pale house/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re, night] of branches) {
      const run = await play('b6c09', {}, { hunger: 10, wealth: 900000 }, [night, re], { sys: coven, flags: { 'b6.circle': 'all', 'b6.heir': 'lent' }, stopAt: 'b6c10' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 9 lets the family take several works and the most committed wins', async () => {
  const picks = [/See what the family can be set to/, /Back Cordelia's school/, /guard on the dig/, /read the Loop's books/, /enough work/];
  const run = await play('b6c09', {}, { hunger: 10, wealth: 900000 }, picks, { sys: coven, stopAt: 'b6c10' });
  assert.equal(run.vars['b6.work'], 'ledgers');
  clean(run);
});

test('chapter 9 plays each way the hall was left and each way the guest went', async () => {
  for (const hall of ['lit', 'house', 'institute', 'sealed']) {
    for (const heir of ['lent', 'kept', 'declined']) {
      const run = await play('b6c09', {}, START, [/pale house/], { sys: coven, flags: { 'b6.circle': 'all', 'b6.hall': hall, 'b6.heir': heir }, stopAt: 'b6c10' });
      clean(run);
    }
  }
});

test('chapter 10 takes each choice and records it', async () => {
  const sets = [
    ['b6.depot', [['family', /Meet him with the family/], ['lead', /to take his bag/], ['alone', /Go alone/]]],
    ['b6.half', [['share', /Take a share of the Loop/], ['asked', /Ask what he wants/], ['refused', /Refuse it, courteously/]]],
    ['b6.ledger', [['told', /Tell him all of it/], ['half', /nothing of the room/], ['nothing', /been in no room/]]],
    ['b6.lake', [['family', /walk the lake front all together/], ['alone', /Walk alone with him/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c10', {}, { hunger: 10, wealth: 900000 }, [re], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c11' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapters 9 and 10 never name a coven member who is not in the circle', async () => {
  for (const chapter of ['b6c09', 'b6c10']) {
    const run = await play(chapter, {}, START, [], { sys: null, flags: { 'b6.circle': 'stay' }, stopAt: 'b6c11' });
    assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno|Thibault/);
    clean(run);
  }
});

test('chapter 11 takes each choice and records it', async () => {
  const sets = [
    ['b6.guest', [['family', /room in the family's own house/, /Twelfth Street viaduct/], ['exchange', /Keep him at the Exchange/, /Twelfth Street viaduct/], ['hotel', /Put him in a hotel/, /Twelfth Street viaduct/]]],
    ['b6.singer', [['family', /Take her home to the family/, /Twelfth Street viaduct/], ['cantor', /Take her to Mr. Sorrel/, /Twelfth Street viaduct/], ['alone', /tell no one she exists/, /Twelfth Street viaduct/]]],
    ['b6.rival', [['strength', /Let the family stand in the room/, /Ruth Calloway sent/], ['bought', /Buy the paper/, /Ruth Calloway sent/], ['terms', /no quarrel/, /Ruth Calloway sent/]]],
    ['b6.watch', [['family', /and the family with you/, /pale house/], ['kept', /a matter of two houses/, /pale house/], ['houses', /bring the other houses/, /pale house/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re, night] of branches) {
      const picks = flag === 'b6.guest' ? [re, night] : [night, re];
      const run = await play('b6c11', {}, { hunger: 10, wealth: 900000 }, picks, { sys: coven, flags: { 'b6.circle': 'all', 'b6.hall': 'house' }, stopAt: 'b6c12' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 11 lets the family take several holdings and the most committed wins', async () => {
  const picks = [/See to the family's roofs/, /Put keepers on the roofs/, /Buy the grain elevator/, /Open the lower rooms/, /enough for one August/];
  const run = await play('b6c11', {}, { hunger: 10, wealth: 900000 }, picks, { sys: coven, flags: { 'b6.circle': 'all', 'b6.hall': 'house' }, stopAt: 'b6c12' });
  assert.equal(run.vars['b6.holdings'], 'haven');
  clean(run);
});

test('chapter 12 takes each choice and records it', async () => {
  const sets = [
    ['b6.child', [['below', /Let her stand where she is/], ['above', /Send her up to the keepers/]]],
    ['b6.sleeper', [['kindly', /what he would like/], ['cassian', /man in the hat/], ['lamps', /thirteen/]]],
    ['b6.note', [['you', /Sing it yourself/], ['family', /Ask the family to sing/], ['child', /Let the child sing/]]],
    ['b6.stair', [['family', /family hold the stair/], ['alone', /Go out alone/], ['yards', /Ask Mr. Rudek/], ['table', /Let Ruth Calloway see/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c12', {}, { hunger: 10, wealth: 900000 }, [re], { sys: coven, flags: { 'b6.circle': 'all', 'b6.respect': 'sworn' }, stopAt: 'b6c13' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapters 11 and 12 play each way the earlier chapters went', async () => {
  for (const chapter of ['b6c11', 'b6c12']) {
    for (const hall of ['lit', 'house', 'institute', 'sealed']) {
      for (const pellsecret of ['shared', 'kept', 'pressed']) {
        const run = await play(chapter, {}, START, [], { sys: coven, flags: { 'b6.circle': 'all', 'b6.hall': hall, 'b6.pellsecret': pellsecret, 'b6.ledger': 'told' }, stopAt: 'b6c13' });
        clean(run);
      }
    }
  }
});

test('chapters 11 and 12 never name a coven member who is not in the circle', async () => {
  for (const chapter of ['b6c11', 'b6c12']) {
    const run = await play(chapter, {}, START, [], { sys: null, flags: { 'b6.circle': 'stay' }, stopAt: 'b6c13' });
    assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno|Thibault/);
    clean(run);
  }
});

test('chapter 13 takes each choice and records it', async () => {
  const sets = [
    ['b6.table', [['seat', /Give her a chair/], ['terms', /Settle terms/], ['refuse', /Refuse her/]]],
    ['b6.latch', [['crane', /Let Mr. Crane light/], ['you', /Light it yourself/], ['wait', /Leave it dark/]]],
    ['b6.place', [['family', /Make her one of the family/], ['pale', /Place her with the pale house/]]],
    ['b6.crypt', [['open', /Open it properly/], ['watch', /Keep a watch/], ['mark', /Close it/]]],
  ];
  const night = { b6: { table: /Sit down at the table/, latch: /Go down to the lamp/, place: /Find Tilly/, crypt: /Answer the Institute/ } };
  for (const [flag, branches] of sets) {
    const key = flag.split('.')[1];
    for (const [value, re] of branches) {
      const run = await play('b6c13', {}, { hunger: 10, wealth: 900000 }, [night.b6[key], re], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c14' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 14 takes each choice and records it', async () => {
  const sets = [
    ['b6.kept', [['plain', /Tell her the whole of it/], ['ask', /Ask her first/], ['gentle', /only what she needs/]]],
    ['b6.warm', [['family', /Give her the family/], ['pale', /Keep her at the pale house/], ['blanket', /Take her to the Exchange/]]],
    ['b6.callers', [['receive', /Receive them/], ['family', /Have the family receive/], ['show', /Bring Veda down/], ['shut', /Send them away/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c14', {}, { hunger: 10, wealth: 900000 }, [re], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c15' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapters 13 and 14 play each way the earlier chapters went', async () => {
  for (const chapter of ['b6c13', 'b6c14']) {
    for (const stair of ['alone', 'family', 'yards', 'table']) {
      for (const note of ['you', 'family', 'child']) {
        const run = await play(chapter, {}, START, [], { sys: coven, flags: { 'b6.circle': 'all', 'b6.stair': stair, 'b6.note': note, 'b6.singer': 'cantor' }, stopAt: 'b6c15' });
        clean(run);
      }
    }
  }
});

test('chapters 13 and 14 never name a coven member who is not in the circle', async () => {
  for (const chapter of ['b6c13', 'b6c14']) {
    const run = await play(chapter, {}, START, [], { sys: null, flags: { 'b6.circle': 'stay' }, stopAt: 'b6c15' });
    assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno|Thibault/);
    clean(run);
  }
});

test('chapter 15 takes each choice and records it', async () => {
  const sets = [
    ['b6.regent', [['lead', /Give the house to/], ['dora', /Leave Dora Valer/]], /Choose who keeps the house/],
    ['b6.memory', [['ask', /Ask her to tell it slowly/], ['lamp', /Take her down to the lamp/], ['rest', /Let her be/]], /Sit with Veda/],
    ['b6.leave', [['school', /Back Cordelia's school/], ['exchange', /Set the Exchange's tithes/], ['guard', /Set a standing guard/]], /Set the family's trades/],
    ['b6.east', [['all', /Take the family, all/], ['few', /Take two or three/], ['alone', /Go with Veda and Crane/]], /Settle who sails/],
  ];
  for (const [flag, branches, pick] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c15', {}, { hunger: 10, wealth: 900000 }, [re, /That will do/, pick], { sys: coven, flags: { 'b6.circle': 'all' }, stopAt: 'b6c16' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 16 takes each choice and records it', async () => {
  const sets = [
    ['b6.farewell', [['words', /Say a word to each/], ['seal', /Leave the family's seal/], ['none', /Board without a word/]]],
    ['b6.gray', [['hear', /Hear him out/], ['press', /Press him/], ['turn', /turn him out/], ['watch', /Let him stay/]]],
    ['b6.vow', [['promise', /Promise her/], ['ask', /Ask her what she wants/], ['plain', /do not know/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c16', {}, { hunger: 10, wealth: 900000 }, [re], { sys: coven, flags: { 'b6.circle': 'all', 'b6.east': 'all' }, stopAt: 'b6c17' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapters 15 and 16 play each way the earlier chapters went', async () => {
  for (const chapter of ['b6c15', 'b6c16']) {
    for (const callers of ['receive', 'family', 'show', 'shut']) {
      for (const east of ['all', 'few', 'alone']) {
        for (const [sys, circle] of [[coven, 'all'], [null, 'stay']]) {
          const run = await play(chapter, {}, START, [], { sys, flags: { 'b6.circle': circle, 'b6.callers': callers, 'b6.east': east, 'b6.warm': 'pale', 'b6.tallis': 'held' }, stopAt: 'b6c17' });
          clean(run);
        }
      }
    }
  }
});

test('chapters 15 and 16 never name a coven member who is not in the circle', async () => {
  for (const chapter of ['b6c15', 'b6c16']) {
    const run = await play(chapter, {}, START, [], { sys: null, flags: { 'b6.circle': 'stay' }, stopAt: 'b6c17' });
    assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno|Thibault/);
    clean(run);
  }
});

test('chapter 17 takes each choice and records it', async () => {
  const sets = [
    ['b6.hale', [['family', /say that you are the sixth/], ['alone', /go in alone/], ['card', /Slip a card/]], /Knock on the door/],
    ['b6.wire', [['answer', /Wire back to every one/], ['short', /Keep the answer short/], ['silent', /Send nothing at all/]], /wireless room/],
    ['b6.ship', [['cabins', /cabin corridors/], ['hold', /down to the hold/], ['wire', /wireless room for the rest/]], /Set the family's watch/],
    ['b6.light', [['sing', /Sing the seventh/], ['silent', /Say nothing/], ['bar', /Ask her to stop/]], /Go on deck with Veda/],
  ];
  for (const [flag, branches, pick] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c17', {}, { hunger: 10, wealth: 900000 }, [re, /That will do/, pick], { sys: coven, flags: { 'b6.circle': 'all', 'b6.east': 'all' }, stopAt: 'b6c18' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapter 18 takes each choice and records it', async () => {
  const sets = [
    ['b6.landing', [['family', /Send the family ashore/], ['first', /Go ashore yourself/], ['watch', /Hang back/]]],
    ['b6.letter', [['aloud', /Read it aloud/], ['alone', /Read it to yourself/], ['burn', /in the grate/]]],
    ['b6.stay', [['stay', /Ask Crane to stay/], ['go', /Ask Crane to come on/], ['choice', /his choice/]]],
    ['b6.road', [['train', /boat train/], ['car', /Hire the motor/], ['own', /Refuse the arrangements/]]],
  ];
  for (const [flag, branches] of sets) {
    for (const [value, re] of branches) {
      const run = await play('b6c18', {}, { hunger: 10, wealth: 900000 }, [re], { sys: coven, flags: { 'b6.circle': 'all', 'b6.east': 'few' }, stopAt: 'b6c19' });
      assert.equal(run.vars[flag], value, `${flag} ${value}`);
      clean(run);
    }
  }
});

test('chapters 17 and 18 play each way the earlier chapters went', async () => {
  for (const chapter of ['b6c17', 'b6c18']) {
    for (const east of ['all', 'few', 'alone']) {
      for (const gray of ['hear', 'press', 'turn', 'watch']) {
        for (const vow of ['promise', 'ask', 'plain']) {
          for (const [sys, circle] of [[coven, 'all'], [null, 'stay']]) {
            const run = await play(chapter, {}, START, [], { sys, flags: { 'b6.circle': circle, 'b6.east': east, 'b6.gray': gray, 'b6.vow': vow, 'b6.hale': 'card' }, stopAt: 'b6c19' });
            clean(run);
          }
        }
      }
    }
  }
});

test('chapters 17 and 18 never name a coven member who is not in the circle', async () => {
  for (const chapter of ['b6c17', 'b6c18']) {
    const run = await play(chapter, {}, START, [], { sys: null, flags: { 'b6.circle': 'stay' }, stopAt: 'b6c19' });
    assert.doesNotMatch(run.text, /Fiammetta|Prisca|Hanno|Thibault/);
    clean(run);
  }
});
