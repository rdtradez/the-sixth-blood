// People and relationships: everyone met (for the People screen) and how each romance ended.
// The strength of a bond is the stat bond.<id>, written with voice("bond.<id>").
//
//   $ do meet("prisca")                 met("prisca") is true from now on
//   $ do fate("prisca", "dead")         alive, dead, turned, missing, gone; fate_of("prisca")
//   $ do romance("lucia")               courting; $ do romance("lucia", "together") when it deepens
//   $ do romance_end("lucia", "turned") turned, left_behind, lost, parted
//   romance_status("lucia")             "", courting, together, ended
//   romance_ending("lucia")             how it ended ("" while it lasts)
//   partner()                           the id of the current romance ("" if none)
//   romances_ended("turned")            how many past loves ended this way (Book Seven's returns)

import { sysOf, logDecision, opt } from './core.js';
import { EngineError } from '../util.js';

export const FATES = ['alive', 'dead', 'turned', 'missing', 'gone'];
export const ROMANCE_STATES = ['courting', 'together'];
export const ENDINGS = ['turned', 'left_behind', 'lost', 'parted'];

function person(s, id, book) {
  s.people[id] ??= { met: book, fate: 'alive' };
  return s.people[id];
}

export const bonds = {
  fns: {
    met: { spec: ['person'], fn: (ctx, id) => Object.hasOwn(sysOf(ctx).people, id) },
    fate_of: { spec: ['person'], fn: (ctx, id) => sysOf(ctx).people[id]?.fate ?? '' },
    romance_status: {
      spec: ['person'],
      fn(ctx, id) {
        const r = sysOf(ctx).romances[id];
        return !r ? '' : r.ending ? 'ended' : r.state;
      },
    },
    romance_ending: { spec: ['person'], fn: (ctx, id) => sysOf(ctx).romances[id]?.ending ?? '' },
    partner: {
      spec: [],
      fn(ctx) {
        const open = Object.entries(sysOf(ctx).romances).filter(([, r]) => !r.ending);
        open.sort((a, b) => (b[1].since ?? 0) - (a[1].since ?? 0));
        return open[0]?.[0] ?? '';
      },
    },
    romances_ended: { spec: [ENDINGS], fn: (ctx, how) => Object.values(sysOf(ctx).romances).filter((r) => r.ending === how).length },
  },
  commands: {
    meet: { spec: ['person'], fn: (ctx, id) => { person(sysOf(ctx), id, ctx.state.book); } },
    fate: {
      spec: ['person', FATES],
      fn(ctx, id, fate) {
        person(sysOf(ctx), id, ctx.state.book).fate = fate;
        logDecision(ctx, `fate.${id}`, fate);
      },
    },
    romance: {
      spec: ['person', opt(ROMANCE_STATES)],
      fn(ctx, id, state = 'courting') {
        const s = sysOf(ctx);
        person(s, id, ctx.state.book);
        const r = s.romances[id];
        if (r?.ending) throw new EngineError(`$ do romance("${id}"): that romance already ended (${r.ending})`);
        s.seq = (s.seq ?? 0) + 1;
        s.romances[id] = { state, book: r?.book ?? ctx.state.book, since: s.seq, ending: '' };
      },
    },
    romance_end: {
      spec: ['person', ENDINGS],
      fn(ctx, id, ending) {
        const s = sysOf(ctx);
        const r = s.romances[id];
        if (!r) throw new EngineError(`$ do romance_end("${id}"): no romance with them has begun`);
        r.ending = ending;
        r.endedIn = ctx.state.book;
        if (ending === 'turned') person(s, id, ctx.state.book).fate = 'turned';
        logDecision(ctx, `romance.${id}`, ending);
      },
    },
  },
};

