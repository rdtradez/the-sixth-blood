// Save slots on top of any key/value storage (localStorage in the browser, a Map in tests).
//
// Slots:   "auto"     overwritten at every page break or choice
//          "chapter"  written when a chapter begins (a safe place to go back to)
//          "quick"    the quick save
//          "1".."5"   manual slots
//
// Every write keeps the previous version as a backup, and every save carries a checksum, so a
// damaged slot falls back to its backup instead of being lost.

import { upgradeEnvelope, SAVE_FORMAT } from './versioning.js';
import { SaveError, fnv1a } from './util.js';

export const AUTO_SLOT = 'auto';
export const CHAPTER_SLOT = 'chapter';
export const QUICK_SLOT = 'quick';
export const MANUAL_SLOTS = ['1', '2', '3', '4', '5'];
export const ALL_SLOTS = [AUTO_SLOT, CHAPTER_SLOT, QUICK_SLOT, ...MANUAL_SLOTS];

export const EXPORT_FORMAT = 'tsb-export';

export class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

export class SaveManager {
  constructor({
    storage,
    schema,
    contentVersion,
    schemaMigrations = {},
    contentMigrations = [],
    now = () => Date.now(),
    prefix = 'tsb:',
  }) {
    this.storage = storage;
    this.schema = schema;
    this.contentVersion = contentVersion;
    this.schemaMigrations = schemaMigrations;
    this.contentMigrations = contentMigrations;
    this.now = now;
    this.prefix = prefix;
  }

  #key(slot) { return `${this.prefix}slot:${slot}`; }
  #bak(slot) { return `${this.prefix}slot:${slot}:bak`; }

  #write(key, value) {
    try {
      this.storage.setItem(key, value);
    } catch (e) {
      throw new SaveError('storage_full', 'Could not write the save (device storage may be full or blocked).');
    }
  }

  /** Save state into a slot. `meta` is small display info (book, chapter title, etc). */
  save(slot, state, meta = {}) {
    if (!ALL_SLOTS.includes(String(slot))) throw new SaveError('bad_slot', `Unknown save slot "${slot}".`);
    const payload = JSON.stringify(state);
    const envelope = {
      format: SAVE_FORMAT,
      schema: this.schema,
      contentVersion: this.contentVersion,
      savedAt: this.now(),
      meta,
      checksum: fnv1a(payload),
      payload,
    };
    this.#writeEnvelope(slot, envelope);
    return envelope;
  }

  #writeEnvelope(slot, envelope) {
    const key = this.#key(slot);
    const previous = this.storage.getItem(key);
    if (previous) this.#write(this.#bak(slot), previous);
    this.#write(key, JSON.stringify(envelope));
  }

  /** Read the raw envelope (no upgrade). Falls back to the backup if the slot is damaged. */
  readEnvelope(slot) {
    for (const [key, isBackup] of [[this.#key(slot), false], [this.#bak(slot), true]]) {
      const raw = this.storage.getItem(key);
      if (!raw) continue;
      try {
        const env = JSON.parse(raw);
        if (env.format === SAVE_FORMAT && env.checksum === fnv1a(env.payload)) return { envelope: env, usedBackup: isBackup };
      } catch { /* try the backup */ }
    }
    return null;
  }

  /** Load a slot and upgrade it to the current versions. Throws SaveError on any problem. */
  load(slot) {
    const found = this.readEnvelope(slot);
    if (!found) {
      const raw = this.storage.getItem(this.#key(slot));
      throw new SaveError(raw ? 'corrupt' : 'empty', raw ? 'This save is damaged and no backup could be read.' : 'That slot is empty.');
    }
    const result = upgradeEnvelope(found.envelope, this);
    const notices = [...result.notices];
    if (found.usedBackup) notices.unshift('The latest save was damaged, so the previous copy was loaded.');
    return { state: result.state, notices, meta: found.envelope.meta, savedAt: found.envelope.savedAt, upgraded: result.upgraded };
  }

  delete(slot) {
    this.storage.removeItem(this.#key(slot));
    this.storage.removeItem(this.#bak(slot));
  }

  /** Summary of every slot for a save/load screen. Does not upgrade or fully parse states. */
  list() {
    return ALL_SLOTS.map((slot) => {
      const raw = this.storage.getItem(this.#key(slot));
      if (!raw) return { slot, empty: true };
      const found = this.readEnvelope(slot);
      if (!found) return { slot, empty: false, corrupt: true };
      const e = found.envelope;
      return {
        slot,
        empty: false,
        corrupt: false,
        usedBackup: found.usedBackup,
        savedAt: e.savedAt,
        meta: e.meta,
        newer: e.schema > this.schema || e.contentVersion > this.contentVersion,
      };
    });
  }

  /** The most recently written readable slot, for a Continue button. */
  latest() {
    return this.list()
      .filter((s) => !s.empty && !s.corrupt && !s.newer)
      .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
  }

  // ---- Profile (progress across games: completed books, settings) ------------------

  getProfile() {
    try {
      const raw = this.storage.getItem(`${this.prefix}profile`);
      if (raw) return { v: 1, completedBooks: {}, settings: {}, ...JSON.parse(raw) };
    } catch { /* fall through */ }
    return { v: 1, completedBooks: {}, settings: {} };
  }

  setProfile(profile) {
    this.#write(`${this.prefix}profile`, JSON.stringify(profile));
  }

  // ---- Export and import ------------------------------------------------------------

  /** One text file holding every slot plus the profile. Pass slots to export only some. */
  exportText(slots = ALL_SLOTS) {
    const out = {};
    for (const slot of slots) {
      const found = this.readEnvelope(slot);
      if (found) out[slot] = found.envelope;
    }
    const data = JSON.stringify({ slots: out, profile: this.getProfile() });
    return JSON.stringify({
      format: EXPORT_FORMAT,
      schema: this.schema,
      exportedAt: this.now(),
      checksum: fnv1a(data),
      data,
    }, null, 1);
  }

  /**
   * Import an export file. Manual slots that are already used are kept unless
   * `overwrite` is true; imported saves then go to the next free manual slot.
   * Saves are stored exactly as exported and upgraded when opened.
   * @returns {{ imported: {from:string,to:string}[], skipped: {slot:string,reason:string}[] }}
   */
  importText(text, { overwrite = false } = {}) {
    let wrapper;
    try { wrapper = JSON.parse(text); } catch { throw new SaveError('corrupt', 'That file is not a save export.'); }
    if (!wrapper || wrapper.format !== EXPORT_FORMAT || typeof wrapper.data !== 'string') {
      throw new SaveError('corrupt', 'That file is not a save export.');
    }
    if (wrapper.checksum !== fnv1a(wrapper.data)) {
      throw new SaveError('corrupt', 'That export file is damaged (its checksum does not match).');
    }
    if (wrapper.schema > this.schema) {
      throw new SaveError('newer_schema', 'That export was made by a newer version of the app. Update the app, then import it.');
    }
    const data = JSON.parse(wrapper.data);
    const report = { imported: [], skipped: [] };
    const free = () => MANUAL_SLOTS.find((s) => !this.storage.getItem(this.#key(s)));

    for (const [slot, envelope] of Object.entries(data.slots ?? {})) {
      if (envelope.format !== SAVE_FORMAT || envelope.checksum !== fnv1a(envelope.payload)) {
        report.skipped.push({ slot, reason: 'damaged' });
        continue;
      }
      if (envelope.schema > this.schema || envelope.contentVersion > this.contentVersion) {
        report.skipped.push({ slot, reason: 'newer than this app' });
        continue;
      }
      let target = slot;
      const taken = Boolean(this.storage.getItem(this.#key(slot)));
      if (taken && !overwrite) {
        if (!MANUAL_SLOTS.includes(slot)) { report.skipped.push({ slot, reason: 'slot in use' }); continue; }
        target = free();
        if (!target) { report.skipped.push({ slot, reason: 'no free slot' }); continue; }
      }
      this.#writeEnvelope(target, envelope);
      report.imported.push({ from: slot, to: target });
    }

    if (data.profile) {
      const mine = this.getProfile();
      this.setProfile({ ...mine, completedBooks: { ...data.profile.completedBooks, ...mine.completedBooks } });
    }
    return report;
  }
}
