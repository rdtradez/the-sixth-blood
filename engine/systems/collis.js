// Collis: the hero's company and fortune, plus what he spends on (havens, networks, the
// coven house or the lone path's safehouses).
//
// Ventures (content/ventures.json) are bought per book and pay at every rest:
//   $ do invest("rome.wine")      buy it, or raise its level (up to maxLevel); costs wealth
//   $ do divest("rome.wine")      sell it back for half its cost
//   owns("rome.wine"), venture_level("rome.wine"), income()   income is per rest, in coin
//   can_invest("rome.wine")       affordable, of this book or earlier, not at its top level
// Dark ventures pay more but cost Humanity and Velati regard at every rest.
// The company name changes each era: collis(). $ do hide_collis(true) hides the link back to
// Collesanto (safer during the long sleep, at a cost the story decides).
//
// Holdings (content/holdings.json) are one time purchases with lasting effects:
//   $ do acquire("vaults")  holds("vaults")  can_acquire("vaults")
//   $ do choose_path("lone")  ("coven" or "lone"); lone() and coven_path() for conditions
// City holdings (a haven's tunnels) are left behind when he sleeps; lasting ones travel.

import { sysOf, cat, rule, bump, stat, scale, bookNumber, logDecision } from './core.js';
import { EngineError } from '../util.js';

export const PATHS = ['coven', 'lone'];

function venture(ctx, id) {
  return cat(ctx).ventures[id];
}

function cost(ctx, def, level = 1) {
  return Math.round(def.cost * level);
}

/** Coin paid by every venture this book, per rest. */
export function income(ctx) {
  const s = sysOf(ctx);
  let total = 0;
  for (const [id, v] of Object.entries(s.ventures)) {
    if (v.legacy) continue;
    const def = venture(ctx, id);
    if (def) total += def.income * v.level;
  }
  return Math.round(total);
}

function availableNow(ctx, def) {
  return bookNumber(ctx, def.book) <= bookNumber(ctx);
}

export function holdingEffect(ctx, key) {
  const s = sysOf(ctx);
  let total = 0;
  for (const id of Object.keys(s.holdings)) total += cat(ctx).holdings[id]?.effects?.[key] ?? 0;
  return total;
}

export const collis = {
  fns: {
    owns: { spec: ['venture'], fn: (ctx, id) => Boolean(sysOf(ctx).ventures[id]) },
    venture_level: { spec: ['venture'], fn: (ctx, id) => sysOf(ctx).ventures[id]?.level ?? 0 },
    can_invest: {
      spec: ['venture'],
      fn(ctx, id) {
        const def = venture(ctx, id);
        const lvl = sysOf(ctx).ventures[id]?.level ?? 0;
        return availableNow(ctx, def) && lvl < (def.maxLevel ?? 3) && stat(ctx, 'wealth') >= cost(ctx, def, lvl + 1);
      },
    },
    income: { spec: [], fn: (ctx) => income(ctx) },
    dark_ventures: {
      spec: [],
      fn: (ctx) => Object.entries(sysOf(ctx).ventures).filter(([id, v]) => !v.legacy && venture(ctx, id)?.dark).length,
    },
    collis: {
      spec: [],
      fn(ctx) {
        const names = rule(ctx, 'collis.names', {});
        return names[ctx.state.book] ?? names.default ?? 'Collis';
      },
    },
    collis_hidden: { spec: [], fn: (ctx) => Boolean(sysOf(ctx).collis.hidden) },
    holds: { spec: ['holding'], fn: (ctx, id) => Object.hasOwn(sysOf(ctx).holdings, id) },
    can_acquire: {
      spec: ['holding'],
      fn(ctx, id) {
        const def = cat(ctx).holdings[id];
        const s = sysOf(ctx);
        if (Object.hasOwn(s.holdings, id)) return false;
        if (def.path && def.path !== 'any' && def.path !== s.path) return false;
        if (def.book && !availableNow(ctx, def)) return false;
        return stat(ctx, 'wealth') >= Math.round(def.cost * scale(ctx));
      },
    },
    lone: { spec: [], fn: (ctx) => sysOf(ctx).path === 'lone' },
    coven_path: { spec: [], fn: (ctx) => sysOf(ctx).path === 'coven' },
  },
  commands: {
    invest: {
      spec: ['venture'],
      fn(ctx, id) {
        const def = venture(ctx, id);
        const s = sysOf(ctx);
        if (!availableNow(ctx, def)) throw new EngineError(`$ do invest(): "${id}" belongs to a later book`);
        const v = s.ventures[id] ?? { level: 0, book: ctx.state.book };
        if (v.level >= (def.maxLevel ?? 3)) throw new EngineError(`$ do invest(): "${id}" is already at its top level`);
        const price = cost(ctx, def, v.level + 1);
        if (stat(ctx, 'wealth') < price) throw new EngineError(`$ do invest(): not enough wealth for "${id}" (check can_invest() first)`);
        bump(ctx, 'wealth', -price);
        v.level += 1;
        v.legacy = false;
        s.ventures[id] = v;
        if (def.dark) logDecision(ctx, `venture.${id}`, v.level);
      },
    },
    divest: {
      spec: ['venture'],
      fn(ctx, id) {
        const s = sysOf(ctx);
        const v = s.ventures[id];
        if (!v) return;
        const def = venture(ctx, id);
        if (!v.legacy) bump(ctx, 'wealth', Math.round(cost(ctx, def, v.level) / 2));
        delete s.ventures[id];
        if (def.dark) logDecision(ctx, `venture.${id}`, 0);
      },
    },
    hide_collis: {
      spec: ['bool'],
      fn(ctx, hidden) {
        sysOf(ctx).collis.hidden = hidden;
        logDecision(ctx, `collis.hidden.${ctx.state.book}`, hidden);
      },
    },
    acquire: {
      spec: ['holding'],
      fn(ctx, id) {
        const def = cat(ctx).holdings[id];
        const s = sysOf(ctx);
        if (Object.hasOwn(s.holdings, id)) return;
        if (def.path && def.path !== 'any' && def.path !== s.path) throw new EngineError(`$ do acquire(): "${id}" is for the ${def.path} path`);
        const price = Math.round(def.cost * scale(ctx));
        if (stat(ctx, 'wealth') < price) throw new EngineError(`$ do acquire(): not enough wealth for "${id}" (check can_acquire() first)`);
        bump(ctx, 'wealth', -price);
        s.holdings[id] = ctx.state.book;
      },
    },
    choose_path: {
      spec: [PATHS],
      fn(ctx, path) {
        sysOf(ctx).path = path;
        logDecision(ctx, 'path', path);
      },
    },
    /** Add or remove coin outright (a deal, a theft, a windfall): $ do earn(40), $ do earn(-40). Scaled to the era. */
    earn: { spec: ['number'], fn: (ctx, n) => bump(ctx, 'wealth', Math.round(n * scale(ctx))) },
  },
};

/** At rest: ventures pay out; dark ones cost Humanity and draw the Velati. */
export function restCollis(ctx, report) {
  const s = sysOf(ctx);
  const paid = income(ctx);
  bump(ctx, 'wealth', paid);
  let humanity = 0;
  let velati = 0;
  for (const [id, v] of Object.entries(s.ventures)) {
    if (v.legacy) continue;
    const def = venture(ctx, id);
    if (!def?.dark) continue;
    humanity += (def.humanity ?? 2) * v.level;
    velati += (def.velati ?? 2) * v.level;
  }
  if (humanity) bump(ctx, 'humanity', -humanity);
  if (velati) bump(ctx, 'velati_regard', -velati);
  report.income = paid;
}
