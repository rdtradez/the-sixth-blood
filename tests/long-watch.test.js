// Sessions 72 and 73: the Long Watch interludes (lw01 to lw06) at the start of Unchained. (This file says what is guaranteed, not what happens.)

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

const coven = (g) => {
  const s = g.state.sys;
  s.path = 'coven';
  for (const [id, role] of [['prisca', 'head of the house'], ['fiammetta', 'fledgling of the hill'], ['hanno', 'keeper of the ledgers']]) {
    s.circle[id] = { id, kind: 'vampire', line: 'merchant', injured: false, mission: null, quest: null, task: '', taskResult: '', role, status: 'active', joined: 'blood-and-gold', age: 3 };
    g.state.vars[`loyalty.${id}`] = 70;
  }
};

async function play(chapter, { hunger = 10, withCoven = false, pick = () => 0 } = {}) {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {}, now: () => 5000 });
  await game.init();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed: 3 });
  await dev.jump(game, chapter, {});
  dev.setVar(game, 'hunger', hunger);
  dev.setVar(game, 'wealth', 300000);
  if (withCoven) coven(game);
  let frame = await dev.jump(game, chapter, { keep: true });
  const pages = [];
  for (let i = 0; i < 3000 && frame.wait !== 'book_end' && game.state.chapter === chapter; i++) {
    pages.push(...texts(frame));
    frame = frame.wait === 'choices' ? await game.choose(pick(frame, i)) : await game.continue();
  }
  pages.push(...texts(frame));
  return { game, text: pages.join('\n'), vars: game.state.vars };
}

const picks = [() => 0, (f) => f.choices.length - 1, (f, i) => i % f.choices.length];

test('the Long Watch chapters are unnumbered interludes at the start of Unchained', async () => {
  const game = new Game({ loader: real, storage: new MemoryStorage(), warn: () => {} });
  await game.init();
  const ids = dev.chapterList(game).filter((c) => c.id.startsWith('lw')).map((c) => c.id);
  assert.deepEqual(ids, ['lw01', 'lw02', 'lw03', 'lw04', 'lw05', 'lw06']);
});

for (const chapter of ['lw01', 'lw02', 'lw03', 'lw04', 'lw05', 'lw06']) {
  test(`${chapter} plays clean with and without a coven, fed and hungry, down every pick pattern`, async () => {
    for (const withCoven of [false, true]) {
      for (const hunger of [10, 90]) {
        for (const pick of picks) {
          const run = await play(chapter, { hunger, withCoven, pick });
          assert.doesNotMatch(run.text, /[–—]/);
          assert.doesNotMatch(run.text, /[{}]/);
          assert.doesNotMatch(run.text, /\$ do /);
          assert.notEqual(run.game.state.chapter, undefined);
        }
      }
    }
  });
}

test('lw01 names the lead only when a coven stands behind it, and records the supply choice', async () => {
  const lone = await play('lw01');
  assert.match(lone.text, /Dora Valer/);
  const house = await play('lw01', { withCoven: true });
  assert.doesNotMatch(house.text, /Dora Valer/);
  const run = await play('lw01', { pick: (f) => { const i = f.choices.findIndex((c) => /cold store of your own/.test(c.text)); return i >= 0 ? i : 0; } });
  assert.ok(['public', 'paid', 'private'].includes(run.vars['lw.supply']));
});

test('lw02 and lw03 register their flags with a quick start default', async () => {
  const flags = JSON.parse((await import('node:fs')).readFileSync(join(root, 'content/flags.json'), 'utf8'));
  const F = flags.flags ?? flags;
  for (const k of ['lw.supply', 'lw.door', 'lw.hill_1937', 'lw.shelter', 'lw.villa', 'lw.gate', 'lw.leads', 'lw.keep', 'lw.year']) {
    assert.equal(F[k].book, 'unchained');
    assert.ok('default' in F[k], k);
  }
});

test('lw04 to lw06 register their flags with a quick start default', async () => {
  const flags = JSON.parse((await import('node:fs')).readFileSync(join(root, 'content/flags.json'), 'utf8'));
  const F = flags.flags ?? flags;
  for (const k of ['lw.crash', 'lw.haven', 'lw.rival', 'lw.card', 'lw.order', 'lw.net', 'lw.bailout', 'lw.fall', 'lw.ready']) {
    assert.equal(F[k].book, 'unchained');
    assert.ok(F[k].values.includes(F[k].default), k);
  }
});

test('lw04 and lw06 multi pick loops let several picks stand and the most committed win', async () => {
  const all = (re) => (f) => { const i = f.choices.findIndex((c) => re.test(c.text)); return i >= 0 ? i : 0; };
  const run = await play('lw04', { withCoven: true, pick: all(/Buy, with everything|tower floor|Tell her that the house/) });
  assert.equal(run.vars['lw.crash'] === 'bought' || run.vars['lw.haven'] === 'tower' || run.vars['lw.rival'] === 'warned', true);
  const end = await play('lw06', { withCoven: true, pick: all(/Take the house in|Tell the family/) });
  assert.ok(['took', 'left', 'bought'].includes(end.vars['lw.fall']));
  assert.ok(['quiet', 'told', 'alone', 'called'].includes(end.vars['lw.ready']));
});

test('lw04 to lw06 name the lead only when a coven stands behind them', async () => {
  for (const ch of ['lw04', 'lw05', 'lw06']) {
    assert.match((await play(ch)).text, /Dora Valer/);
    assert.doesNotMatch((await play(ch, { withCoven: true })).text, /Dora Valer/);
  }
});
