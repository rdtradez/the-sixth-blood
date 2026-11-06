import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpr, evaluate, BUILTIN_FNS, ExprError } from '../engine/expr.js';
import { EngineError } from '../engine/util.js';

const ev = (src, vars = {}, extra = {}) =>
  evaluate(parseExpr(src), { vars, fns: BUILTIN_FNS, rand: () => 0.5, visited: () => 0, ...extra });

test('arithmetic and precedence', () => {
  assert.equal(ev('1 + 2 * 3'), 7);
  assert.equal(ev('(1 + 2) * 3'), 9);
  assert.equal(ev('10 % 4'), 2);
  assert.equal(ev('-3 + 5'), 2);
  assert.equal(ev('7 / 2'), 3.5);
});

test('comparison, logic, and word operators', () => {
  assert.equal(ev('gold >= 10 and not met', { gold: 12 }), true);
  assert.equal(ev('gold >= 10 and not met', { gold: 12, met: true }), false);
  assert.equal(ev('a || b', { a: 0, b: 'x' }), true);
});

test('unset variables read as 0 and unset flags are false', () => {
  assert.equal(ev('nope'), 0);
  assert.equal(ev('nope == false'), true);
  assert.equal(ev('nope > 3'), false);
});

test('strings concatenate and compare', () => {
  assert.equal(ev('"a" + "b"'), 'ab');
  assert.equal(ev('"a" + 2'), 'a2');
  assert.equal(ev('name == "Livia"', { name: 'Livia' }), true);
});

test('ternary', () => {
  assert.equal(ev('x > 1 ? "big" : "small"', { x: 5 }), 'big');
  assert.equal(ev('x > 1 ? "big" : "small"', { x: 0 }), 'small');
});

test('builtin functions', () => {
  assert.equal(ev('max(1, 9, 4)'), 9);
  assert.equal(ev('clamp(150, 0, 100)'), 100);
  assert.equal(ev('has("a")', { a: 0 }), true);
  assert.equal(ev('has("b")', { a: 0 }), false);
  assert.equal(ev('cap("hello")'), 'Hello');
  assert.equal(ev('roll(6)'), 4);
  assert.equal(ev('chance(0.9)'), true);
});

test('dotted names are plain variable names', () => {
  assert.equal(ev('loyalty.livia + 1', { 'loyalty.livia': 4 }), 5);
});

test('errors are reported, not thrown as raw JS', () => {
  assert.throws(() => parseExpr('1 +'), ExprError);
  assert.throws(() => parseExpr('1 $ 2'), ExprError);
  assert.throws(() => parseExpr('foo(1)', { callNames: new Set(['bar']) }), /unknown function/);
  assert.throws(() => ev('1 / 0'), EngineError);
});

test('no way to reach JavaScript', () => {
  assert.throws(() => parseExpr('constructor.constructor("x")()'), ExprError);
  assert.equal(ev('__proto__'), 0);
  assert.equal(ev('constructor'), 0);
});
