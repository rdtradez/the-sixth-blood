// Player settings, stored in the profile (saves.getProfile().settings). Every setting has a
// default, so a missing or damaged value never breaks the reader. `dev` is developer mode
// (open the app with ?dev) and has no row in the settings screen.

import { EngineError } from './util.js';

export const SETTING_DEFS = {
  textSize: {
    label: 'Text size',
    values: [
      { id: 'small', label: 'Small' },
      { id: 'normal', label: 'Normal' },
      { id: 'large', label: 'Large' },
      { id: 'xlarge', label: 'Very large' },
    ],
    default: 'normal',
  },
  theme: {
    label: 'Colors',
    values: [
      { id: 'night', label: 'Night' },
      { id: 'dusk', label: 'Dusk' },
      { id: 'parchment', label: 'Parchment' },
    ],
    default: 'night',
  },
  font: {
    label: 'Story font',
    values: [
      { id: 'garamond', label: 'Garamond' },
      { id: 'serif', label: 'Plain serif' },
      { id: 'sans', label: 'Plain sans' },
      { id: 'dyslexic', label: 'Dyslexia friendly' },
    ],
    default: 'garamond',
  },
  contentNotes: {
    label: 'Content notes before heavy chapters',
    kind: 'bool',
    default: false,
    help: 'Shows a short heads up listing difficult themes before a chapter that has them.',
  },
  rewind: {
    label: 'Rewind last choice',
    kind: 'bool',
    default: false,
    help: 'Adds a button to take back your most recent choice. Off by default so choices stay final.',
  },
  dev: { kind: 'bool', default: false, hidden: true },
};

export const SETTING_NAMES = Object.keys(SETTING_DEFS);

const allowed = (def) => (def.kind === 'bool' ? [true, false] : def.values.map((v) => v.id));

/** True if `value` is a legal value for the setting. */
export function validSetting(key, value) {
  const def = SETTING_DEFS[key];
  return Boolean(def) && allowed(def).includes(value);
}

/** Throws a plain error for an unknown setting or an illegal value. */
export function checkSetting(key, value) {
  const def = SETTING_DEFS[key];
  if (!def) throw new EngineError(`unknown setting "${key}"`);
  if (!allowed(def).includes(value)) throw new EngineError(`"${value}" is not a choice for ${key} (${allowed(def).join(', ')})`);
}

/** The full settings object: stored values that are still legal, defaults for the rest. */
export function readSettings(stored = {}) {
  const out = {};
  for (const [key, def] of Object.entries(SETTING_DEFS)) {
    out[key] = validSetting(key, stored?.[key]) ? stored[key] : def.default;
  }
  return out;
}
