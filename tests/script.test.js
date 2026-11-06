import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChapter } from '../engine/script.js';
import { validateChapter } from '../engine/validate.js';

const HEAD = '@chapter c1\n@title T\n@book b\n';

test('a minimal chapter compiles', () => {
  const { chapter, errors } = parseChapter(`${HEAD}\n# start\nHello.\n=> endbook\n`);
  assert.deepEqual(errors, []);
  assert.equal(chapter.id, 'c1');
  assert.equal(chapter.version, 1);
  assert.equal(chapter.scenes.start.ops.length, 2);
});

test('errors carry file and line numbers', () => {
  const { errors } = parseChapter(`${HEAD}\n# start\nOk.\n$ gold = = 3\n`, { file: 'x.tsb' });
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /^x\.tsb:7:/);
});

test('reports several problems at once', () => {
  const { errors } = parseChapter(`${HEAD}\n# start\n$ a = (\n$ b = )\n?end\n`);
  assert.ok(errors.length >= 3, `expected 3+ errors, got ${errors.length}`);
});

test('missing header, unknown header, and text before a scene', () => {
  assert.match(parseChapter('# start\nHi\n').errors[0].message, /@chapter/);
  assert.match(parseChapter(`${HEAD}@bogus x\n# start\nHi\n`).errors[0].message, /unknown header/);
  assert.match(parseChapter(`${HEAD}Loose text\n# start\nHi\n`).errors[0].message, /before the first scene/);
});

test('unclosed ?if and orphan ?else are errors', () => {
  assert.match(parseChapter(`${HEAD}# start\n?if a\nx\n`).errors[0].message, /never closed/);
  assert.match(parseChapter(`${HEAD}# start\n?else\nx\n`).errors[0].message, /without a matching/);
});

test('unclosed brace in text is an error, escaped brace is fine', () => {
  assert.match(parseChapter(`${HEAD}# start\nHalf {open\n`).errors[0].message, /unclosed/);
  const { chapter, errors } = parseChapter(`${HEAD}# start\nA \\{literal\\} brace\n=> endbook\n`);
  assert.deepEqual(errors, []);
  assert.equal(chapter.scenes.start.ops[0].text, 'A {literal} brace');
});

test('unknown functions are caught at parse time', () => {
  assert.match(parseChapter(`${HEAD}# start\n$ a = wobble(1)\n`).errors[0].message, /unknown function/);
  assert.deepEqual(parseChapter(`${HEAD}# start\n$ a = wobble(1)\n=> endbook\n`, { fnNames: ['wobble'] }).errors, []);
});

test('labels: jumps resolve, unknown labels error, duplicates error', () => {
  const ok = parseChapter(`${HEAD}# start\n:top\nHi\n---\n-> :top\n`);
  assert.deepEqual(ok.errors, []);
  assert.match(parseChapter(`${HEAD}# start\n-> :nowhere\n`).errors[0].message, /not found/);
  assert.match(parseChapter(`${HEAD}# start\n:a\nx\n:a\ny\n=> endbook\n`).errors[0].message, /duplicate label/);
});

test('empty choice body falls to the end of the set, not into the next option', () => {
  const src = `${HEAD}# start\n* A\n* B\n  -> other\n* C\nAfter.\n=> endbook\n# other\n=> endbook\n`;
  const { chapter, errors } = parseChapter(src);
  assert.deepEqual(errors, []);
  const ops = chapter.scenes.start.ops;
  const choices = ops.find((o) => o.op === 'choices');
  const target = (opt) => ops[opt.to];
  // A is empty: it must land on a jump past the whole set (not into B's goto)
  assert.equal(target(choices.options[0]).op, 'jmp');
  assert.equal(target(choices.options[1]).op, 'goto');
  assert.equal(choices.options[2].to, choices.end);
});

test('validation: missing scenes, bad chapter targets, unreachable and fall-off warnings', () => {
  const src = `${HEAD}# start\n-> nowhere\n# lonely\nText\n=> bogus\n`;
  const { chapter } = parseChapter(src);
  const { errors, warnings } = validateChapter(chapter, { chapterIds: new Set(['c1']) });
  const msgs = errors.map((e) => e.detail).join('|');
  assert.match(msgs, /no such scene/);
  assert.match(msgs, /no such chapter/);
  const w = warnings.map((e) => e.detail).join('|');
  assert.match(w, /never reached/);
});

test('validation: a scene that can run off its end is warned about', () => {
  const { chapter } = parseChapter(`${HEAD}# start\n?if x\n  -> start\n?end\n`);
  const { warnings } = validateChapter(chapter);
  assert.match(warnings.map((e) => e.detail).join('|'), /run off its end/);
});

test('a scene whose every path ends is not flagged', () => {
  const src = `${HEAD}# start\n?if x\n  -> a\n?else\n  -> a\n?end\n# a\n* One\n  => endbook\n* Two\n  => endbook\n`;
  const { chapter, errors } = parseChapter(src);
  assert.deepEqual(errors, []);
  assert.deepEqual(validateChapter(chapter).warnings, []);
});
