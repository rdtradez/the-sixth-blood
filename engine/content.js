// Story systems that read game content: the flag registry, stats in story voice,
// pronouns and names, era aliases, and origin variants.
//
// Content comes from content/flags.json, voice.json, people.json and origins.json.
// makeContent() turns those files into one normalized object. The functions below are
// registered in every chapter (like the builtins), and read it through ctx.content.

import { EngineError } from './util.js';
import { toNum } from './expr.js';

export const GENDERS = ['m', 'f', 'x'];

// Pronoun keys are the "they" words, which are never ambiguous ("his" could be "her" or "hers").
// "are", "were", "have", "s" and "es" handle verb agreement: "{They} {are} here", "{they} walk{s}".
export const PRONOUNS = {
  m: { they: 'he', them: 'him', their: 'his', theirs: 'his', themself: 'himself', are: 'is', were: 'was', have: 'has', s: 's', es: 'es' },
  f: { they: 'she', them: 'her', their: 'her', theirs: 'hers', themself: 'herself', are: 'is', were: 'was', have: 'has', s: 's', es: 'es' },
  x: { they: 'they', them: 'them', their: 'their', theirs: 'theirs', themself: 'themself', are: 'are', were: 'were', have: 'have', s: '', es: '' },
};
export const PRONOUN_KEYS = new Set(Object.keys(PRONOUNS.x));
/** Words usable as {word} or {person.word} in text. */
export const SHORTHAND_KEYS = new Set([...PRONOUN_KEYS, 'name', 'alias', 'surname']);
export const PERSON_FIELDS = ['name', 'gender', 'alias', 'surname'];
export const VARIANT_GROUPS = ['origin', 'role', 'path'];
export const FLAG_KINDS = ['flag', 'enum', 'number', 'text'];

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---- Normalizing content files ------------------------------------------------------------

/** Build the content object. Every input is optional, so tests can pass only what they need. */
export function makeContent({ flags = {}, voice = {}, people = {}, origins = {}, stats = {}, manifest = null } = {}) {
  const groups = {};
  for (const g of VARIANT_GROUPS) {
    const list = origins[`${g}s`] ?? (g === 'origin' ? origins.origins : undefined) ?? [];
    groups[g] = list.map((o) => (typeof o === 'string' ? { id: o, label: o } : o));
  }
  const variantIds = {};
  for (const g of VARIANT_GROUPS) variantIds[g] = new Set(groups[g].map((o) => o.id));
  const allTags = new Set(VARIANT_GROUPS.flatMap((g) => [...variantIds[g]]));

  const rawFlags = flags.flags ?? flags;
  const entries = {};
  const wild = [];
  for (const [name, def0] of Object.entries(rawFlags)) {
    if (name === 'note') continue;
    const def = { kind: 'flag', ...def0, name };
    // "@origins", "@roles", "@paths": the values come from origins.json.
    if (typeof def.values === 'string' && def.values.startsWith('@')) {
      const g = def.values.slice(1).replace(/s$/, '');
      def.values = groups[g] ? groups[g].map((o) => o.id) : [];
    }
    if (name.endsWith('.*')) wild.push({ prefix: name.slice(0, -1), def });
    else entries[name] = def;
  }

  return {
    flags: {
      entries,
      wild,
      lookup(name) {
        if (Object.hasOwn(entries, name)) return entries[name];
        for (const w of wild) if (name.startsWith(w.prefix)) return w.def;
        return null;
      },
    },
    voice: voice.stats ?? voice,
    people: people.people ?? people,
    origins: groups,
    variantIds,
    allTags,
    stats,
    manifest,
  };
}

export const EMPTY_CONTENT = makeContent();

/** The declared stat or wildcard stat definition for a name, if any. */
export function statDef(stats, name) {
  if (Object.hasOwn(stats, name)) return stats[name];
  const w = `${name.split('.')[0]}.*`;
  return Object.hasOwn(stats, w) ? stats[w] : null;
}

/** The voice definition for a stat (exact name first, then "loyalty.*" style). */
export function voiceDef(voice, name) {
  if (Object.hasOwn(voice, name)) return voice[name];
  const w = `${String(name).split('.')[0]}.*`;
  return Object.hasOwn(voice, w) ? voice[w] : null;
}

/** Pick the band a value falls in. Bands are ordered; each covers values up to and including "upTo". */
export function bandFor(def, value) {
  const bands = def.bands ?? [];
  for (const b of bands) if (b.upTo === undefined || b.upTo === null || value <= b.upTo) return b;
  return bands[bands.length - 1];
}

// ---- People --------------------------------------------------------------------------------

function genderOf(ctx, who, depth = 0) {
  const v = ctx.vars[`${who}.gender`];
  if (GENDERS.includes(v)) return v;
  const p = ctx.content.people[who];
  const g = p?.gender;
  if (typeof g === 'string' && g.startsWith('opposite:') && depth < 4) {
    const other = genderOf(ctx, g.slice(9), depth + 1);
    return other === 'm' ? 'f' : other === 'f' ? 'm' : 'x';
  }
  return GENDERS.includes(g) ? g : 'x';
}

function nameOf(ctx, who) {
  const v = ctx.vars[`${who}.name`];
  if (typeof v === 'string' && v) return v;
  const p = ctx.content.people[who];
  if (p?.names) return p.names[genderOf(ctx, who)] ?? p.names.x ?? p.names.m ?? capFirst(who);
  return p?.name ?? capFirst(who);
}

function byBook(ctx, table) {
  if (!table) return undefined;
  if (typeof table === 'string') return table;
  return table[ctx.state?.book] ?? table.default;
}

function variantValue(ctx, group) {
  const v = ctx.vars[`hero.${group}`];
  return typeof v === 'string' ? v : '';
}

// ---- Functions available in every chapter -------------------------------------------------

export const CONTENT_FNS = {
  /** Story voice text for a stat: voice("hunger"), voice("hunger", "short"). */
  voice(ctx, stat, form = 'say') {
    const name = String(stat);
    const def = voiceDef(ctx.content.voice, name);
    if (!def) throw new EngineError(`no story voice for "${name}" (add it to content/voice.json)`);
    const sd = statDef(ctx.content.stats, name);
    const raw = Object.hasOwn(ctx.vars, name) ? ctx.vars[name] : sd?.start ?? sd?.min ?? 0;
    const band = bandFor(def, toNum(raw));
    if (!band) throw new EngineError(`story voice for "${name}" has no bands`);
    const text = band[form] ?? band.say;
    if (text === undefined) throw new EngineError(`story voice for "${name}" has no "${form}" text in band "${band.id}"`);
    return text;
  },
  /** The id of the band a stat is in, for conditions: ?if band("hunger") == "starving" */
  band(ctx, stat) {
    const name = String(stat);
    const def = voiceDef(ctx.content.voice, name);
    if (!def) throw new EngineError(`no story voice for "${name}" (add it to content/voice.json)`);
    const sd = statDef(ctx.content.stats, name);
    const raw = Object.hasOwn(ctx.vars, name) ? ctx.vars[name] : sd?.start ?? sd?.min ?? 0;
    return bandFor(def, toNum(raw))?.id ?? '';
  },
  /** A pronoun or agreement word for a person: pro("hero", "their"). Text shorthand: {their}, {livia.their}. */
  pro(ctx, who, key) {
    const k = String(key);
    if (!PRONOUN_KEYS.has(k)) throw new EngineError(`unknown pronoun word "${k}"`);
    return PRONOUNS[genderOf(ctx, String(who))][k];
  },
  /** The hero's gender word: g("man", "woman", "person"). The third falls back to the first. */
  g(ctx, m, f, x) {
    const gen = genderOf(ctx, 'hero');
    return gen === 'f' ? f : gen === 'x' ? (x ?? m) : m;
  },
  /** Gender word for anyone: pg("livia", "husband", "wife", "spouse"). */
  pg(ctx, who, m, f, x) {
    const gen = genderOf(ctx, String(who));
    return gen === 'f' ? f : gen === 'x' ? (x ?? m) : m;
  },
  gender(ctx, who = 'hero') { return genderOf(ctx, String(who)); },
  name(ctx, who = 'hero') { return nameOf(ctx, String(who)); },
  /** The name a person goes by in this book's era (the hero's business alias). Falls back to their name. */
  alias(ctx, who = 'hero') {
    const id = String(who);
    const v = ctx.vars[`${id}.alias`];
    if (typeof v === 'string' && v) return v;
    return byBook(ctx, ctx.content.people[id]?.aliases) ?? nameOf(ctx, id);
  },
  /** The family name in this book's era (Valerius, Valerio, Valère, Valer). */
  surname(ctx, who = 'hero') {
    const id = String(who);
    const v = ctx.vars[`${id}.surname`];
    if (typeof v === 'string' && v) return v;
    return byBook(ctx, ctx.content.people[id]?.surnames) ?? '';
  },
  /** True if the hero's origin, mortal role or arrival path is any of the tags. Shorthand: [briton gaul]. */
  variant(ctx, ...tags) {
    const mine = VARIANT_GROUPS.map((g) => variantValue(ctx, g)).filter(Boolean);
    return tags.some((t) => mine.includes(String(t)));
  },
};

export const CONTENT_FN_NAMES = Object.keys(CONTENT_FNS);

/** Commands available in every chapter ($ do name(...)). */
export const CONTENT_COMMANDS = {
  /** Add an entry to the journal shown on the Previously screen. Session 3 builds the Velati journal on this. */
  journal(ctx, text, title) {
    const st = ctx.state;
    st.journal ??= [];
    st.journal.push({ book: st.book, chapter: st.chapter, title: title ?? null, text: String(text) });
  },
};

export const CONTENT_COMMAND_NAMES = Object.keys(CONTENT_COMMANDS);

// ---- Flag registry at play time ---------------------------------------------------------------

/**
 * Called whenever a script sets a variable or flag. Records major decisions in
 * state.decisions (latest value per name, most recent last) and warns about
 * enum values the registry does not allow.
 */
export function recordSet(ctx, name, value, warn) {
  const def = ctx.content.flags.lookup(name);
  if (!def) return;
  if (def.kind === 'enum' && value !== undefined && Array.isArray(def.values) && !def.values.includes(value)) {
    warn?.(`"${name}" was set to "${value}", which is not one of its registered values (${def.values.join(', ')})`);
  }
  if (def.major) {
    const st = ctx.state;
    st.decisions ??= [];
    const i = st.decisions.findIndex((d) => d.name === name);
    if (i >= 0) st.decisions.splice(i, 1);
    if (value !== undefined) st.decisions.push({ name, value, book: st.book, chapter: st.chapter });
  }
}
