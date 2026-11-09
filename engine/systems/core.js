// Shared helpers for the game systems (session 3).
//
// Every system keeps its state under state.sys (see createSys in index.js) and its data in
// a content catalog (content/ventures.json, village.json, ...). Scripts reach the systems
// through expression functions and `$ do` commands. Each function and command declares the
// kinds of its arguments in a spec, which is used twice: at play time to reject unknown ids,
// and by `npm run check` to reject misspelled literal ids before release.

import { EngineError } from '../util.js';
import { assign } from '../state.js';
import { statDef } from '../content.js';
import { toNum } from '../expr.js';
import { EMPTY_LOOKS } from '../looks.js';
import { siteKnown } from '../maps.js';

/** The systems part of the state, created on first use (tests may run without it). */
export function sysOf(ctx) {
  const st = ctx.state;
  if (!st.sys) throw new EngineError('this save has no game systems state (it should have been upgraded)');
  return st.sys;
}

/** The catalogs (content/*.json for the systems), or an empty one in bare tests. */
export function cat(ctx) {
  return ctx.content?.systems ?? EMPTY_CATALOG;
}

export const EMPTY_CATALOG = {
  rules: {},
  ventures: {},
  buildings: {},
  holdings: {},
  originals: {},
  items: {},
  codex: {},
  kin: {},
  looks: EMPTY_LOOKS,
  gaps: {},
  investments: {},
  tiers: { human: {}, fledgling: {}, elder: {}, lictor: {}, ancient: {}, original: {} },
};

/** A tuning value from content/rules.json with a fallback: rule(ctx, 'combat.tiers.human.difficulty', 4). */
export function rule(ctx, path, fallback) {
  let v = cat(ctx).rules;
  for (const k of path.split('.')) {
    if (v === null || typeof v !== 'object' || !Object.hasOwn(v, k)) return fallback;
    v = v[k];
  }
  return v ?? fallback;
}

/** Current value of a stat, falling back to its declared start. */
export function stat(ctx, name) {
  const vars = ctx.state.vars;
  if (Object.hasOwn(vars, name)) return toNum(vars[name]);
  const d = statDef(ctx.content?.stats ?? {}, name);
  return toNum(d?.start ?? d?.min ?? 0);
}

/** Change a stat by delta, clamped to its declared range. */
export function bump(ctx, name, delta) {
  if (!delta) return;
  assign(ctx.state, ctx.content?.stats ?? {}, name, stat(ctx, name) + delta);
}

export function setStat(ctx, name, value) {
  assign(ctx.state, ctx.content?.stats ?? {}, name, value);
}

/** The current book's number (1 to 7). Developer and unknown books count as 1. */
export function bookNumber(ctx, id = ctx.state.book) {
  const b = ctx.content?.manifest?.books?.find((x) => x.id === id);
  const n = b?.asBook ?? b?.number;
  return typeof n === 'number' ? n : 1;
}

/** Cost multiplier for the current book (money is worth more as the centuries pass). */
export function scale(ctx) {
  const list = rule(ctx, 'scale', [1, 8, 30, 80, 150, 400, 1500]);
  return list[Math.min(list.length, Math.max(1, bookNumber(ctx))) - 1] ?? 1;
}

/** A whole number from 1 to n, from the game's seeded random. */
export function roll(ctx, n = 6) {
  const r = ctx.rand ? ctx.rand() : 0.5;
  return 1 + Math.floor(r * n);
}

/** Record a major system decision in the decision log (latest value per name). */
export function logDecision(ctx, name, value) {
  const st = ctx.state;
  st.decisions ??= [];
  const i = st.decisions.findIndex((d) => d.name === name);
  if (i >= 0) st.decisions.splice(i, 1);
  st.decisions.push({ name, value, book: st.book, chapter: st.chapter });
}

// ---- Argument specs ------------------------------------------------------------------------
//
// A spec is a list of argument kinds. A kind is a catalog name ('person', 'venture',
// 'building', 'holding', 'original', 'item', 'investment', 'steward', 'codex', 'kin'), a plain type
// ('text', 'number', 'bool', 'any'), or an array of allowed strings. A trailing '?' makes an
// argument optional.

const CATALOG_KINDS = {
  venture: ['ventures', 'venture', 'content/ventures.json'],
  building: ['buildings', 'building', 'content/village.json'],
  holding: ['holdings', 'holding', 'content/holdings.json'],
  original: ['originals', 'original', 'content/originals.json'],
  item: ['items', 'collection item', 'content/collection.json'],
  investment: ['investments', 'sleep investment', 'content/sleep.json'],
  codex: ['codex', 'codex entry', 'content/codex.json'],
  kin: ['kin', 'family member', 'content/family.json'],
  tier: ['tiers', 'enemy tier', 'content/rules.json (combat.tiers)'],
};

/** Problem with one argument value, or null. Used at play time and by the checker. */
export function argProblem(kind, value, content) {
  const k = kind?.opt ? kind.kind : typeof kind === 'string' ? kind.replace(/\?$/, '') : kind;
  if (Array.isArray(k)) return k.includes(value) ? null : `"${value}" is not one of: ${k.join(', ')}`;
  const systems = content?.systems ?? EMPTY_CATALOG;
  if (k === 'person') {
    return Object.hasOwn(content?.people ?? {}, value) ? null : `unknown person "${value}" (add them to content/people.json)`;
  }
  if (k === 'steward') {
    if (value === 'keepers' || value === 'bank') return null;
    return Object.hasOwn(content?.people ?? {}, value) ? null : `unknown steward "${value}" (a person id, "keepers" or "bank")`;
  }
  if (Object.hasOwn(CATALOG_KINDS, k)) {
    const [key, label, file] = CATALOG_KINDS[k];
    return Object.hasOwn(systems[key], value) ? null : `unknown ${label} "${value}" (see ${file})`;
  }
  if (k === 'site') return siteKnown(value) ? null : `unknown map site "${value}" (use map.site, see engine/maps.js)`;
  if (k === 'number') return typeof value === 'number' && Number.isFinite(value) ? null : `expected a number, got ${JSON.stringify(value)}`;
  if (k === 'bool') return typeof value === 'boolean' ? null : `expected true or false, got ${JSON.stringify(value)}`;
  if (k === 'text') return typeof value === 'string' ? null : `expected text, got ${JSON.stringify(value)}`;
  return null;
}

export function optional(kind) {
  return Boolean(kind?.opt) || (typeof kind === 'string' && kind.endsWith('?'));
}

/** An optional argument of any kind, for enums: opt(['a', 'b']). */
export function opt(kind) {
  return { opt: true, kind };
}

/** The allowed values of an enum kind, or null. */
export function enumValues(kind) {
  const k = kind?.opt ? kind.kind : kind;
  return Array.isArray(k) ? k : null;
}

/** Wrap an implementation so its arguments are checked against its spec at play time. */
export function checked(name, spec, impl, what) {
  const required = spec.filter((k) => !optional(k)).length;
  return (ctx, ...args) => {
    if (args.length < required || args.length > spec.length) {
      throw new EngineError(`${what} ${name}() takes ${required === spec.length ? required : `${required} to ${spec.length}`} argument(s), got ${args.length}`);
    }
    args.forEach((v, i) => {
      const p = argProblem(spec[i], v, ctx.content);
      if (p) throw new EngineError(`${what} ${name}(): ${p}`);
    });
    return impl(ctx, ...args);
  };
}
