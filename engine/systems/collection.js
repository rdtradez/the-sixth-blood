// The Collis Collection: pieces gathered across the centuries for the New York museum
// (content/collection.json). Each piece is a flex and bait in Book Seven.
//
//   $ do obtain("gladius")          he (or a coven member on a retrieve mission) gains it
//   $ do lose("gladius")            stolen, destroyed, given away
//   $ do display("gladius")         put on show in the museum (Book Seven)
//   has_item("gladius"), displayed("gladius"), item_count(), displayed_count()

import { sysOf } from './core.js';
import { EngineError } from '../util.js';

export const collection = {
  fns: {
    has_item: { spec: ['item'], fn: (ctx, id) => Boolean(sysOf(ctx).items[id] && !sysOf(ctx).items[id].lost) },
    displayed: { spec: ['item'], fn: (ctx, id) => Boolean(sysOf(ctx).items[id]?.displayed) },
    item_count: { spec: [], fn: (ctx) => Object.values(sysOf(ctx).items).filter((i) => !i.lost).length },
    displayed_count: { spec: [], fn: (ctx) => Object.values(sysOf(ctx).items).filter((i) => i.displayed && !i.lost).length },
  },
  commands: {
    obtain: {
      spec: ['item'],
      fn(ctx, id) { sysOf(ctx).items[id] = { book: ctx.state.book, displayed: false, lost: false }; },
    },
    lose: {
      spec: ['item'],
      fn(ctx, id) {
        const i = sysOf(ctx).items[id];
        if (i) { i.lost = true; i.displayed = false; }
      },
    },
    display: {
      spec: ['item'],
      fn(ctx, id) {
        const i = sysOf(ctx).items[id];
        if (!i || i.lost) throw new EngineError(`$ do display("${id}"): he does not have it`);
        i.displayed = true;
      },
    },
  },
};
