// Gifts: what the hero and each member of the coven can do that others cannot.
//
//   has_gift("daywalking")                   the hero has this gift
//   member_has_gift("fiammetta", "charm")    a member has this gift
//   gift_holder("charm")                    the id of an active coven member who has the gift, or ""
//   gift_count("fiammetta")                  how many gifts a member has
//   $ do grant_gift("hero", "shadows")       a story moment gives (or teaches) a gift; "hero" or a circle member
//
// The hero is of the sixth line: he walks in daylight, and from Book Two on his blood makes
// stronger fledglings. A member's gifts come from their line and their role, and the story can add more.
// Gifts are shown in the Coven tab and are meant to be called on in scenes (?if member_has_gift(...)).

import { sysOf, bookNumber } from './core.js';
import { EngineError, fnv1a } from '../util.js';

export const GIFTS = {
  daywalking: { name: 'Walks in daylight', text: 'The sun does not burn them. The old blood of the sixth line carries it, and it is the rarest thing in the world.', hero: 'The sun stings you like a fever and weakens you, but it does not burn. It is the old blood of the sixth line, and the rarest thing in the world.' },
  old_blood: { name: 'The old blood', text: 'Those turned by the sixth blood are stronger than other fledglings, and keep their strength longer.' },
  shadows: { name: 'Shadows', text: 'They can slip a face out of memory, and go unremarked where others are seen.' },
  merchants_eye: { name: "A merchant's eye", text: 'They read a ledger and a man in the same glance, and know what a thing will fetch and who is lying about it.' },
  strength: { name: 'Strength', text: 'Brute strength and a soldier\'s sense for a fight, in the line of the General.' },
  charm: { name: 'Charm', text: 'A voice and a look that people want to agree with, in the line of the Priestess.' },
  memory: { name: 'Memory', text: 'They forget nothing they have read or heard, and can find the secret in a pile of papers.' },
  healing: { name: 'Healing', text: 'They know the body and the blood, and can mend what others would bury.' },
};
export const GIFT_IDS = Object.keys(GIFTS);

const LINE_GIFTS = {
  merchant: ['shadows', 'merchants_eye'],
  general: ['strength'],
  priestess: ['charm'],
  scribe: ['memory'],
  physician: ['healing'],
  sixth: ['old_blood'],
};

const ROLE_GIFTS = {
  business: 'merchants_eye', guard: 'strength', watch: 'memory', scout: 'shadows', negotiate: 'charm', hunt: 'strength', retrieve: 'shadows', heal: 'healing',
};

// Those the hero turns carry the old blood, and a gift of their own: named for the ones the story knows, a steady pick for anyone else.
const NAMED_GIFTS = { fiammetta: 'merchants_eye', thibault: 'strength', hanno: 'memory', tiro: 'merchants_eye' };
const OWN_GIFTS = ['strength', 'charm', 'shadows', 'merchants_eye', 'memory', 'healing'];
const ownGift = (id) => NAMED_GIFTS[id] ?? OWN_GIFTS[parseInt(fnv1a(id), 16) % OWN_GIFTS.length];

/** Every gift a circle member has: from their line, from their role, from the sixth line's daylight, and any the story gave. */
export function memberGifts(m) {
  if (!m || m.kind === 'keeper') return [];
  const out = [...(LINE_GIFTS[m.line] ?? [])];
  if (m.sire === 'hero') out.push('old_blood', ownGift(m.id));
  if (m.sire === 'hero' && ROLE_GIFTS[m.role]) out.push(ROLE_GIFTS[m.role]);
  if (m.daywalk) out.push('daywalking');
  out.push(...(m.gifts ?? []));
  return [...new Set(out)];
}

/** The hero's gifts. */
export function heroGifts(ctx) {
  const out = ['daywalking'];
  if (bookNumber(ctx) >= 2) out.push('old_blood');
  out.push(...(sysOf(ctx).gifts ?? []));
  return [...new Set(out)];
}

export const gifts = {
  fns: {
    has_gift: { spec: [GIFT_IDS], fn: (ctx, g) => heroGifts(ctx).includes(g) },
    member_has_gift: { spec: ['person', GIFT_IDS], fn: (ctx, id, g) => memberGifts(sysOf(ctx).circle[id]).includes(g) },
    gift_holder: {
      spec: [GIFT_IDS],
      fn(ctx, g) {
        const hit = Object.values(sysOf(ctx).circle).find((m) => m.status === 'active' && m.kind !== 'keeper' && memberGifts(m).includes(g));
        return hit ? hit.id : '';
      },
    },
    gift_count: { spec: ['person'], fn: (ctx, id) => memberGifts(sysOf(ctx).circle[id]).length },
  },
  commands: {
    grant_gift: {
      spec: ['text', GIFT_IDS],
      fn(ctx, who, gift) {
        const s = sysOf(ctx);
        if (who === 'hero') {
          s.gifts ??= [];
          if (!s.gifts.includes(gift)) s.gifts.push(gift);
          return;
        }
        const m = s.circle[who];
        if (!m) throw new EngineError(`$ do grant_gift("${who}", "${gift}"): "${who}" is not in the circle (use "hero" or a member)`);
        m.gifts ??= [];
        if (!m.gifts.includes(gift)) m.gifts.push(gift);
      },
    },
  },
};
