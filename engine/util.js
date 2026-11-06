// Shared helpers and error types for the engine. No browser or Node APIs here.

/** A problem in a story script, with file and line so authors can find it. */
export class ScriptError extends Error {
  constructor(message, { file, line } = {}) {
    super(`${file ?? 'script'}${line ? ':' + line : ''}: ${message}`);
    this.name = 'ScriptError';
    this.file = file;
    this.line = line;
    this.detail = message;
  }
}

/** A problem found while a story is running (bad data, runaway loop, etc.). */
export class EngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EngineError';
  }
}

/** A save problem. `code` is stable so the UI can show a friendly message. */
export class SaveError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
  }
}

/** FNV-1a 32 bit hash as 8 hex characters. Used for fingerprints and checksums. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Seeded random number in [0, 1). The seed lives in state.rng so a loaded save
 * continues the same sequence (no reloading to reroll a roll).
 * Mulberry32.
 */
export function nextRandom(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
