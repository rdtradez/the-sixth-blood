import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGame, memoryLoader, texts } from './helpers.js';
import { createNodeLoader } from '../engine/node-loader.js';
import { MemoryStorage } from '../engine/saves.js';
import { Game } from '../engine/game.js';

const HEAD = (id, extra = '') => `@chapter ${id}\n@title ${id}\n@book b\n${extra}`;

test('the real engine-test book plays start to finish and records completion', async () => {
  const root = join(fileURLToPath(import.meta.url), '../..');
  const warnings = [];
  const game = new Game({ loader: createNodeLoader(root), storage: new MemoryStorage(), warn: (m) => warnings.push(m), now: () => 42 });
  await game.init();
  let frame = await game.newGame({ book: 'engine-test', seed: 5 });
  assert.equal(frame.wait, 'page');
  assert.match(texts(frame).join(' '), /gold is 0 and hunger is 10/);
  frame = await game.continue();
  assert.deepEqual(texts(frame).slice(0, 2), ['Condition passed.', 'Hunger was clamped to 100.']);
  assert.deepEqual(frame.choices.map((c) => c.text), ['Take the left door', 'Take the right door']);
  frame = await game.choose(1); // right door, loops back
  assert.deepEqual(frame.choices.map((c) => c.text), ['Take the left door']);
  frame = await game.choose(0);
  assert.deepEqual(texts(frame), ['You went left.', 'Both paths rejoin here.', 'Inside the helper, counter is 1.', 'Back from the helper. Counter is 1.']);
  frame = await game.continue();
  assert.equal(frame.wait, 'chapter_end');
  assert.match(texts(frame)[0], /The doors scene ran 2 time\(s\)/);
  frame = await game.continue(); // into et2
  assert.equal(game.state.chapter, 'et2');
  assert.match(texts(frame)[0], /cunning_brutal at 0/);
  frame = await game.continue();
  frame = await game.continue(); // chapter_end => endbook
  assert.equal(frame.wait, 'book_end');
  assert.ok(game.profile.completedBooks['engine-test']);
  assert.deepEqual(warnings, []);
});

const BASIC = {
  c1: `${HEAD('c1', '@next c2\n')}
# start
Intro line.
---
Choose.
* Left
  $ turn = "left"
  Went left.
* Right
  $ turn = "right"
  Went right.
More text.
---
=> next
`,
  c2: `${HEAD('c2')}
# start
Second chapter, turn was {turn}.
---
=> endbook
`,
};

test('autosave captures every wait point; reloading resumes exactly there', async () => {
  const storage = new MemoryStorage();
  const game = await makeGame(memoryLoader({ chapters: BASIC }), { storage });
  await game.newGame({ book: 'b', seed: 1 });
  await game.continue();
  assert.equal(game.frame.wait, 'choices');

  // A brand new game object (a closed and reopened app) picks up from the autosave.
  const reopened = await makeGame(memoryLoader({ chapters: BASIC }), { storage });
  assert.equal(reopened.saves.latest().slot, 'auto');
  const { frame, notices } = await reopened.loadSlot('auto');
  assert.deepEqual(notices, []);
  assert.equal(frame.wait, 'choices');
  assert.deepEqual(texts(frame), ['Choose.']);
  assert.deepEqual(frame.choices.map((c) => c.text), ['Left', 'Right']);
  await reopened.choose(1);
  assert.equal(reopened.state.vars.turn, 'right');
});

test('manual save, keep playing, then load restores earlier state and the same dice', async () => {
  const chapters = {
    c1: `${HEAD('c1')}
# start
Before.
---
$ r = roll(1000)
Rolled {r}.
---
=> endbook
`,
  };
  const game = await makeGame(memoryLoader({ chapters }));
  await game.newGame({ book: 'b', seed: 99 });
  game.saveToSlot('1');
  await game.continue();
  const first = texts(game.frame)[0];
  await game.loadSlot('1');
  assert.deepEqual(texts(game.frame), ['Before.']);
  await game.continue();
  assert.equal(texts(game.frame)[0], first);
});

test('mid-call saves restore the call stack', async () => {
  const chapters = {
    c1: `${HEAD('c1')}
# start
Start.
~> inner
Back in start.
---
=> endbook
# inner
Inside.
---
More inside.
<~
`,
  };
  const game = await makeGame(memoryLoader({ chapters }));
  await game.newGame({ book: 'b' });
  assert.equal(game.state.stack.length, 1);
  game.saveToSlot('1');
  const again = await makeGame(memoryLoader({ chapters }), { storage: game.storage });
  await again.loadSlot('1');
  assert.equal(again.state.stack.length, 1);
  await again.continue();
  assert.deepEqual(texts(again.frame), ['More inside.', 'Back in start.']);
  assert.equal(again.state.stack.length, 0);
});

test('editing a chapter after a save: the position is found again by fingerprint', async () => {
  const v1 = `${HEAD('c1', '@version 1\n')}
# start
Alpha.
---
Bravo.
* Take path
  Walked.
---
=> endbook
`;
  const storage = new MemoryStorage();
  const g1 = await makeGame(memoryLoader({ chapters: { c1: v1 } }), { storage });
  await g1.newGame({ book: 'b' });
  await g1.continue();
  assert.equal(g1.frame.wait, 'choices');
  g1.saveToSlot('1');

  // The author adds two paragraphs and a whole new page before the choice.
  const v2 = `${HEAD('c1', '@version 2\n')}
# start
New opening.
New second line.
---
Alpha.
---
A brand new page.
---
Bravo.
* Take path
  Walked.
---
=> endbook
`;
  const g2 = await makeGame(memoryLoader({ chapters: { c1: v2 } }), { storage });
  const { frame, notices } = await g2.loadSlot('1');
  assert.equal(frame.wait, 'choices');
  assert.deepEqual(frame.choices.map((c) => c.text), ['Take path']);
  assert.match(notices.join(' '), /matched to the new version/);
  assert.equal(g2.state.chapterVersion, 2);
  await g2.choose(0);
  assert.deepEqual(texts(g2.frame), ['Walked.']);
});

test('editing a chapter so the saved moment is gone restarts the scene, not the game', async () => {
  const v1 = `${HEAD('c1')}
# start
Setup.
$ keep = 7
---
Old page.
---
=> endbook
`;
  const storage = new MemoryStorage();
  const g1 = await makeGame(memoryLoader({ chapters: { c1: v1 } }), { storage });
  await g1.newGame({ book: 'b' });
  await g1.continue();
  g1.saveToSlot('1');
  const v2 = `${HEAD('c1', '@version 2\n')}
# start
Completely rewritten.
---
=> endbook
`;
  const g2 = await makeGame(memoryLoader({ chapters: { c1: v2 } }), { storage });
  const { frame, notices } = await g2.loadSlot('1');
  assert.deepEqual(texts(frame), ['Completely rewritten.']);
  assert.match(notices.join(' '), /restarts from its beginning/);
  assert.equal(g2.state.vars.keep, 7); // earlier choices and stats are kept
});

test('a named anchor survives edits that change the surrounding text', async () => {
  const v1 = `${HEAD('c1')}
# start
Some old words.
:gate
---
After the gate.
=> endbook
`;
  const storage = new MemoryStorage();
  const g1 = await makeGame(memoryLoader({ chapters: { c1: v1 } }), { storage });
  await g1.newGame({ book: 'b' });
  g1.saveToSlot('1');
  const v2 = `${HEAD('c1', '@version 2\n')}
# start
Totally different words now.
One more line.
:gate
---
After the gate.
=> endbook
`;
  const g2 = await makeGame(memoryLoader({ chapters: { c1: v2 } }), { storage });
  const { frame, notices } = await g2.loadSlot('1');
  assert.equal(frame.wait, 'page');
  assert.match(notices.join(' '), /matched to the new version/);
});

test('removing a scene restarts the chapter; removing a chapter restarts the book', async () => {
  const two = {
    c1: `${HEAD('c1', '@next c2\n')}\n# start\nOne.\n-> mid\n# mid\nMid.\n---\n=> next\n`,
    c2: `${HEAD('c2')}\n# start\nTwo.\n---\n=> endbook\n`,
  };
  const storage = new MemoryStorage();
  const g1 = await makeGame(memoryLoader({ chapters: two }), { storage });
  await g1.newGame({ book: 'b' });
  g1.saveToSlot('1');
  const noMid = { ...two, c1: `${HEAD('c1', '@next c2\n')}\n# start\nOne.\n---\n=> next\n` };
  const g2 = await makeGame(memoryLoader({ chapters: noMid }), { storage });
  const r2 = await g2.loadSlot('1');
  assert.match(r2.notices.join(' '), /no longer exists/);
  assert.deepEqual(texts(r2.frame), ['One.']);

  await g1.continue(); // to the end of c1
  await g1.continue(); // into c2
  assert.equal(g1.state.chapter, 'c2');
  g1.saveToSlot('2');
  const g3 = await makeGame(memoryLoader({ chapters: { c1: two.c1 } }), { storage });
  const r3 = await g3.loadSlot('2');
  assert.match(r3.notices.join(' '), /no longer exists/);
  assert.equal(g3.state.chapter, 'c1');
});

test('new stats added after a save get their start value; content migrations rename flags', async () => {
  const chapters = { c1: `${HEAD('c1')}\n# start\nHi.\n---\n=> endbook\n` };
  const storage = new MemoryStorage();
  const g1 = await makeGame(memoryLoader({ chapters, contentVersion: 1 }), { storage });
  await g1.newGame({ book: 'b' });
  g1.state.vars.met_x = true;
  g1.saveToSlot('1');

  const stats = { hunger: { start: 10 }, courage: { start: 3 } };
  const migrations = [{ version: 2, note: 'Renamed a flag.', up: (s) => { s.vars.x_met = s.vars.met_x; delete s.vars.met_x; return s; } }];
  const g2 = await makeGame(memoryLoader({ chapters, contentVersion: 2, stats, migrations }), { storage });
  const { notices } = await g2.loadSlot('1');
  assert.equal(g2.state.vars.courage, 3);
  assert.equal(g2.state.vars.x_met, true);
  assert.equal('met_x' in g2.state.vars, false);
  assert.deepEqual(notices, ['Renamed a flag.']);
});

test('a save failure never interrupts play', async () => {
  const storage = new MemoryStorage();
  const game = await makeGame(memoryLoader({ chapters: BASIC }), { storage });
  storage.setItem = () => { throw new Error('quota'); };
  await game.newGame({ book: 'b' });
  await game.continue();
  assert.equal(game.frame.wait, 'choices');
  assert.equal(game.lastSaveError.code, 'storage_full');
});

test('bad content gives a readable error that names the file and line', async () => {
  const chapters = { c1: `${HEAD('c1')}\n# start\nText\n$ oops = (\n` };
  const game = await makeGame(memoryLoader({ chapters }));
  await assert.rejects(() => game.newGame({ book: 'b' }), /c1\.tsb:\d+:/);
});
