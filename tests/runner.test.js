import test from 'node:test';
import assert from 'node:assert/strict';
import { play, texts } from './helpers.js';
import { EngineError } from '../engine/util.js';

const HEAD = '@chapter c1\n@title T\n@book b\n';

test('text, interpolation, and page breaks', () => {
  const { runner, state } = play(`${HEAD}# start
Hello.
Hunger is {hunger}.
---
Second page.
=> endbook
`);
  assert.deepEqual(texts(state.frame), ['Hello.', 'Hunger is 10.']);
  assert.equal(state.frame.wait, 'page');
  runner.continue();
  assert.deepEqual(texts(state.frame), ['Second page.']);
  assert.equal(state.frame.wait, 'chapter_end');
  assert.equal(state.frame.next, 'endbook');
});

test('assignments, compound operators, flags, and stat clamping', () => {
  const { state } = play(`${HEAD}# start
$ gold = 5
$ gold += 3
$ gold *= 2
$ hunger += 500
$ loyalty.livia = 150
$ flag a b
$ flag c
$ unflag b
$ name = "Livia"
---
`);
  assert.equal(state.vars.gold, 16);
  assert.equal(state.vars.hunger, 100);
  assert.equal(state.vars['loyalty.livia'], 100);
  assert.equal(state.vars.a, true);
  assert.equal('b' in state.vars, false);
  assert.equal(state.vars.name, 'Livia');
});

test('if / elif / else picks one branch', () => {
  const src = (n) => `${HEAD}# start
$ n = ${n}
?if n > 5
  big
?elif n > 2
  medium
?else
  small
?end
---
`;
  assert.deepEqual(texts(play(src(9)).state.frame), ['big']);
  assert.deepEqual(texts(play(src(3)).state.frame), ['medium']);
  assert.deepEqual(texts(play(src(0)).state.frame), ['small']);
});

test('nested conditions inside choice bodies', () => {
  const { runner, state } = play(`${HEAD}# start
$ brave = true
* Go
  ?if brave
    You are brave.
    ?if hunger > 50
      And starving.
    ?else
      And fed.
    ?end
  ?end
  Done.
---
`);
  runner.choose(0);
  assert.deepEqual(texts(state.frame), ['You are brave.', 'And fed.', 'Done.']);
});

test('choices: conditions hide options, [once] hides after use, rejoin works', () => {
  const { runner, state } = play(`${HEAD}# start
Pick.
* Always
  Took always.
* Once only [once]
  Took once.
  -> start
* Hidden ?if hunger > 90
  secret
After.
---
`);
  assert.deepEqual(state.frame.choices.map((c) => c.text), ['Always', 'Once only']);
  runner.choose(1);
  assert.deepEqual(state.frame.choices.map((c) => c.text), ['Always']);
  runner.choose(0);
  assert.deepEqual(texts(state.frame), ['Took always.', 'After.']);
});

test('choice index maps to the visible list, not the source list', () => {
  const { runner, state } = play(`${HEAD}# start
* First ?if no_such_flag
  one
* Second
  two
---
`);
  assert.deepEqual(state.frame.choices.map((c) => c.text), ['Second']);
  runner.choose(0);
  assert.deepEqual(texts(state.frame), ['two']);
});

test('call and return, scene visit counts', () => {
  const { runner, state } = play(`${HEAD}# start
Before.
~> sub
After {visited("sub")}.
---
# sub
In sub.
<~
`);
  assert.deepEqual(texts(state.frame), ['Before.', 'In sub.', 'After 1.']);
  assert.equal(state.stack.length, 0);
});

test('goto loops and :label jumps', () => {
  const { runner, state } = play(`${HEAD}# start
$ n = 0
:again
$ n += 1
?if n < 3
  -> :again
?end
Counted {n}.
---
`);
  assert.deepEqual(texts(state.frame), ['Counted 3.']);
});

test('randomness is seeded and survives a state copy', () => {
  const src = `${HEAD}# start
$ r = roll(1000)
Rolled {r}.
---
`;
  const a = texts(play(src, { seed: 7 }).state.frame);
  const b = texts(play(src, { seed: 7 }).state.frame);
  const c = texts(play(src, { seed: 8 }).state.frame);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('commands registered by the host run through $ do', () => {
  const seen = [];
  const { state } = play(`${HEAD}# start
$ do ping("hello", 2 + 3)
Done.
---
`, { env: { commands: { ping: (ctx, ...a) => seen.push(a) } } });
  assert.deepEqual(seen, [['hello', 5]]);
  assert.equal(state.frame.wait, 'page');
});

test('runtime errors say where they happened', () => {
  assert.throws(() => play(`${HEAD}# start
Line one.
$ x = 1 / 0
---
`), (e) => e instanceof EngineError && /test\.tsb:\d+ \(scene start\): division by zero/.test(e.message));
});

test('an infinite loop with no wait point is stopped', () => {
  assert.throws(() => play(`${HEAD}# start
-> start
`), /runaway loop/);
});

test('no visible choices continues past them with a warning', () => {
  const warnings = [];
  const { state } = play(`${HEAD}# start
* Hidden ?if no_flag
  x
After.
---
`, { env: { warn: (m) => warnings.push(m) } });
  assert.deepEqual(texts(state.frame), ['After.']);
  assert.equal(warnings.length, 1);
});

test('heading and quote text kinds', () => {
  const { state } = play(`${HEAD}# start
## Title
> A letter.
Plain.
---
`);
  assert.deepEqual(state.frame.paragraphs.map((p) => p.kind), ['h', 'quote', 'p']);
});
