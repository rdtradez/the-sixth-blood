// Session 33: Book Three, chapters 9 and 10. Played down their branches. (This file says what is guaranteed, not what happens.)

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

async function play(chapter, wake, vars, wants = [], { stopAt = null, seed = 3 } = {}) {
  const game = await newGame();
  game.setSetting('dev', true);
  await game.startBook('burning-city', { from: 'new', hero: HERO, seed });
  await dev.jump(game, chapter, {});
  game.state.sys.sleep.wake = { quick: true, place: 'collesanto', steward: 'bank', outcome: 'on_schedule', years: 310, invest: [], ...wake };
  for (const [k, v] of Object.entries(vars)) dev.setVar(game, k, v);
  const frame = await dev.jump(game, chapter, { keep: true });
  return drive(game, frame, wants, stopAt);
}

const clean = (run) => {
  assert.doesNotMatch(run.text, /[–—]/);
  assert.doesNotMatch(run.text, /[{}]/);
  assert.doesNotMatch(run.text, /\$ do /);
};

const START = { hunger: 10, wealth: 40000 };

const via = (hub, branch) => [branch, hub];
const FIGHT = [/Break his guard/, /Draw, and meet him/];

test('chapter 9 plays through for every state of the book so far, and reaches chapter 10', async () => {
  for (const greve of ['stopped', 'allowed', 'left']) {
    for (const lictor of ['gave', 'hid', 'bargained']) {
      for (const hunger of [10, 90]) {
        for (const cadets of ['sworn', 'refused']) {
          const run = await play('b3c09', {}, { ...START, hunger, 'b3.greve': greve, 'b3.lictor': lictor, 'b3.cadets': cadets, 'b3.abolition': 'printed', 'b3.sugar': 'funded', 'b3.veil': 'silenced' }, [], { stopAt: 'b3c10' });
          assert.equal(run.game.state.chapter, 'b3c10', `${greve} ${lictor} ${hunger} ${cadets}`);
          assert.match(run.text, /thirty-first|thirty first/);
          clean(run);
        }
      }
    }
  }
});

test('chapter 9 takes each choice at the press, the brewery, the boy and the Prince', async () => {
  for (const abolition of ['printed', 'refused', 'unseen']) {
    for (const [key, re] of [['plain', /Print it plain/], ['annotated', /note under it about the colonies/], ['refused', /Decline the order/]]) {
      const run = await play('b3c09', {}, { ...START, 'b3.abolition': abolition, 'b3.sugar': 'kept' }, via(/press room, where Baptiste/, re), { stopAt: 'b3c10' });
      assert.equal(run.vars['b3.rights'], key, `${abolition} ${key}`);
      clean(run);
    }
  }
  for (const cadets of ['sworn', 'heard', 'refused']) {
    for (const [key, re] of [['sent', /Send them out of Paris/], ['stood', /stand with them/], ['told', /whole truth/]]) {
      const run = await play('b3c09', {}, { ...START, 'b3.cadets': cadets, 'b3.greve': 'allowed', 'b3.veil': 'silenced' }, via(/brewery in the rue de Charonne/, re), { stopAt: 'b3c10' });
      assert.equal(run.vars['b3.exodus'], key, `${cadets} ${key}`);
      clean(run);
    }
  }
  for (const greve of ['stopped', 'allowed', 'left']) {
    for (const [key, re] of [['taught', /quarry gallery, and begin/], ['hidden', /night coach for Lyon/], ['left', /Leave him where he is/]]) {
      const run = await play('b3c09', {}, { ...START, 'b3.greve': greve }, via(/Look for Thibault/, re), { stopAt: 'b3c10' });
      assert.equal(run.vars['b3.boy'], key, `${greve} ${key}`);
      clean(run);
    }
  }
  for (const octave of ['promised', 'spy', 'guarded']) {
    for (const [key, re] of [['asked', /recall the leave/], ['left', /leave the Prince to his chair/]]) {
      const run = await play('b3c09', {}, { ...START, 'b3.octave': octave }, via(/Hôtel de Saint-Aubin, where the trunks/, re), { stopAt: 'b3c10' });
      assert.equal(run.vars['b3.protest'], key, `${octave} ${key}`);
      clean(run);
    }
  }
});

test('chapter 9: the hunt can be settled by telling, by oath, or by steel, and every way leads on', async () => {
  const told = await play('b3c09', {}, START, [/Tell him where the boy is/], { stopAt: 'b3c10' });
  assert.equal(told.vars['b3.hunt'], 'taken');
  clean(told);
  const bargained = await play('b3c09', {}, { ...START, 'b3.lictor': 'bargained' }, [/Offer him your oath/], { stopAt: 'b3c10' });
  assert.equal(bargained.vars['b3.hunt'], 'sworn');
  clean(bargained);
  // The chapter sets b3.protest itself, so it is earned by asking the Prince on the night.
  const asked = await play('b3c09', {}, { ...START, 'b3.lictor': 'hid' }, [/Offer him your oath/, /recall the leave/, /Hôtel de Saint-Aubin, where the trunks/], { stopAt: 'b3c10' });
  assert.equal(asked.vars['b3.protest'], 'asked');
  assert.equal(asked.vars['b3.hunt'], 'sworn');
  clean(asked);
  // Without the standing to offer an oath, the choice is not on the page.
  const plain = await play('b3c09', {}, { ...START, 'b3.lictor': 'hid' }, [/Offer him your oath/], { stopAt: 'b3c10' });
  assert.notEqual(plain.vars['b3.hunt'], 'sworn');
});

test('chapter 9: a fight ends in one of the four outcomes, and both mercies can be reached', async () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    for (const mercy of [/Finish it/, /Let him go home/]) {
      const run = await play('b3c09', {}, START, [mercy, ...FIGHT], { stopAt: 'b3c10', seed });
      const hunt = run.vars['b3.hunt'];
      assert.ok(['taken', 'sworn', 'spared', 'destroyed'].includes(hunt), `${seed} ${hunt}`);
      seen.add(hunt);
      assert.equal(run.game.state.chapter, 'b3c10');
      clean(run);
    }
  }
  assert.ok(seen.has('destroyed') && seen.has('spared'), [...seen].join(','));
});

test('chapter 9 sets defaults for what he did not do, and spends three of four actions', async () => {
  const run = await play('b3c09', {}, START, [], { stopAt: 'b3c10' });
  const defaults = { 'b3.rights': 'refused', 'b3.exodus': 'stood', 'b3.boy': 'left', 'b3.protest': 'left' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(run.vars['b3.hunt'] !== undefined);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  clean(run);
});

test('chapter 10 plays through for every state of the book so far', async () => {
  for (const hunt of ['taken', 'sworn', 'spared', 'destroyed']) {
    for (const exodus of ['sent', 'stood', 'told']) {
      for (const hunger of [10, 90]) {
        for (const roll of ['read', 'left']) {
          const run = await play('b3c10', {}, { ...START, hunger, 'b3.hunt': hunt, 'b3.exodus': exodus, 'b3.roll': roll, 'b3.weapon': 'accepted', 'b3.aubry': 'drilled', 'b3.grain': 'relieved' }, []);
          clean(run);
          assert.equal(run.game.state.chapter, 'b3c10', `${hunt} ${exodus} ${hunger} ${roll}`);
          assert.match(run.text, /baker's boy/);
        }
      }
    }
  }
});

test('chapter 10 takes each choice at Versailles, on the road, in the cellar and in the faubourg', async () => {
  for (const weapon of ['accepted', 'refused']) {
    for (const [key, re] of [['door', /Hold the door/], ['women', /March back with the women/], ['watched', /Stay on the terrace/]]) {
      const run = await play('b3c10', {}, { ...START, 'b3.weapon': weapon }, via(/post horse for Versailles/, re));
      assert.equal(run.vars['b3.versailles'], key, `${weapon} ${key}`);
      clean(run);
    }
  }
  for (const roll of ['read', 'left']) {
    for (const [key, re] of [['followed', /Follow it, and see/], ['taken', /Stop the chaise/], ['let', /Let it go by/]]) {
      const run = await play('b3c10', {}, { ...START, 'b3.roll': roll }, via(/Avignon courier will come in/, re));
      assert.equal(run.vars['b3.courier'], key, `${roll} ${key}`);
      clean(run);
    }
  }
  for (const [key, re] of [['read', /Read what the hand/], ['broke', /Break the slate/], ['left', /Close the grille/]]) {
    for (const courier of ['followed', 'taken', 'let']) {
      const run = await play('b3c10', {}, { ...START, 'b3.courier': courier }, via(/Answer Ottaviano's note/, re));
      assert.equal(run.vars['b3.vault'], key, `${courier} ${key}`);
      clean(run);
    }
  }
  for (const exodus of ['sent', 'stood', 'told']) {
    for (const grain of ['relieved', 'hoarded', 'ignored']) {
      for (const [key, re] of [['bread', /Send a cart of the house's bread/], ['armed', /muskets from the house's stores/], ['none', /Do nothing, and go home/]]) {
        const run = await play('b3c10', {}, { ...START, 'b3.exodus': exodus, 'b3.grain': grain }, via(/faubourg Saint-Antoine, where the women/, re));
        assert.equal(run.vars['b3.march'], key, `${exodus} ${grain} ${key}`);
        clean(run);
      }
    }
  }
});

test('chapter 10 sets defaults for what he did not do, and ends with the book paused after the last written chapter', async () => {
  const run = await play('b3c10', {}, START, []);
  const defaults = { 'b3.versailles': 'watched', 'b3.courier': 'let', 'b3.vault': 'left', 'b3.march': 'none' };
  for (const k of Object.keys(defaults)) assert.ok(run.vars[k] !== undefined, k);
  assert.ok(Object.keys(defaults).filter((k) => run.vars[k] !== defaults[k]).length <= 3);
  assert.equal(run.game.state.chapter, 'b3c10');
  clean(run);
});
