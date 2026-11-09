// Sleep and steward resolution, at the end of every book except Chicago.
//
// The book's last chapter lets the player choose, then resolves the sleep:
//   $ do rest_place("collesanto")       collesanto, haven or tomb
//   $ do steward("keepers")             a circle member's id, "keepers" or "bank"
//   $ do orders("safe")                 safe, aggressive or dark
//   $ do protection("traps")            traps, bribes, guardians (any number of them)
//   $ do sleep_invest("new_amsterdam")  an order tied to this gap (content/sleep.json investments)
//   $ do steward_corrupted()            someone has secretly turned or bribed the steward
//   $ do sleep()                        resolve the sleep to the next book (or $ do sleep("gap_id"))
//
// The result is the wake report, read in the next book's opening:
//   wake("outcome")     prospered, on_schedule, losses, woken_early
//   wake("by")          who woke him early: hunters, government, steward ("" otherwise)
//   wake("steward")     who held his fortune; wake("orders"), wake("place"), wake("gap")
//   wake("richer")      true if he wakes with more than he slept on
//   wake("years")       years asleep (a number; fine to print: it is history, not a stat)
//   wake_event("black_death")  true if that event happened during the sleep (from the gap's events)
//
// A long sleep can be played as several short ones. Gaps that share a "chain" in content/sleep.json
// (each marked "split": true so a quick start skips them) are the segments of one sleep: each segment
// is resolved with its own $ do sleep("segment_id"), and the wake report after the last one reads as
// the whole sleep (years and events add up; "richer" compares with where the chain began).
//
// Results depend on the steward's loyalty and skill, the protections, where he sleeps, what
// he ordered, and the history the gap passes through. What he built keeps working: ventures
// fold into the fortune, the village grows, and Collesanto's walls guard him if he sleeps there.

import { sysOf, cat, rule, bump, stat, setStat, roll, logDecision, scale } from './core.js';
import { income, holdingEffect } from './collis.js';
import { villageDefense } from './village.js';
import { memberPower, wakeCircle } from './circle.js';
import { EngineError } from '../util.js';

export const PLACES = ['collesanto', 'haven', 'tomb'];
export const ORDERS = ['safe', 'aggressive', 'dark'];
export const PROTECTIONS = ['traps', 'bribes', 'guardians'];
export const OUTCOMES = ['prospered', 'on_schedule', 'losses', 'woken_early'];
export const WAKE_FIELDS = ['outcome', 'by', 'steward', 'orders', 'place', 'gap', 'richer', 'years'];

const ORDER_RULES = {
  safe: { risk: 0, growth: 1 },
  aggressive: { risk: 1, growth: 1.5 },
  dark: { risk: 2, growth: 2.2, humanity: 12, velati: 10 },
};

function plan(s) {
  s.sleep.plan ??= { place: '', steward: '', orders: '', protections: [], invest: [], corrupt: false };
  return s.sleep.plan;
}

function stewardScore(ctx, who) {
  const s = sysOf(ctx);
  if (who === 'bank') return { score: rule(ctx, 'sleep.bankSkill', 4), growth: rule(ctx, 'sleep.bankGrowth', 0.8) };
  if (who === 'keepers') {
    const oath = Object.hasOwn(s.holdings, 'keeper_oath') ? 1 : 0;
    return { score: 2 + oath + Math.floor(stat(ctx, 'loyalty.keepers') / 25), growth: 1 };
  }
  const m = s.circle[who];
  if (!m || m.status !== 'active') return { score: 0, growth: 0.5 };
  return { score: memberPower(ctx, m) + Math.floor(stat(ctx, `loyalty.${who}`) / 20), growth: 1 + (m.kind === 'vampire' ? 0.1 : 0) };
}

function placeHide(ctx, place) {
  if (place === 'collesanto') return 1 + Math.floor(villageDefense(ctx) / 2);
  if (place === 'tomb') return 3;
  return holdingEffect(ctx, 'hide');
}

/** Work out the sleep. Separate from the command so tests can check the numbers. */
export function resolveSleep(ctx, gapId) {
  const s = sysOf(ctx);
  const gaps = cat(ctx).gaps;
  const id = gapId ?? Object.keys(gaps).find((g) => gaps[g].from === ctx.state.book);
  const gap = gaps[id];
  if (!gap) throw new EngineError(`$ do sleep(): no sleep gap from "${ctx.state.book}" in content/sleep.json`);
  const p = plan(s);
  const place = p.place || 'haven';
  const steward = p.steward || 'bank';
  const orders = p.orders || 'safe';
  const o = rule(ctx, `sleep.orders.${orders}`, ORDER_RULES[orders]);
  const st = stewardScore(ctx, steward);

  const protect = p.protections.reduce((n, k) => n + rule(ctx, `sleep.protections.${k}`, { traps: 1, bribes: 1, guardians: 2 }[k]), 0);
  for (const k of p.invest) if (!gap.investments?.[k]) throw new EngineError(`$ do sleep_invest("${k}") is not an option when sleeping from "${gap.from}" (gap "${id}")`);
  const invest = p.invest.map((k) => gap.investments[k]);
  const eventRisk = (gap.events ?? []).reduce((n, e) => n + (e.risk ?? 0), 0);
  const paperTrail = s.collis.hidden ? 0 : rule(ctx, 'sleep.paperTrail', 1);
  const exposed = stat(ctx, 'secrecy') < 40 ? 2 : 0;
  const investRisk = invest.reduce((n, i) => n + (i.risk ?? 0), 0);

  const safety = st.score + protect + placeHide(ctx, place) + holdingEffect(ctx, 'defense') + roll(ctx, 6);
  const danger = rule(ctx, 'sleep.baseDanger', 6) + o.risk + eventRisk + paperTrail + exposed + investRisk + (p.corrupt ? 4 : 0);
  const margin = safety - danger;
  const outcome = margin >= 3 ? 'prospered' : margin >= 0 ? 'on_schedule' : margin >= -3 ? 'losses' : 'woken_early';

  // The fortune: savings plus what the ventures are worth, grown by the gap, the orders and the steward.
  const before = stat(ctx, 'wealth');
  const ventures = income(ctx) * rule(ctx, 'sleep.ventureValue', 20);
  const fortune = holdingEffect(ctx, 'fortune'); // vaults and hidden fortunes protect a share from losses
  let growth = gap.growth * o.growth * st.growth;
  for (const i of invest) growth *= i.growth ?? 1;
  if (place === 'tomb') growth *= 0.9;
  if (outcome === 'prospered') growth *= 1.2;
  const keep = Math.min(0.9, fortune / 10);
  let after = (before + ventures) * growth;
  // A poor steward loses assets; being found and woken early leaves him broke, whatever the years.
  if (outcome === 'losses') after *= 0.5 + keep / 2;
  if (outcome === 'woken_early') after = before * (0.25 + keep / 2);
  after = Math.round(after);

  const by = outcome === 'woken_early' ? (p.corrupt ? 'steward' : roll(ctx, 2) === 1 ? 'hunters' : 'government') : '';
  return {
    gap: id, chain: gap.chain ?? '', from: gap.from, to: gap.to, years: gap.years ?? 0, place, steward, orders, outcome, by,
    before, after, richer: after > before, events: (gap.events ?? []).map((e) => e.id),
    invest: p.invest.slice(), humanity: (o.humanity ?? 0) + invest.reduce((n, i) => n + (i.humanity ?? 0), 0), velati: o.velati ?? 0,
    village: outcome === 'woken_early' ? 0 : (gap.village ?? 5) + (steward === 'keepers' ? 5 : 0) + (place === 'collesanto' ? 2 : 0),
    margin,
  };
}

function applySleep(ctx, r) {
  const s = sysOf(ctx);
  setStat(ctx, 'wealth', r.after);
  if (r.humanity) bump(ctx, 'humanity', -r.humanity);
  if (r.velati) bump(ctx, 'velati_regard', -r.velati);
  bump(ctx, 'collesanto', r.village);
  bump(ctx, 'age', 1);
  setStat(ctx, 'hunger', r.outcome === 'woken_early' ? 90 : rule(ctx, 'sleep.wakeHunger', 60));
  setStat(ctx, 'injury', 0);
  setStat(ctx, 'adjustment', rule(ctx, 'sleep.wakeAdjustment', 10));
  if (r.outcome === 'woken_early') bump(ctx, 'secrecy', -20);
  // Ventures fold into the fortune; city holdings stay behind in the old city.
  for (const v of Object.values(s.ventures)) v.legacy = true;
  for (const id of Object.keys(s.holdings)) if (cat(ctx).holdings[id]?.scope === 'city') delete s.holdings[id];
  wakeCircle(ctx);
  s.collis.hidden = false;
  s.phase = null;
  s.fight = null;
  s.recent = [];
  s.unfed = 0;
  const { margin, ...report } = r;
  if (!report.chain) delete report.chain;
  else {
    // A segment of a longer sleep: the report reads as the whole sleep so far.
    const prior = s.sleep.history.filter((h) => h.chain === report.chain);
    const last = prior.at(-1);
    if (last) {
      report.years += last.years;
      report.events = [...new Set([...last.events, ...report.events])];
      report.richer = report.after > prior[0].before;
    }
    report.segments = prior.length + 1;
  }
  s.sleep.history.push(report);
  s.sleep.wake = report;
  s.sleep.plan = null;
  logDecision(ctx, `sleep.${r.from}`, r.outcome);
}

export const sleep = {
  fns: {
    wake: {
      spec: [WAKE_FIELDS],
      fn(ctx, field) {
        const w = sysOf(ctx).sleep.wake;
        if (!w) return field === 'richer' ? false : field === 'years' ? 0 : '';
        return w[field];
      },
    },
    wake_event: { spec: ['text'], fn: (ctx, id) => Boolean(sysOf(ctx).sleep.wake?.events?.includes(id)) },
  },
  commands: {
    rest_place: { spec: [PLACES], fn: (ctx, place) => { plan(sysOf(ctx)).place = place; } },
    steward: {
      spec: ['steward'],
      fn(ctx, who) {
        const s = sysOf(ctx);
        if (who !== 'keepers' && who !== 'bank' && s.circle[who]?.status !== 'active') throw new EngineError(`$ do steward("${who}"): they are not in the circle`);
        plan(s).steward = who;
        logDecision(ctx, `steward.${ctx.state.book}`, who);
      },
    },
    orders: {
      spec: [ORDERS],
      fn(ctx, orders) {
        plan(sysOf(ctx)).orders = orders;
        logDecision(ctx, `orders.${ctx.state.book}`, orders);
      },
    },
    protection: {
      spec: [PROTECTIONS],
      fn(ctx, kind) {
        const p = plan(sysOf(ctx));
        if (!p.protections.includes(kind)) p.protections.push(kind);
        // Bribes and guardians cost coin, scaled to the era.
        const price = rule(ctx, `sleep.protectionCost.${kind}`, { traps: 10, bribes: 20, guardians: 30 }[kind]);
        bump(ctx, 'wealth', -Math.min(stat(ctx, 'wealth'), Math.round(price * scale(ctx))));
      },
    },
    sleep_invest: {
      spec: ['investment'],
      fn(ctx, id) {
        const p = plan(sysOf(ctx));
        if (!p.invest.includes(id)) p.invest.push(id);
        logDecision(ctx, `invest.${id}`, true);
      },
    },
    steward_corrupted: { spec: [], fn: (ctx) => { plan(sysOf(ctx)).corrupt = true; } },
    sleep: {
      spec: ['text?'],
      fn(ctx, gapId) {
        const gaps = cat(ctx).gaps;
        if (gapId !== undefined && !Object.hasOwn(gaps, gapId)) throw new EngineError(`$ do sleep("${gapId}"): no such gap in content/sleep.json`);
        applySleep(ctx, resolveSleep(ctx, gapId));
      },
    },
  },
};

/** Quick start: a default, uneventful sleep for every skipped gap. */
export function quickSleep(ctx, fromBookIds) {
  const s = sysOf(ctx);
  for (const [id, gap] of Object.entries(cat(ctx).gaps)) {
    if (!fromBookIds.includes(gap.from) || gap.split) continue;
    const report = { gap: id, from: gap.from, to: gap.to, years: gap.years ?? 0, place: 'haven', steward: 'bank', orders: 'safe', outcome: 'on_schedule', by: '', before: 0, after: 0, richer: true, events: (gap.events ?? []).map((e) => e.id), invest: [], humanity: 0, velati: 0, village: 0, quick: true };
    s.sleep.history.push(report);
    s.sleep.wake = report;
  }
}
