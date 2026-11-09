// Lore: the codex (entries unlocked as the hero discovers them) and the Valerius family tree.
//
//   $ do discover("bloodlines")      unlock a codex entry (content/codex.json); safe to repeat
//   discovered("bloodlines")         true once unlocked, whether by discover() or because the
//                                    entry is tied to an original or a person the hero has met
//   codex_count()                    entries unlocked so far
//   $ do chart("rome.warehouse")  add a place to a city map (engine/maps.js); safe to repeat
//   charted("rome.warehouse")     true once added
//   $ do kin("aelia")                the family tree learns of a relative (content/family.json)
//   $ do kin("aelia", "dead")        and their status: living, dead or unknown
//   kin_known("aelia"), kin_status("aelia") ("" if not known yet)
//
// Entries may carry `original: "<id>"` or `person: "<id>"`, which unlocks them automatically
// when the hero learns of that original or meets that person.

import { sysOf, cat, opt } from './core.js';
import { siteKnown } from '../maps.js';
import { EngineError } from '../util.js';

export const KIN_STATUS = ['living', 'dead', 'unknown'];

/** The lore part of the systems state, created on first use. */
export function loreOf(s) {
  s.lore ??= { codex: {}, kin: {} };
  s.lore.codex ??= {};
  s.lore.kin ??= {};
  s.lore.sites ??= {};
  return s.lore;
}

/** True when an original is known to the hero (anything past its starting state). */
export function originalKnown(s, id) {
  const r = s.originals?.[id];
  return Boolean(r && r.state !== 'asleep' && r.state !== 'hidden');
}

/** Is this codex entry unlocked in this systems state? */
export function entryUnlocked(s, id, def) {
  if (Object.hasOwn(loreOf(s).codex, id)) return true;
  if (def?.original && originalKnown(s, def.original)) return true;
  if (def?.person && Object.hasOwn(s.people ?? {}, def.person)) return true;
  return false;
}

export const lore = {
  fns: {
    discovered: {
      spec: ['codex'],
      fn: (ctx, id) => entryUnlocked(sysOf(ctx), id, cat(ctx).codex[id]),
    },
    codex_count: {
      spec: [],
      fn(ctx) {
        const s = sysOf(ctx);
        return Object.entries(cat(ctx).codex).filter(([id, def]) => entryUnlocked(s, id, def)).length;
      },
    },
    charted: {
      spec: ['site'],
      fn: (ctx, ref) => Object.hasOwn(loreOf(sysOf(ctx)).sites, ref),
    },
    kin_known: { spec: ['kin'], fn: (ctx, id) => Object.hasOwn(loreOf(sysOf(ctx)).kin, id) },
    kin_status: { spec: ['kin'], fn: (ctx, id) => loreOf(sysOf(ctx)).kin[id]?.status ?? '' },
  },
  commands: {
    discover: {
      spec: ['codex'],
      fn(ctx, id) {
        const codex = loreOf(sysOf(ctx)).codex;
        codex[id] ??= { book: ctx.state.book, chapter: ctx.state.chapter };
      },
    },
    chart: {
      spec: ['site'],
      fn(ctx, ref) {
        if (!siteKnown(ref)) throw new EngineError(`unknown map site "${ref}" (see engine/maps.js)`);
        loreOf(sysOf(ctx)).sites[ref] ??= { book: ctx.state.book, chapter: ctx.state.chapter };
      },
    },
    kin: {
      spec: ['kin', opt(KIN_STATUS)],
      fn(ctx, id, status) {
        const kin = loreOf(sysOf(ctx)).kin;
        const mine = (kin[id] ??= { book: ctx.state.book, status: 'living' });
        if (status) mine.status = status;
      },
    },
  },
};

/** Quick start: entries and relatives marked `quick` for a skipped book are already known. */
export function quickLore(ctx, skippedBookIds) {
  const s = ctx.state.sys;
  const l = loreOf(s);
  const c = cat(ctx);
  for (const [id, def] of Object.entries(c.codex)) {
    if (def.quick && skippedBookIds.includes(def.book)) l.codex[id] ??= { book: def.book, chapter: null };
  }
  for (const [id, def] of Object.entries(c.kin)) {
    if (def.quick && skippedBookIds.includes(def.book)) l.kin[id] ??= { book: def.book, status: typeof def.quick === 'string' ? def.quick : 'living' };
  }
}
