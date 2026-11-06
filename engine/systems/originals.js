// The six originals (content/originals.json): asleep, awake, sealed, or for the wanderers
// hidden and revealed; who woke them, what the hero chose, and whether he knows their true name.
//
//   $ do awaken("general", "hero")             bloodline, hero or faction
//   $ do original_fate("general", "bargain")   what the hero chose for one he woke:
//                                              loosed, bargain, drunk, sealed (sealed puts them under cedar again)
//   $ do reveal("merchant")                    a wanderer is revealed
//   $ do original_fate("merchant", "allied")   for a revealed wanderer: kept_secret, exposed, allied
//   $ do learn_name("merchant")                the hero learns their true name
//   original("general")                        asleep, awake, sealed, hidden, revealed
//   original("general", "by")                  who woke them ("" if still asleep)
//   original("general", "fate")                the hero's choice ("" if none yet)
//   original("general", "name")                true if he knows their true name
//   awake_count()                              originals awake or revealed and not sealed (moves the god's clock)
//   allied_count()                             originals bound to him by bargain, debt or open alliance

import { sysOf, cat, logDecision } from './core.js';
import { EngineError } from '../util.js';

export const WOKEN_BY = ['bloodline', 'hero', 'faction'];
export const WAKE_FATES = ['loosed', 'bargain', 'drunk', 'sealed'];
export const WANDER_FATES = ['kept_secret', 'exposed', 'allied'];
export const ORIGINAL_FIELDS = ['state', 'by', 'fate', 'name'];
const ALLIED = new Set(['loosed', 'bargain', 'allied']);

/** The tracked record for an original, created from its catalog entry. */
export function originalRecord(s, id, def) {
  s.originals[id] ??= { state: def.kind === 'wandering' ? 'hidden' : 'asleep', by: '', fate: '', name: false, book: '' };
  return s.originals[id];
}

function rec(ctx, id) {
  return originalRecord(sysOf(ctx), id, cat(ctx).originals[id]);
}

export const originals = {
  fns: {
    original: {
      spec: ['original', { opt: true, kind: ORIGINAL_FIELDS }],
      fn(ctx, id, field = 'state') {
        const r = rec(ctx, id);
        return r[field];
      },
    },
    awake_count: {
      spec: [],
      fn(ctx) {
        let n = 0;
        for (const id of Object.keys(cat(ctx).originals)) if (['awake', 'revealed'].includes(rec(ctx, id).state)) n += 1;
        return n;
      },
    },
    allied_count: {
      spec: [],
      fn(ctx) {
        let n = 0;
        for (const id of Object.keys(cat(ctx).originals)) if (ALLIED.has(rec(ctx, id).fate)) n += 1;
        return n;
      },
    },
  },
  commands: {
    awaken: {
      spec: ['original', WOKEN_BY],
      fn(ctx, id, by) {
        const def = cat(ctx).originals[id];
        if (def.kind === 'wandering') throw new EngineError(`$ do awaken("${id}"): the ${def.title} is a wanderer, not asleep (use reveal)`);
        const r = rec(ctx, id);
        r.state = 'awake';
        r.by = by;
        r.book = ctx.state.book;
        logDecision(ctx, `original.${id}.by`, by);
      },
    },
    reveal: {
      spec: ['original'],
      fn(ctx, id) {
        const def = cat(ctx).originals[id];
        if (def.kind !== 'wandering') throw new EngineError(`$ do reveal("${id}"): the ${def.title} sleeps (use awaken)`);
        const r = rec(ctx, id);
        r.state = 'revealed';
        r.book = ctx.state.book;
        logDecision(ctx, `original.${id}.by`, 'revealed');
      },
    },
    original_fate: {
      spec: ['original', [...WAKE_FATES, ...WANDER_FATES]],
      fn(ctx, id, fate) {
        const def = cat(ctx).originals[id];
        const r = rec(ctx, id);
        const allowed = def.kind === 'wandering' ? WANDER_FATES : WAKE_FATES;
        if (!allowed.includes(fate)) throw new EngineError(`$ do original_fate("${id}", "${fate}"): use ${allowed.join(', ')} for the ${def.title}`);
        if (def.kind !== 'wandering' && r.state !== 'awake' && fate !== 'sealed') throw new EngineError(`$ do original_fate("${id}"): the ${def.title} is not awake`);
        r.fate = fate;
        if (fate === 'sealed') r.state = 'sealed';
        logDecision(ctx, `original.${id}`, fate);
      },
    },
    learn_name: { spec: ['original'], fn: (ctx, id) => { rec(ctx, id).name = true; } },
  },
};

/** Quick start: originals of skipped books take their default history from the catalog. */
export function quickOriginals(ctx, bookIds) {
  const s = sysOf(ctx);
  for (const [id, def] of Object.entries(cat(ctx).originals)) {
    if (!bookIds.includes(def.book) || !def.quick) continue;
    Object.assign(originalRecord(s, id, def), { ...def.quick, book: def.book });
    if (def.quick.fate) ctx.state.decisions.push({ name: `original.${id}`, value: def.quick.fate, book: def.book, chapter: null, quick: true });
  }
}
