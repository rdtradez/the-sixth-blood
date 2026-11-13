// Collesanto: the village he protects across the centuries.
//
// The collesanto stat is its size and prosperity. Buildings (content/village.json) raise
// prosperity and defense; money sent home raises prosperity directly.
//   $ do build("well")        pays the cost (scaled to the era) and adds the building
//   built("well"), can_build("well")
//   $ do send_home(50)        send coin home (scaled to the era): prosperity grows with it
//   can_build_any(), village_next()   anything buildable now; the earliest building that can be built now (or "")
//   village_defense()         how well Collesanto can protect itself (and him, if he sleeps there)
// Buildings keep working while he sleeps, and the village grows a little in every long sleep.

import { sysOf, cat, rule, bump, stat, scale, bookNumber } from './core.js';
import { EngineError } from '../util.js';

export function villageDefense(ctx) {
  const s = sysOf(ctx);
  let d = 0;
  for (const id of Object.keys(s.village.built)) d += cat(ctx).buildings[id]?.defense ?? 0;
  return d;
}

function problem(ctx, id) {
  const def = cat(ctx).buildings[id];
  const s = sysOf(ctx);
  if (Object.hasOwn(s.village.built, id)) return 'already built';
  if (bookNumber(ctx, def.book) > bookNumber(ctx)) return 'belongs to a later book';
  for (const r of def.requires ?? []) if (!Object.hasOwn(s.village.built, r)) return `needs "${r}" first`;
  if (stat(ctx, 'wealth') < Math.round(def.cost * scale(ctx))) return 'not enough wealth';
  return null;
}

export const village = {
  fns: {
    built: { spec: ['building'], fn: (ctx, id) => Object.hasOwn(sysOf(ctx).village.built, id) },
    can_build: { spec: ['building'], fn: (ctx, id) => problem(ctx, id) === null },
    can_build_any: { spec: [], fn: (ctx) => Object.keys(cat(ctx).buildings).some((id) => problem(ctx, id) === null) },
    village_next: { spec: [], fn: (ctx) => Object.keys(cat(ctx).buildings).find((id) => problem(ctx, id) === null) ?? '' },
    village_defense: { spec: [], fn: (ctx) => villageDefense(ctx) },
  },
  commands: {
    build: {
      spec: ['building'],
      fn(ctx, id) {
        const p = problem(ctx, id);
        if (p) throw new EngineError(`$ do build("${id}"): ${p} (check can_build() first)`);
        const def = cat(ctx).buildings[id];
        bump(ctx, 'wealth', -Math.round(def.cost * scale(ctx)));
        bump(ctx, 'collesanto', def.prosperity ?? 0);
        sysOf(ctx).village.built[id] = ctx.state.book;
      },
    },
    send_home: {
      spec: ['number'],
      fn(ctx, n) {
        const amount = Math.min(stat(ctx, 'wealth'), Math.round(n * scale(ctx)));
        if (amount <= 0) return;
        bump(ctx, 'wealth', -amount);
        const s = sysOf(ctx);
        s.village.fund += amount / scale(ctx);
        // Every "per" coins (in Rome's money) raise prosperity by one.
        const per = rule(ctx, 'village.coinPerProsperity', 20);
        const gain = Math.floor(s.village.fund / per);
        if (gain) { bump(ctx, 'collesanto', gain); s.village.fund -= gain * per; }
      },
    },
    /** The village is harmed (a raid, a fire): prosperity falls and a building can be lost. */
    village_harm: {
      spec: ['number', 'building?'],
      fn(ctx, n, lost) {
        bump(ctx, 'collesanto', -Math.abs(n));
        if (lost) delete sysOf(ctx).village.built[lost];
      },
    },
  },
};
