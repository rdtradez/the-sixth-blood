// Game state: one plain JSON object. Everything the game needs to resume lives here.

import { createSys } from './systems/sys-state.js';

export const SCHEMA = 4; // bump when the shape of state changes, and add a schema migration
export const ENGINE_VERSION = '0.4.0';

/**
 * state = {
 *   book, chapter, chapterVersion,
 *   pos:   { scene, pc, fp, anchor }   where the story is waiting (set at every wait point)
 *   stack: [{ scene, pc, fp }]         return addresses for ~> calls
 *   vars:  { name: value }             flags, stats, names, anything a script sets
 *   once:  { key: true }               [once] choices already taken
 *   visited: { "chapter.scene": n }    scene entry counts
 *   rng:   uint32                      seeded random state
 *   decisions: [{ name, value, book, chapter }]   major decisions from the flag registry, latest last
 *   journal:   [{ book, chapter, title, text }]   entries for the Previously screen
 *   booksDone: [bookId]                           books this playthrough has finished, in order
 *   sys:   { ... }                                the game systems (engine/systems/sys-state.js)
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
    decisions: [],
    journal: [],
    booksDone: [],
    sys: createSys(),
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
export const SCHEMA_MIGRATIONS = {
  // 1 -> 2 (session 2): decision log, journal, and the list of finished books.
  1(state) {
    state.decisions ??= [];
    state.journal ??= [];
    state.booksDone ??= [];
    if (state.frame?.wait === 'book_end' && state.book && !state.booksDone.includes(state.book)) state.booksDone.push(state.book);
    return state;
  },
  // 2 -> 3 (session 3): the game systems (phases, Collis, Collesanto, coven, originals, sleep...).
  2(state) {
    state.sys ??= createSys();
    return state;
  },
  // 3 -> 4 (session 4): the codex and the family tree (sys.lore).
  3(state) {
    if (state.sys) state.sys.lore ??= { codex: {}, kin: {} };
    return state;
  },
};

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
