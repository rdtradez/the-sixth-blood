// Game state: one plain JSON object. Everything the game needs to resume lives here.

export const SCHEMA = 1; // bump when the shape of state changes, and add a schema migration
export const ENGINE_VERSION = '0.1.0';

/**
 * state = {
 *   book, chapter, chapterVersion,
 *   pos:   { scene, pc, fp, anchor }   where the story is waiting (set at every wait point)
 *   stack: [{ scene, pc, fp }]         return addresses for ~> calls
 *   vars:  { name: value }             flags, stats, names, anything a script sets
 *   once:  { key: true }               [once] choices already taken
 *   visited: { "chapter.scene": n }    scene entry counts
 *   rng:   uint32                      seeded random state
 *   frame: { wait, paragraphs, choices?, next? }   what the player is looking at
 * }
 */
export function createState({ book = null, vars = {}, seed } = {}) {
  return {
    book,
    chapter: null,
    chapterVersion: null,
    pos: null,
    stack: [],
    vars: { ...vars },
    once: {},
    visited: {},
    rng: (seed ?? Math.floor(Math.random() * 4294967296)) >>> 0,
    frame: null,
  };
}

/** Give every declared stat its starting value if the state does not have it yet. */
export function applyStatDefaults(state, defs) {
  for (const [name, def] of Object.entries(defs)) {
    if (!Object.prototype.hasOwnProperty.call(state.vars, name)) state.vars[name] = def.start ?? 0;
  }
}

/**
 * Upgrades for the shape of state, keyed by the version they upgrade FROM.
 * When SCHEMA goes from 1 to 2, add: SCHEMA_MIGRATIONS[1] = (state) => { ...; return state; }
 */
export const SCHEMA_MIGRATIONS = {};

/**
 * Set a variable, clamping declared stats to their range. A stat definition named
 * "loyalty.*" applies to every variable starting with "loyalty." (per person stats).
 */
export function assign(state, defs, name, value) {
  const wildcard = `${name.split('.')[0]}.*`;
  const def = Object.hasOwn(defs, name) ? defs[name] : Object.hasOwn(defs, wildcard) ? defs[wildcard] : undefined;
  if (def && typeof value === 'number') {
    if (def.int) value = Math.round(value);
    if (def.min !== undefined) value = Math.max(def.min, value);
    if (def.max !== undefined) value = Math.min(def.max, value);
  }
  state.vars[name] = value;
}
