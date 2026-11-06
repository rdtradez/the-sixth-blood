// Character appearance (session 5): the options on the creation screen, suggestions from origin
// and mortal role, validation, and the words the story uses. Pure functions over the catalog
// built from content/looks.json. Nothing here touches the DOM, storage or the game state.

export const LOOK_FIELDS = ['height', 'build', 'age', 'hair', 'hairstyle', 'eyes', 'skin', 'mark'];
export const LOOK_PREFIX = 'hero.look.';

/** The catalog used when content/looks.json is absent (bare tests). */
export const EMPTY_LOOKS = { order: [], fields: {}, skinByOrigin: {}, suggest: { origin: {}, role: {} } };

/** Normalize content/looks.json. Options keep their order; each gets an id, label and text. */
export function lookCatalog(file) {
  if (!file || !file.fields) return EMPTY_LOOKS;
  const fields = {};
  for (const [id, f] of Object.entries(file.fields)) {
    fields[id] = {
      id,
      label: f.label ?? id,
      options: (f.options ?? []).map((o) => ({ id: o.id, label: o.label ?? o.id, text: o.text ?? '', sentence: o.sentence })),
    };
  }
  return {
    order: (file.order ?? Object.keys(fields)).filter((id) => fields[id]),
    fields,
    skinByOrigin: file.skin_by_origin ?? {},
    suggest: { origin: file.suggest?.origin ?? {}, role: file.suggest?.role ?? {} },
  };
}

const option = (cat, field, id) => cat.fields[field]?.options.find((o) => o.id === id) ?? null;

/** The option ids offered for a field. Skin tones depend on the origin. */
export function optionIds(cat, field, origin) {
  const all = (cat.fields[field]?.options ?? []).map((o) => o.id);
  if (field !== 'skin') return all;
  const allowed = cat.skinByOrigin[origin];
  return allowed?.length ? allowed.filter((id) => all.includes(id)) : all;
}

/** Small seeded generator (mulberry32) so quick create can be repeated in tests. */
export function seededRandom(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Suggested ids for a field, most fitting first, limited to ids that really exist and are offered. */
function suggested(cat, field, { origin, role }) {
  const ok = new Set(optionIds(cat, field, origin));
  const out = [];
  const add = (list) => { for (const id of list ?? []) if (ok.has(id) && !out.includes(id)) out.push(id); };
  if (field === 'skin') add(optionIds(cat, 'skin', origin));
  else if (field === 'build' || field === 'height') {
    add(cat.suggest.role[role]?.[field]);
    add(cat.suggest.origin[origin]?.[field]);
  } else if (field === 'mark') {
    add(cat.suggest.role[role]?.mark);
    add(cat.suggest.origin[origin]?.mark);
  } else {
    add(cat.suggest.origin[origin]?.[field]);
  }
  if (!out.length) add([...ok]);
  return out;
}

/**
 * A look that fits an origin and mortal role: { height, build, age, hair, hairstyle, eyes, skin, mark }.
 * Without `random` the most fitting pick is used for every field (the same look every time).
 * With a generator in [0, 1), each field picks among its fitting options (quick create).
 */
export function suggestLook(cat, hero = {}, random = null) {
  const pick = (list, fallback) => {
    if (!list.length) return fallback;
    return random ? list[Math.floor(random() * list.length)] : list[0];
  };
  const look = {};
  for (const field of cat.order) {
    if (field === 'age') {
      const ids = optionIds(cat, 'age');
      const r = random ? random() : 0.5;
      look.age = ids.includes('young') && r < 0.35 ? 'young' : ids.includes('older') && r >= 0.85 ? 'older' : ids.includes('prime') ? 'prime' : ids[0];
    } else if (field === 'mark') {
      const list = suggested(cat, 'mark', hero);
      if (!random) {
        look.mark = list[0] ?? 'none';
      } else {
        // A role's own mark (an arena scar for a gladiator) is likely; otherwise anything fitting, or none.
        const own = (cat.suggest.role[hero.role]?.mark ?? []).filter((id) => id !== 'none' && list.includes(id));
        const any = list.includes('none') ? list : [...list, 'none'];
        look.mark = own.length && random() < 0.75 ? pick(own, 'none') : pick(any, 'none');
      }
    } else {
      look[field] = pick(suggested(cat, field, hero), '');
    }
  }
  if (random && look.age === 'older' && option(cat, 'hair', 'grey') && random() < 0.5) look.hair = 'grey';
  return look;
}

/** A complete valid look: missing or unknown values are replaced by the fitting default. */
export function normalizeLook(cat, hero = {}, look = {}) {
  const base = suggestLook(cat, hero);
  const out = {};
  for (const field of cat.order) {
    const want = look?.[field];
    out[field] = optionIds(cat, field, hero.origin).includes(want) ? want : base[field];
  }
  return out;
}

/** hero.look.* variables for a look. */
export function lookVars(look) {
  const vars = {};
  for (const [field, id] of Object.entries(look)) vars[LOOK_PREFIX + field] = id;
  return vars;
}

/** The look stored in a variables object (fields that were never set are left out). */
export function lookFromVars(cat, vars = {}) {
  const look = {};
  for (const field of cat.order) {
    const v = vars[LOOK_PREFIX + field];
    if (typeof v === 'string' && option(cat, field, v)) look[field] = v;
  }
  return look;
}

/** The story's words for one field of a look: "tall", "worn long", "a pale scar from the arena down your ribs". */
export function lookText(cat, look, field) {
  return option(cat, field, look?.[field])?.text ?? '';
}

/** A paragraph describing the hero, in the second person: height, frame, age, hair, eyes, skin, mark. */
export function describeLook(cat, look) {
  if (!look || !Object.keys(look).length) return '';
  const t = (f) => lookText(cat, look, f);
  const parts = [];
  if (t('height') || t('build')) {
    parts.push(`You are ${[t('height'), t('build') && `with ${t('build')}`].filter(Boolean).join(', ')}.`);
  }
  const age = option(cat, 'age', look.age);
  if (age?.sentence) parts.push(age.sentence);
  if (t('hair')) parts.push(`Your hair is ${t('hair')}${t('hairstyle') ? `, ${t('hairstyle')}` : ''}.`);
  if (t('eyes')) parts.push(`Your eyes are ${t('eyes')}.`);
  if (t('skin')) parts.push(`Your skin is ${t('skin')}.`);
  if (t('mark')) parts.push(`You carry ${t('mark')}.`);
  return parts.join(' ');
}
