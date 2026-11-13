// Day and night phases, feeding, power costs, kills, witnesses and day raids.
//
// A chapter's middle is a day phase and a night phase of 2 or 3 actions each:
//   $ do phase("day")        begin a phase (actions from content/rules.json, or $ do phase("day", 2))
//   $ do act()               spend one action; $ do act(1, true) acts at midday (extra hunger in early books)
//   actions_left()           how many actions remain; in_phase() is "day", "night" or ""
//   $ do end_phase()         close the phase early (a random event interrupting it)
// Hunger and its consequences:
//   $ do feed("animal")      human, human_kill, animal, donor, bank (see rules.feeding)
//   $ do power("major")      minor, major, great: power use raises hunger
//   must_feed()              true when hunger is high or he has gone too many actions unfed
//   $ do kill("human")       a kill (costs Humanity and Secrecy at rest); $ do witness(2) people who saw
//   $ do raid()              a day raid on sleeping vampires; senate_alarm() once raids are overused

import { sysOf, rule, bump, stat, bookNumber } from './core.js';
import { EngineError } from '../util.js';

export const PHASES = ['day', 'night'];
export const FEEDS = ['human', 'human_kill', 'animal', 'donor', 'bank'];
export const POWERS = ['minor', 'major', 'great'];
export const KILLS = ['human', 'vampire'];

const DEFAULT_FEEDING = {
  human: { hunger: -45, humanity: -2 },
  human_kill: { hunger: -70, humanity: -6, kill: true },
  animal: { hunger: -25 },
  donor: { hunger: -40, humanity: -1 },
  bank: { hunger: -40 },
};

/** Spend actions from the current day or night phase. Shared by $ do act() and the Coven tab. */
export function spendActions(ctx, n = 1, midday = false) {
  const s = sysOf(ctx);
  if (!s.phase) throw new EngineError('$ do act(): no day or night phase has begun ($ do phase("day"))');
  const spend = Math.max(1, Math.round(n));
  s.phase.left = Math.max(0, s.phase.left - spend);
  s.phase.used += spend;
  s.unfed += spend;
  if (s.phase.kind === 'day' && midday) bump(ctx, 'hunger', sunHunger(ctx) * spend);
}

export const life = {
  fns: {
    in_phase: { spec: [], fn: (ctx) => sysOf(ctx).phase?.kind ?? '' },
    actions_left: { spec: [], fn: (ctx) => sysOf(ctx).phase?.left ?? 0 },
    must_feed: {
      spec: [],
      fn: (ctx) => stat(ctx, 'hunger') >= rule(ctx, 'hunger.mustFeedAt', 85) || sysOf(ctx).unfed >= rule(ctx, 'hunger.unfedLimit', 5),
    },
    /** How many times he has fed this way, ever: fed("human"). */
    fed: { spec: [FEEDS], fn: (ctx, kind) => sysOf(ctx).diet[kind] ?? 0 },
    /** True if his recent feeding has been mostly animal blood (he is weaker for it). */
    animal_diet: { spec: [], fn: (ctx) => animalDiet(sysOf(ctx)) },
    raids: { spec: [], fn: (ctx) => sysOf(ctx).raids[ctx.state.book] ?? 0 },
    senate_alarm: { spec: [], fn: (ctx) => (sysOf(ctx).raids[ctx.state.book] ?? 0) >= rule(ctx, 'raids.alarmAt', 3) },
  },
  commands: {
    phase: {
      spec: [PHASES, 'number?'],
      fn(ctx, kind, n) {
        const left = n ?? rule(ctx, `phases.actions.${kind}`, 3);
        sysOf(ctx).phase = { kind, left: Math.max(0, Math.round(left)), used: 0 };
      },
    },
    act: {
      spec: ['number?', 'bool?'],
      fn(ctx, n = 1, midday = false) {
        spendActions(ctx, n, midday);
      },
    },
    end_phase: { spec: [], fn: (ctx) => { sysOf(ctx).phase = null; } },
    feed: {
      spec: [FEEDS],
      fn(ctx, kind) {
        const s = sysOf(ctx);
        const f = rule(ctx, `feeding.${kind}`, DEFAULT_FEEDING[kind]);
        bump(ctx, 'hunger', f.hunger ?? 0);
        bump(ctx, 'humanity', f.humanity ?? 0);
        s.diet[kind] = (s.diet[kind] ?? 0) + 1;
        s.recent = [...s.recent.slice(-4), kind];
        s.unfed = 0;
        if (f.kill) s.tally.kills += 1;
      },
    },
    power: {
      spec: [POWERS],
      fn(ctx, size) {
        const base = rule(ctx, `power.${size}`, { minor: 4, major: 10, great: 20 }[size]);
        // Older abilities cost more; the extra grows slowly with age tier.
        bump(ctx, 'hunger', base + Math.floor(Math.max(0, stat(ctx, 'age') - 1) / 2));
      },
    },
    kill: {
      spec: [KILLS, 'number?'],
      fn(ctx, kind, n = 1) {
        const s = sysOf(ctx);
        if (kind === 'human') s.tally.kills += n;
        else s.tally.vampireKills += n;
      },
    },
    witness: { spec: ['number?'], fn: (ctx, n = 1) => { sysOf(ctx).tally.witnesses += n; } },
    raid: {
      spec: [],
      fn(ctx) {
        const s = sysOf(ctx);
        const b = ctx.state.book;
        s.raids[b] = (s.raids[b] ?? 0) + 1;
        const over = s.raids[b] - rule(ctx, 'raids.alarmAt', 3) + 1;
        if (over > 0) { bump(ctx, 'secrecy', -rule(ctx, 'raids.secrecyCost', 5)); bump(ctx, 'standing', -rule(ctx, 'raids.standingCost', 3)); }
      },
    },
  },
};

/** Extra hunger for acting at midday: strong in Rome, gone by New York. */
export function sunHunger(ctx) {
  const list = rule(ctx, 'phases.sunHunger', [6, 5, 4, 3, 2, 1, 0]);
  return list[Math.min(list.length, bookNumber(ctx)) - 1] ?? 0;
}

export function animalDiet(s) {
  const r = s.recent ?? [];
  return r.length > 0 && r.filter((k) => k === 'animal').length * 2 > r.length;
}

/** End of chapter: hunger rises, witnesses and kills cost Secrecy and Humanity, quiet chapters let rumors fade. */
export function restLife(ctx, report) {
  const s = sysOf(ctx);
  const t = s.tally;
  bump(ctx, 'hunger', rule(ctx, 'rest.hunger', 8));
  const secrecyLoss = t.witnesses * rule(ctx, 'rest.witnessSecrecy', 3) + t.kills * rule(ctx, 'rest.killSecrecy', 2);
  if (secrecyLoss) bump(ctx, 'secrecy', -secrecyLoss);
  else bump(ctx, 'secrecy', rule(ctx, 'rest.quietSecrecy', 2));
  if (t.kills) bump(ctx, 'humanity', -t.kills * rule(ctx, 'rest.killHumanity', 3));
  report.kills = t.kills;
  report.witnesses = t.witnesses;
  s.tally = { kills: 0, witnesses: 0, vampireKills: 0 };
  s.phase = null;
}
