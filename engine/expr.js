// A small, safe expression language for story scripts.
// No eval, no access to JavaScript objects: only numbers, strings, booleans,
// variables, a fixed set of operators, and whitelisted functions.
//
//   gold >= 10 and not met_cassian
//   hunger + 5
//   has("seen_intro") ? "yes" : "no"

import { EngineError } from './util.js';

export class ExprError extends Error {
  constructor(message, col) {
    super(message);
    this.name = 'ExprError';
    this.col = col;
  }
}

const WORD_OPS = { and: '&&', or: '||', not: '!' };
const TWO_CHAR = ['==', '!=', '<=', '>=', '&&', '||'];
const ONE_CHAR = '+-*/%<>!?:(),';

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^\d*\.?\d+/.exec(src.slice(i));
      toks.push({ k: 'num', v: parseFloat(m[0]), p: i });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let out = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) {
          const e = src[j + 1];
          out += e === 'n' ? '\n' : e;
          j += 2;
        } else {
          out += src[j++];
        }
      }
      if (j >= src.length) throw new ExprError('unclosed string', i);
      toks.push({ k: 'str', v: out, p: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i));
      const word = m[0];
      if (Object.hasOwn(WORD_OPS, word)) toks.push({ k: 'op', v: WORD_OPS[word], p: i });
      else toks.push({ k: 'id', v: word, p: i });
      i += word.length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR.includes(two)) { toks.push({ k: 'op', v: two, p: i }); i += 2; continue; }
    if (ONE_CHAR.includes(c)) { toks.push({ k: 'op', v: c, p: i }); i++; continue; }
    throw new ExprError(`unexpected character "${c}"`, i);
  }
  return toks;
}

/**
 * Parse an expression into an AST.
 * @param {string} src
 * @param {{callNames?: Set<string>|null}} opts  Allowed function names, or null to allow any.
 */
export function parseExpr(src, { callNames = null } = {}) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => peek() && peek().k === 'op' && peek().v === v;
  const expect = (v) => {
    if (!isOp(v)) throw new ExprError(`expected "${v}"`, peek() ? peek().p : src.length);
    p++;
  };

  function ternary() {
    const c = or();
    if (isOp('?')) {
      p++;
      const a = ternary();
      expect(':');
      const b = ternary();
      return { t: 'cond', c, a, b };
    }
    return c;
  }
  function or() {
    let a = and();
    while (isOp('||')) { p++; a = { t: 'bin', op: '||', a, b: and() }; }
    return a;
  }
  function and() {
    let a = equality();
    while (isOp('&&')) { p++; a = { t: 'bin', op: '&&', a, b: equality() }; }
    return a;
  }
  function equality() {
    let a = relational();
    while (isOp('==') || isOp('!=')) { const op = toks[p++].v; a = { t: 'bin', op, a, b: relational() }; }
    return a;
  }
  function relational() {
    let a = additive();
    while (isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) { const op = toks[p++].v; a = { t: 'bin', op, a, b: additive() }; }
    return a;
  }
  function additive() {
    let a = multiplicative();
    while (isOp('+') || isOp('-')) { const op = toks[p++].v; a = { t: 'bin', op, a, b: multiplicative() }; }
    return a;
  }
  function multiplicative() {
    let a = unary();
    while (isOp('*') || isOp('/') || isOp('%')) { const op = toks[p++].v; a = { t: 'bin', op, a, b: unary() }; }
    return a;
  }
  function unary() {
    if (isOp('!') || isOp('-')) { const op = toks[p++].v; return { t: 'un', op, a: unary() }; }
    return primary();
  }
  function primary() {
    const t = toks[p];
    if (!t) throw new ExprError('unexpected end of expression', src.length);
    if (t.k === 'num') { p++; return { t: 'lit', v: t.v }; }
    if (t.k === 'str') { p++; return { t: 'lit', v: t.v }; }
    if (t.k === 'id') {
      p++;
      if (t.v === 'true') return { t: 'lit', v: true };
      if (t.v === 'false') return { t: 'lit', v: false };
      if (isOp('(')) {
        p++;
        const args = [];
        if (!isOp(')')) {
          args.push(ternary());
          while (isOp(',')) { p++; args.push(ternary()); }
        }
        expect(')');
        if (callNames && !callNames.has(t.v)) throw new ExprError(`unknown function "${t.v}"`, t.p);
        return { t: 'call', name: t.v, args };
      }
      return { t: 'var', name: t.v };
    }
    if (t.k === 'op' && t.v === '(') {
      p++;
      const e = ternary();
      expect(')');
      return e;
    }
    throw new ExprError(`unexpected "${t.v}"`, t.p);
  }

  const ast = ternary();
  if (p < toks.length) throw new ExprError(`unexpected "${toks[p].v}"`, toks[p].p);
  return ast;
}

function toNum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  if (Number.isNaN(n)) throw new EngineError(`"${v}" is not a number`);
  return n;
}

function looseEquals(a, b) {
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  return a === b;
}

/**
 * Evaluate an AST.
 * ctx: { vars, fns, rand(), visited(name), unknown?(name) }
 * Variables that were never set read as 0 (so an unset flag is false).
 */
export function evaluate(ast, ctx) {
  switch (ast.t) {
    case 'lit': return ast.v;
    case 'var': {
      if (Object.prototype.hasOwnProperty.call(ctx.vars, ast.name)) return ctx.vars[ast.name];
      if (ctx.unknown) ctx.unknown(ast.name);
      return 0;
    }
    case 'un': {
      const v = evaluate(ast.a, ctx);
      return ast.op === '!' ? !v : -toNum(v);
    }
    case 'cond': return evaluate(ast.c, ctx) ? evaluate(ast.a, ctx) : evaluate(ast.b, ctx);
    case 'call': {
      const fn = Object.hasOwn(ctx.fns, ast.name) ? ctx.fns[ast.name] : null;
      if (!fn) throw new EngineError(`unknown function "${ast.name}"`);
      return fn(ctx, ...ast.args.map((a) => evaluate(a, ctx)));
    }
    case 'bin': {
      if (ast.op === '&&') return Boolean(evaluate(ast.a, ctx)) && Boolean(evaluate(ast.b, ctx));
      if (ast.op === '||') return Boolean(evaluate(ast.a, ctx)) || Boolean(evaluate(ast.b, ctx));
      const a = evaluate(ast.a, ctx);
      const b = evaluate(ast.b, ctx);
      switch (ast.op) {
        case '+': return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : toNum(a) + toNum(b);
        case '-': return toNum(a) - toNum(b);
        case '*': return toNum(a) * toNum(b);
        case '/': {
          const d = toNum(b);
          if (d === 0) throw new EngineError('division by zero');
          return toNum(a) / d;
        }
        case '%': {
          const d = toNum(b);
          if (d === 0) throw new EngineError('modulo by zero');
          return toNum(a) % d;
        }
        case '==': return looseEquals(a, b);
        case '!=': return !looseEquals(a, b);
        case '<': return typeof a === 'string' && typeof b === 'string' ? a < b : toNum(a) < toNum(b);
        case '>': return typeof a === 'string' && typeof b === 'string' ? a > b : toNum(a) > toNum(b);
        case '<=': return typeof a === 'string' && typeof b === 'string' ? a <= b : toNum(a) <= toNum(b);
        case '>=': return typeof a === 'string' && typeof b === 'string' ? a >= b : toNum(a) >= toNum(b);
      }
      throw new EngineError(`unknown operator ${ast.op}`);
    }
  }
  throw new EngineError(`bad expression node ${ast.t}`);
}

/** Functions available to every script. Later sessions add more through the runner env. */
export const BUILTIN_FNS = {
  min: (c, ...a) => Math.min(...a.map(toNum)),
  max: (c, ...a) => Math.max(...a.map(toNum)),
  abs: (c, v) => Math.abs(toNum(v)),
  round: (c, v) => Math.round(toNum(v)),
  floor: (c, v) => Math.floor(toNum(v)),
  ceil: (c, v) => Math.ceil(toNum(v)),
  clamp: (c, v, lo, hi) => Math.min(Math.max(toNum(v), toNum(lo)), toNum(hi)),
  has: (c, name) => Object.prototype.hasOwnProperty.call(c.vars, String(name)),
  chance: (c, p) => c.rand() < toNum(p),
  roll: (c, n) => 1 + Math.floor(c.rand() * toNum(n)),
  visited: (c, scene) => c.visited(String(scene)),
  lower: (c, s) => String(s).toLowerCase(),
  upper: (c, s) => String(s).toUpperCase(),
  cap: (c, s) => { const t = String(s); return t.charAt(0).toUpperCase() + t.slice(1); },
};
