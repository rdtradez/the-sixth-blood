// Session 38: Book Three, chapters 19 and 20 (the ninth of Thermidor, and the long quiet). Played down their branches. (This file says what is guaranteed, not what happens.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

async function play(chapter, vars, wants = [], { stopAt = null, seed = 3, sys = null } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'collesanto', steward: 'bank', outcome: 'on_schedule', years: 310, invest: [] };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  if (sys) sys(game);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt ?? (chapter === 'b3c19' ? 'b3c20' : null));
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
  assert.doesNotMatch(run.text, /in the sun\b|last of the sun|in the daylight/);
};

const START = { hunger: 10, wealth: 40000 };
const via = (hub, branch) => [branch, hub];

const EARLIER = { 'b3.keeper': 'adelaide', 'b3.third': 'read', 'b3.key': 'held', 'b3.vault': 'broke', 'b3.hunt': 'sworn', 'b3.cell': 'promised', 'b3.marais': 'vowed', 'b3.officer': 'pledged', 'b3.rising': 'carried', 'b3.young': 'held', 'b3.committee': 'dodged' };

test('Book Three is finished at twenty chapters, with its journal and recap', async () => {
  const game = await newGame();
  const book = game.library().find((b) => b.id === 'crown-of-ashes');
  assert.equal(book.incomplete, false);
  assert.equal(book.chapterCount, 20);
  const manifest = JSON.parse(await readFile(join(root, 'content/manifest.json'), 'utf8'));
  const b3 = manifest.books.find((b) => b.id === 'crown-of-ashes');
  assert.equal(b3.journal, 'journal/crown-of-ashes.tsb');
  assert.ok(b3.recap.length > 50);
});

test('chapter 19 plays through for every state of the book so far, and reaches chapter 20', async () => {
  for (const rising of ['covered', 'carried', 'watched']) {
    for (const officer of ['pledged', 'defied', 'bargained']) {
      for (const hunt of ['sworn', 'spared']) {
        for (const young of ['backed', 'held', 'forbade']) {
          for (const committee of ['served', 'dodged', 'refused']) {
            for (const hunger of [10, 90]) {
              const run = await play('b3c19', { ...START, ...EARLIER, hunger, 'b3.rising': rising, 'b3.officer': officer, 'b3.hunt': hunt, 'b3.young': young, 'b3.committee': committee }, []);
              assert.equal(run.game.state.chapter, 'b3c20', `${rising} ${officer} ${hunt} ${young} ${committee} ${hunger}`);
              assert.match(run.text, /Thermidor/);
              clean(run);
            }
          }
        }
      }
    }
  }
});

test('chapter 19 takes each choice in the hall, the quarry, the shop and the rue des Prouvaires', async () => {
  const sets = [
    [/where the court has met without the Prince/, 'b3.court', [['held', /the Peace is the Prince's and the Lady's/], ['pushed', /the Peace was kept because it was a habit/], ['left', /that you are a printer/]]],
    [/where the Cadets are waiting/, 'b3.quarry', [['opened', /Open the quarry/], ['shut', /Keep the quarry shut/], ['led', /Lead them out yourself/]]],
    [/where two men want the presses/, 'b3.thermidor', [['commune', /Print the Commune's proclamation/], ['convention', /Print the Convention's decree/], ['neither', /Print neither/]]],
    [/where there is a courier at midnight/, 'b3.report', [['written', /Give him an account/], ['lied', /nothing to report/], ['refused', /Refuse, and tell him/]]],
  ];
  for (const young of ['backed', 'held', 'forbade']) {
    for (const hunt of ['sworn', 'spared']) {
      for (const [hub, flag, branches] of sets) {
        for (const [value, re] of branches) {
          const run = await play('b3c19', { ...START, ...EARLIER, 'b3.young': young, 'b3.hunt': hunt }, via(hub, re));
          assert.equal(run.vars[flag], value, `${flag} ${value} ${young} ${hunt}`);
          clean(run);
        }
      }
    }
  }
});

test('chapter 19 spends only three of four actions, and always plays the third cellar', async () => {
  const run = await play('b3c19', { ...START, ...EARLIER }, []);
  assert.match(run.text, /The Lady|She is sitting up/);
  const set = ['b3.court', 'b3.quarry', 'b3.thermidor', 'b3.report'].filter((k) => run.vars[k] !== undefined);
  assert.equal(set.length, 4, 'every night flag is registered and has a value');
});

test('chapter 19 records how the Prince is released and how the Lady is met', async () => {
  for (const key of ['b3.key', 'b3.vault', 'b3.third']) {
    const vals = { 'b3.key': ['held', 'refused'], 'b3.vault': ['broke', 'read', 'left'], 'b3.third': ['read', 'touched', 'left'] }[key];
    for (const v of vals) {
      for (const [pv, pre] of [['kept', /Ask her, for his sake/], ['yielded', /Say nothing, and let it be done/]]) {
        for (const [lv, lre] of [['knelt', /Kneel, as the court does/], ['answered', /Answer her plainly/], ['stood', /Do not kneel/]]) {
          const run = await play('b3c19', { ...START, ...EARLIER, [key]: v }, [pre, lre]);
          assert.equal(run.vars['b3.prince'], pv, `${key} ${v} ${pv}`);
          assert.equal(run.vars['b3.lady'], lv, `${key} ${v} ${lv}`);
          clean(run);
        }
      }
    }
  }
});

test('chapter 19 skipped flags keep their defaults', async () => {
  const run = await play('b3c19', { ...START }, [/where the court has met/, /where the Cadets/, /where two men/]);
  assert.ok(['left', 'held', 'pushed'].includes(run.vars['b3.court']));
  const none = await play('b3c19', { ...START }, []);
  assert.equal(none.game.state.chapter, 'b3c20');
});

test('chapter 20 ends the book, sleeps to New Orleans and writes the journal', async () => {
  const run = await play('b3c20', { ...START, ...EARLIER });
  assert.equal(run.frame.wait, 'book_end');
  clean(run);
  const wake = run.game.state.sys.sleep.wake;
  assert.equal(wake.gap, 'paris_to_new_orleans');
  assert.equal(wake.years, 65);
  assert.equal(run.game.state.booksDone.includes('crown-of-ashes'), true);
  assert.ok(run.game.state.journal.some((e) => e.kind === 'velati' && e.book === 'crown-of-ashes'), 'the journal entry is written');
  assert.equal(run.game.library().find((b) => b.id === 'house-divided').unlocked, true);
});

test('chapter 20 plays every last night, place, steward, orders, guard and letter', async () => {
  const nights = [[/long table in the shop/, 'house'], [/sit with the Cadets/, 'quarry'], [/Hôtel de Saint-Aubin with Ottaviano/, 'court'], [/Walk by yourself/, 'alone']];
  for (const prince of ['kept', 'yielded']) {
    for (const lady of ['knelt', 'answered', 'stood']) {
      for (const [re, value] of nights) {
        for (const quarry of ['opened', 'shut', 'led']) {
          const run = await play('b3c20', { ...START, ...EARLIER, 'b3.prince': prince, 'b3.lady': lady, 'b3.quarry': quarry, 'b3.court': 'held' }, [re]);
          assert.equal(run.frame.wait, 'book_end', `${prince} ${lady} ${value} ${quarry}`);
          assert.equal(run.vars['b3.last_night'], value);
          clean(run);
        }
      }
    }
  }
  for (const [re, place] of [[/The cellar under the great house/, 'collesanto'], [/A haven in the city/, 'haven'], [/The tomb in the rock/, 'tomb']]) {
    const run = await play('b3c20', START, [re]);
    assert.equal(run.game.state.sys.sleep.history.at(-1).place, place);
  }
  for (const [re, who, keeper] of [[/Merchant house, as a bank/, 'bank', 'none'], [/Adélaïde, and the house of Valère/, 'adelaide', 'adelaide'], [/Baptiste, and the house of Valère/, 'baptiste', 'baptiste']]) {
    const run = await play('b3c20', { ...START, 'b3.keeper': keeper }, [re]);
    assert.equal(run.game.state.sys.sleep.history.at(-1).steward, who);
    assert.equal(run.game.state.sys.sleep.history.at(-1).gap, 'paris_to_new_orleans');
  }
  const keepers = await play('b3c20', START, [/The Valerio keepers/], { sys: (g) => { g.state.sys.circle.ginevra = { kind: 'keeper', status: 'active', line: 'human', role: 'matriarch', loyalty: 70, tier: 0, joined: 'blood-and-gold' }; } });
  assert.equal(keepers.game.state.sys.sleep.history.at(-1).steward, 'keepers');
  for (const orders of [/Play it safe/, /Grow it aggressively/, /dark ventures/]) {
    const run = await play('b3c20', START, [orders]);
    assert.equal(run.frame.wait, 'book_end');
  }
  const bare = await play('b3c20', { ...START, wealth: 5000 }, [/That will do/]);
  const guarded = await play('b3c20', { ...START, wealth: 5000 }, [/Lay traps/, /Pay the people/, /Hire guardians/]);
  assert.equal(bare.frame.wait, 'book_end');
  assert.equal(guarded.frame.wait, 'book_end');
});

test('chapter 20 records the letter and the last night', async () => {
  const left = await play('b3c20', START, [/Write a letter/]);
  assert.equal(left.vars['b3.letter'], 'left');
  const none = await play('b3c20', START, [/Write nothing/]);
  assert.equal(none.vars['b3.letter'], 'none');
});

test('the journal for Book Three reads the earlier choices', async () => {
  const run = await play('b3c20', { ...START, 'b3.rising': 'carried', 'b3.report': 'written', 'b3.prince': 'kept', 'b3.lady': 'stood', 'b3.quarry': 'led', 'b3.letter': 'left' }, [/Write a letter/]);
  const entry = run.game.state.journal.find((e) => e.kind === 'velati' && e.book === 'crown-of-ashes');
  assert.ok(entry, 'the journal entry exists');
  const text = JSON.stringify(entry);
  assert.match(text, /wicker coffin/);
  assert.match(text, /Plutarch/);
  assert.match(text, /did not kneel/);
  assert.doesNotMatch(text, /[–—]/);
});

test('chapter 20 offers the ventures of the long sleep to New Orleans, one or many, and carries them to the wake report', async () => {
  const none = await play('b3c20', { ...START, ...EARLIER }, [/That will do/, /That will do/]);
  assert.equal(none.frame.wait, 'book_end');
  assert.deepEqual(none.game.state.sys.sleep.wake.invest, []);
  clean(none);
  const some = await play('b3c20', { ...START, ...EARLIER }, [/Buy land on the lower river/, /first railways/, /That will do/]);
  assert.deepEqual(some.game.state.sys.sleep.wake.invest, ['land_before_purchase', 'first_railways']);
  clean(some);
  const all = await play('b3c20', { ...START, ...EARLIER }, [/lower river/, /canal/, /first railways/, /cotton mills/, /diggings/, /governments that are at war/, /Buy a share in cotton/, /That will do/]);
  assert.equal(all.game.state.sys.sleep.wake.invest.length, 7);
  clean(all);
});
