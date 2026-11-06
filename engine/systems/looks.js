// Appearance: the words the story uses for the hero's chosen look (session 5).
//
//   {look("height")}        tall            {look("hairstyle")}   worn long
//   {look("mark")}          a pale scar from the arena down your ribs ("" if none)
//   marked()                true when the hero has a mark
//   {look_sentence()}       the whole description as one paragraph (second person)
//
// Fields: height, build, age, hair, hairstyle, eyes, skin, mark. The look is chosen at character
// creation and stored as hero.look.<field>; a hero made before creation existed reads as "".

import { cat } from './core.js';
import { LOOK_FIELDS, lookFromVars, lookText, describeLook } from '../looks.js';

const looksOf = (ctx) => cat(ctx).looks;

export const looks = {
  fns: {
    look: {
      spec: [LOOK_FIELDS],
      fn: (ctx, field) => lookText(looksOf(ctx), lookFromVars(looksOf(ctx), ctx.state.vars), field),
    },
    marked: {
      spec: [],
      fn(ctx) {
        const l = lookFromVars(looksOf(ctx), ctx.state.vars);
        return Boolean(lookText(looksOf(ctx), l, 'mark'));
      },
    },
    look_sentence: {
      spec: [],
      fn: (ctx) => describeLook(looksOf(ctx), lookFromVars(looksOf(ctx), ctx.state.vars)),
    },
  },
  commands: {},
};
