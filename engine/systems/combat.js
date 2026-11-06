// Combat: short, choice driven fights of 2 or 3 exchanges, decided by stats and a seeded roll.
//
//   $ do fight("lictor")          begin (tiers in rules.combat.tiers); $ do fight("human", 2) for two exchanges
//   * Feint and slip past         each exchange is a choice whose body runs one strike:
//     $ do strike("cunning")      cunning, brutal, power (costs hunger), talk, flee
//   fight_over()                  loop back to the exchange choice until this is true
//   fight_result()                "won", "lost", "fled", "talked" ("" while it lasts)
//   last_strike()                 "hit" or "miss" for the exchange just played
//   fight_wins(), fight_losses()  exchanges won and lost so far
//
// Losing is never game over: the chapter writes what losing costs (capture, a lost asset).
// Each lost exchange adds injury and hunger. Kills are recorded separately with $ do kill().

import { sysOf, rule, bump, stat, roll } from './core.js';
import { animalDiet } from './life.js';
import { EngineError } from '../util.js';

export const APPROACHES = ['cunning', 'brutal', 'power', 'talk', 'flee'];

const DEFAULT_TIERS = {
  human: { difficulty: 4, injury: 5 },
  fledgling: { difficulty: 7, injury: 10 },
  elder: { difficulty: 11, injury: 18 },
  lictor: { difficulty: 12, injury: 20 },
  ancient: { difficulty: 15, injury: 25 },
  original: { difficulty: 99, injury: 35 },
};

function tiers(ctx) {
  return rule(ctx, 'combat.tiers', DEFAULT_TIERS);
}

export function tierNames(rules) {
  return Object.keys(rules?.combat?.tiers ?? DEFAULT_TIERS);
}

/** The hero's score for one exchange, before the roll. */
export function strikeScore(ctx, approach) {
  const cb = stat(ctx, 'cunning_brutal');
  let score = stat(ctx, 'age') * 2;
  if (approach === 'cunning') score += 1 + Math.floor(Math.max(0, -cb) / 25);
  if (approach === 'brutal') score += 1 + Math.floor(Math.max(0, cb) / 25);
  if (approach === 'power') score += 4;
  if (approach === 'talk') score += Math.floor(stat(ctx, 'standing') / 25) + Math.floor(stat(ctx, 'humanity') / 40);
  if (approach === 'flee') score += 2;
  const hunger = stat(ctx, 'hunger');
  if (hunger > 80) score -= 3;
  else if (hunger > 60) score -= 1;
  if (stat(ctx, 'injury') >= 50) score -= 2;
  if (animalDiet(sysOf(ctx))) score -= 1;
  return score;
}

export const combat = {
  fns: {
    fight_over: { spec: [], fn: (ctx) => Boolean(sysOf(ctx).fight?.result) },
    fight_result: { spec: [], fn: (ctx) => sysOf(ctx).fight?.result ?? '' },
    last_strike: { spec: [], fn: (ctx) => sysOf(ctx).fight?.last ?? '' },
    fight_wins: { spec: [], fn: (ctx) => sysOf(ctx).fight?.wins ?? 0 },
    fight_losses: { spec: [], fn: (ctx) => sysOf(ctx).fight?.losses ?? 0 },
  },
  commands: {
    fight: {
      spec: ['tier', 'number?'],
      fn(ctx, tier, exchanges = 3) {
        if (!Object.hasOwn(tiers(ctx), tier)) throw new EngineError(`$ do fight(): unknown enemy tier "${tier}"`);
        const n = Math.max(1, Math.round(exchanges));
        sysOf(ctx).fight = { tier, exchanges: n, need: Math.floor(n / 2) + 1, wins: 0, losses: 0, last: '', result: '' };
      },
    },
    strike: {
      spec: [APPROACHES],
      fn(ctx, approach) {
        const s = sysOf(ctx);
        const f = s.fight;
        if (!f || f.result) throw new EngineError('$ do strike(): no fight is under way ($ do fight("tier") first)');
        const t = tiers(ctx)[f.tier];
        if (approach === 'power') bump(ctx, 'hunger', rule(ctx, 'power.major', 10));
        const hit = strikeScore(ctx, approach) + roll(ctx, 6) >= t.difficulty;
        f.last = hit ? 'hit' : 'miss';
        if (hit && approach === 'flee') { f.result = 'fled'; return; }
        if (hit && approach === 'talk') { f.result = 'talked'; return; }
        if (hit) f.wins += 1;
        else {
          f.losses += 1;
          bump(ctx, 'injury', t.injury ?? 10);
          bump(ctx, 'hunger', rule(ctx, 'combat.lossHunger', 3));
        }
        if (f.wins >= f.need) f.result = 'won';
        else if (f.losses > f.exchanges - f.need) f.result = 'lost';
      },
    },
    heal: { spec: ['number?'], fn: (ctx, n = 100) => bump(ctx, 'injury', -n) },
  },
};
