// Save versioning. Every save records two versions:
//
//   schema          the SHAPE of the state object (engine level). Bump engine/state.js SCHEMA
//                   and add schemaMigrations[oldVersion] = (state) => newState.
//   contentVersion  the STORY content (chapters, flags, stats). Bump "contentVersion" in
//                   content/manifest.json and add an entry to content/migrations.js:
//                   { version, note, up(state) }.
//
// Opening a save runs every migration between the save's versions and the current ones, in
// order, so a save made on day one still loads after a hundred chapters are added or fixed.
// A save from a NEWER version than this app is refused (never guessed at).

import { SaveError, fnv1a } from './util.js';

export const SAVE_FORMAT = 'tsb-save';

/**
 * Turn a stored save envelope into a current-version state.
 * @returns { state, notices, upgraded }
 */
export function upgradeEnvelope(envelope, { schema, contentVersion, schemaMigrations = {}, contentMigrations = [] }) {
  if (!envelope || envelope.format !== SAVE_FORMAT || typeof envelope.payload !== 'string') {
    throw new SaveError('corrupt', 'This save file is not readable.');
  }
  if (envelope.checksum !== fnv1a(envelope.payload)) {
    throw new SaveError('corrupt', 'This save is damaged (its checksum does not match).');
  }
  if (envelope.schema > schema) {
    throw new SaveError('newer_schema', 'This save was made by a newer version of the app. Update the app, then try again.');
  }
  if (envelope.contentVersion > contentVersion) {
    throw new SaveError('newer_content', 'This save is from newer story content than this app has. Update the app, then try again.');
  }
  let state;
  try {
    state = JSON.parse(envelope.payload);
  } catch {
    throw new SaveError('corrupt', 'This save is damaged (it cannot be parsed).');
  }

  const notices = [];
  let upgraded = false;

  for (let v = envelope.schema; v < schema; v++) {
    const migrate = schemaMigrations[v];
    if (!migrate) throw new SaveError('missing_migration', `No upgrade path from save format ${v} to ${v + 1}.`);
    state = migrate(state) ?? state;
    upgraded = true;
  }

  const pending = contentMigrations
    .filter((m) => m.version > envelope.contentVersion && m.version <= contentVersion)
    .sort((a, b) => a.version - b.version);
  for (const m of pending) {
    state = m.up(state) ?? state;
    if (m.note) notices.push(m.note);
    upgraded = true;
  }
  return { state, notices, upgraded };
}

/** Check a migrations list is well formed (unique, ascending, not past the current version). */
export function checkContentMigrations(list, contentVersion) {
  const problems = [];
  const seen = new Set();
  for (const m of list) {
    if (!Number.isInteger(m.version) || m.version < 2) problems.push(`migration version ${m.version} must be a whole number of 2 or more`);
    if (seen.has(m.version)) problems.push(`two migrations share version ${m.version}`);
    seen.add(m.version);
    if (m.version > contentVersion) problems.push(`migration ${m.version} is newer than contentVersion ${contentVersion}`);
    if (typeof m.up !== 'function') problems.push(`migration ${m.version} has no up(state) function`);
  }
  return problems;
}
