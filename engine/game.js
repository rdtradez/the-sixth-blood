// The game controller: ties together content loading, the story runner, saves, and the
// library (books, unlocking, and the three ways to start a book). UI code talks only to
// this class. It has no DOM and no direct storage access, so the whole game can be played
// from a test in Node.

import { parseChapter } from './script.js';
import { validateChapter } from './validate.js';
import { Runner, relocate } from './runner.js';
import { SaveManager, AUTO_SLOT, CHAPTER_SLOT, ALL_SLOTS, carrySlot } from './saves.js';
import { createState, applyStatDefaults, assign, SCHEMA, SCHEMA_MIGRATIONS } from './state.js';
import { checkContentMigrations } from './versioning.js';
import { makeContent, CONTENT_FNS, CONTENT_COMMAND_NAMES, voiceDef } from './content.js';
import { EngineError, clone } from './util.js';

export const CONTENT_FILES = ['flags', 'voice', 'people', 'origins'];

export class Game {
  /**
   * @param loader   { manifest(), stats(), chapterSource(file), migrations(), json?(name) }
   * @param storage  getItem/setItem/removeItem (localStorage or MemoryStorage)
   */
  constructor({ loader, storage, now = () => Date.now(), fns = {}, commands = {}, warn = (m) => console.warn(m) }) {
    this.loader = loader;
    this.storage = storage;
    this.now = now;
    this.fns = fns;
    this.commands = commands;
    this.warn = warn;
    this.chapters = new Map();
    this.state = null;
    this.runner = null;
    this.saves = null;
    this.manifest = null;
    this.statDefs = {};
    this.content = null;
    this.lastSaveError = null;
  }

  async init() {
    this.manifest = await this.loader.manifest();
    this.statDefs = await this.loader.stats();
    const contentMigrations = await this.loader.migrations();
    for (const problem of checkContentMigrations(contentMigrations, this.manifest.contentVersion)) this.warn(`migrations: ${problem}`);

    const files = {};
    for (const name of CONTENT_FILES) files[name] = (this.loader.json ? await this.loader.json(name) : null) ?? {};
    this.content = makeContent({ ...files, stats: this.statDefs, manifest: this.manifest });

    this.chapterMeta = {};
    for (const book of this.manifest.books) {
      book.chapters ??= [];
      book.chapters.forEach((c, index) => { this.chapterMeta[c.id] = { ...c, bookId: book.id, bookTitle: book.title, index }; });
    }
    this.saves = new SaveManager({
      storage: this.storage,
      schema: SCHEMA,
      contentVersion: this.manifest.contentVersion,
      schemaMigrations: SCHEMA_MIGRATIONS,
      contentMigrations,
      now: this.now,
      bookIds: this.manifest.books.map((b) => b.id),
    });
    return this;
  }

  get frame() { return this.state?.frame ?? null; }
  get profile() { return this.saves.getProfile(); }

  /** Change a profile setting (for example "dev" for developer mode). */
  setSetting(key, value) {
    const p = this.saves.getProfile();
    p.settings[key] = value;
    this.saves.setProfile(p);
  }

  get devMode() { return Boolean(this.profile.settings.dev); }

  /** Books from the manifest, each marked completed or not from the profile. */
  books() {
    const done = this.profile.completedBooks;
    return this.manifest.books.map((b) => ({ ...b, completed: Boolean(done[b.id]) }));
  }

  // ---- Library ------------------------------------------------------------------------------

  #book(id) {
    const b = this.manifest.books.find((x) => x.id === id);
    if (!b) throw new EngineError(`no book "${id}" in the manifest`);
    return b;
  }

  /** Books in reading order. Developer books form their own series so they never lock story books. */
  #series(book) {
    return this.manifest.books.filter((b) => Boolean(b.dev) === Boolean(book.dev));
  }

  previousBook(id) {
    const book = this.#book(id);
    const series = this.#series(book);
    return series[series.indexOf(book) - 1] ?? null;
  }

  nextBook(id) {
    const book = this.#book(id);
    const series = this.#series(book);
    return series[series.indexOf(book) + 1] ?? null;
  }

  isUnlocked(id) {
    const book = this.#book(id);
    if (book.dev) return true;
    const prev = this.previousBook(id);
    return !prev || Boolean(this.profile.completedBooks[prev.id]);
  }

  /**
   * Everything the library screen shows: one card per book. Developer books appear only in
   * developer mode. `latest` is the newest save inside the book (for Continue), `carry` is
   * the end of the previous book (for beginning this one with your own story).
   */
  library() {
    const prof = this.profile;
    const dev = Boolean(prof.settings.dev);
    const readable = this.saves.list().filter((s) => !s.empty && !s.corrupt && !s.newer);
    return this.manifest.books.filter((b) => dev || !b.dev).map((b) => {
      const prev = this.previousBook(b.id);
      const latest = readable.filter((s) => s.meta?.bookId === b.id).sort((x, y) => y.savedAt - x.savedAt)[0] ?? null;
      const carry = prev ? this.saves.listCarries([prev.id]).find((c) => !c.newer) ?? null : null;
      return {
        id: b.id,
        title: b.title,
        number: b.number ?? null,
        city: b.city ?? '',
        era: b.era ?? '',
        accent: b.accent ?? null,
        accent2: b.accent2 ?? null,
        dev: Boolean(b.dev),
        chapterCount: b.chapters.length,
        written: b.chapters.length > 0,
        completed: Boolean(prof.completedBooks[b.id]),
        unlocked: this.isUnlocked(b.id),
        reached: prof.reached[b.id] ?? -1,
        previous: prev ? { id: prev.id, title: prev.title } : null,
        latest,
        carry,
      };
    });
  }

  /**
   * Saves that can begin a book: the carry record of the previous book, plus any save slot
   * sitting at the end of the previous book. The first book needs none.
   */
  startSaves(id) {
    const prev = this.previousBook(id);
    if (!prev) return [];
    const out = [];
    for (const c of this.saves.listCarries([prev.id])) if (!c.newer) out.push({ slot: c.slot, savedAt: c.savedAt, meta: c.meta, carry: true });
    for (const s of this.saves.list()) {
      if (s.empty || s.corrupt || s.newer) continue;
      try {
        const { state } = this.saves.load(s.slot);
        if (state.frame?.wait === 'book_end' && state.book === prev.id) out.push({ slot: s.slot, savedAt: s.savedAt, meta: s.meta, carry: false });
      } catch { /* unreadable slots are simply not offered */ }
    }
    return out;
  }

  /** Journal entries in the state a save holds (for the Previously screen before starting). */
  journalIn(slot) {
    try { return this.saves.load(slot).state.journal ?? []; } catch { return []; }
  }

  /**
   * Start a book.
   *   from "new"    the first book only: a fresh game (hero comes from character creation)
   *   from "carry"  continue your story from the end of the previous book
   *   from "slot"   begin from a save made at the end of the previous book (pass `slot`)
   *   from "quick"  a default history for every earlier book; `hero` picks gender, name, origin
   * @returns {{ frame, notices }}
   */
  async startBook(id, { from = 'new', slot = null, hero = null, seed } = {}) {
    const book = this.#book(id);
    if (!book.chapters.length) throw new EngineError(`"${book.title}" is not written yet.`);
    if (!this.isUnlocked(id) && !this.devMode) {
      throw new EngineError(`"${book.title}" unlocks when you finish "${this.previousBook(id).title}".`);
    }
    const prev = this.previousBook(id);
    if (from === 'new') {
      if (prev) throw new EngineError(`Begin "${book.title}" from your story so far, a save, or a quick start.`);
      const frame = await this.newGame({ book: id, seed, vars: hero ? this.heroVars(hero) : {} });
      return { frame, notices: [] };
    }
    if (from === 'quick') return this.#beginBook(this.quickState(id, { hero, seed }), id, []);
    if (from === 'carry' || from === 'slot') {
      if (!prev) throw new EngineError('The first book starts fresh or with a quick start.');
      const source = from === 'carry' ? carrySlot(prev.id) : slot;
      const { state, notices } = this.saves.load(source);
      if (!(state.frame?.wait === 'book_end' && state.book === prev.id)) {
        throw new EngineError(`That save is not at the end of "${prev.title}".`);
      }
      return this.#beginBook(state, id, notices);
    }
    throw new EngineError(`unknown start option "${from}"`);
  }

  /** At the end of a book, carry straight on into the next one. */
  async continueToNextBook() {
    const st = this.state;
    if (st?.frame?.wait !== 'book_end') throw new EngineError('the book has not ended');
    const next = this.nextBook(st.book);
    if (!next || !next.chapters.length) throw new EngineError('the next book is not written yet');
    return this.#beginBook(clone(st), next.id, []);
  }

  async #beginBook(state, id, notices) {
    applyStatDefaults(state, this.statDefs);
    state.decisions ??= [];
    state.journal ??= [];
    state.booksDone ??= [];
    state.book = id;
    state.stack = [];
    state.pos = null;
    state.frame = null;
    this.state = state;
    const frame = await this.startChapter(this.#book(id).chapters[0].id);
    return { frame, notices };
  }

  // ---- Hero and quick start ------------------------------------------------------------------

  /** Name suggestions for an origin and gender (character creation and quick start). */
  suggestNames(origin, gender = 'm') {
    const o = this.content.origins.origin.find((x) => x.id === origin) ?? this.content.origins.origin[0];
    return o?.names?.[gender] ?? o?.names?.m ?? [];
  }

  /**
   * Turn creation choices into variables, filling gaps with sensible defaults from
   * content/origins.json: { gender, name, origin, role, path }.
   */
  heroVars(hero = {}) {
    const groups = this.content.origins;
    const gender = ['m', 'f', 'x'].includes(hero.gender) ? hero.gender : 'm';
    const origin = groups.origin.find((o) => o.id === hero.origin) ?? groups.origin[0] ?? null;
    const pick = (group, want, suggested) => {
      const list = groups[group];
      return list.find((x) => x.id === want)?.id ?? list.find((x) => suggested?.includes(x.id))?.id ?? list[0]?.id ?? '';
    };
    const vars = {
      'hero.gender': gender,
      'hero.name': (hero.name ?? '').trim() || this.suggestNames(origin?.id, gender)[0] || 'Gaius',
    };
    if (origin) vars['hero.origin'] = origin.id;
    const role = pick('role', hero.role, origin?.roles);
    const path = pick('path', hero.path, origin?.paths);
    if (role) vars['hero.role'] = role;
    if (path) vars['hero.path'] = path;
    return vars;
  }

  /**
   * A state for starting a book with a default history: every earlier book counts as
   * finished, each registered flag from those books takes its "default", the book's
   * "quickstart.vars" are applied, and each earlier book's "recap" becomes a journal entry.
   */
  quickState(id, { hero = null, seed } = {}) {
    const book = this.#book(id);
    const state = createState({ book: id, seed, vars: this.heroVars(hero ?? {}) });
    applyStatDefaults(state, this.statDefs);
    const series = this.#series(book);
    for (const earlier of series.slice(0, series.indexOf(book))) {
      state.booksDone.push(earlier.id);
      for (const def of Object.values(this.content.flags.entries)) {
        if (def.book !== earlier.id || !('default' in def)) continue;
        if (def.kind === 'flag' && !def.default) continue;
        assign(state, this.statDefs, def.name, def.default);
        if (def.major) state.decisions.push({ name: def.name, value: def.default, book: earlier.id, chapter: null, quick: true });
      }
      if (earlier.recap) state.journal.push({ book: earlier.id, chapter: null, title: earlier.title, text: earlier.recap });
    }
    for (const [name, value] of Object.entries(book.quickstart?.vars ?? {})) assign(state, this.statDefs, name, value);
    state.vars.quick_start = true;
    return state;
  }

  // ---- Story voice status --------------------------------------------------------------------

  /** The hero's condition in the story's voice, for the menu. Hidden stats are left out. */
  status(state = this.state) {
    if (!state) return [];
    const ctx = { vars: state.vars, state, content: this.content };
    const out = [];
    for (const [stat, def] of Object.entries(this.content.voice)) {
      if (stat.endsWith('.*') || def.hidden || stat === 'note') continue;
      if (!voiceDef(this.content.voice, stat)?.bands?.length) continue;
      out.push({ stat, label: def.label ?? stat, text: CONTENT_FNS.voice(ctx, stat, 'status') });
    }
    return out;
  }

  // ---- Chapters -------------------------------------------------------------------

  async getChapter(id) {
    if (this.chapters.has(id)) return this.chapters.get(id);
    const meta = this.chapterMeta[id];
    if (!meta) throw new EngineError(`no chapter "${id}" in the manifest`);
    const source = await this.loader.chapterSource(meta.file);
    const { chapter, errors } = parseChapter(source, { file: meta.file, fnNames: Object.keys(this.fns) });
    if (errors.length) throw new EngineError(errors.map((e) => e.message).join('\n'));
    if (chapter.id !== id) throw new EngineError(`${meta.file}: header says "@chapter ${chapter.id}" but the manifest lists "${id}"`);
    const report = validateChapter(chapter, {
      chapterIds: new Set(Object.keys(this.chapterMeta)),
      commandNames: new Set(['log', ...CONTENT_COMMAND_NAMES, ...Object.keys(this.commands)]),
      variantIds: this.content.variantIds,
    });
    if (report.errors.length) throw new EngineError(report.errors.map((e) => e.message).join('\n'));
    for (const w of report.warnings) this.warn(w.message);
    this.chapters.set(id, chapter);
    return chapter;
  }

  #env() {
    return { statDefs: this.statDefs, content: this.content, fns: this.fns, commands: this.commands, warn: (m) => this.warn(m) };
  }

  // ---- Playing --------------------------------------------------------------------------

  /** Start a book from its first chapter. `vars` seeds hero choices, flags, etc. */
  async newGame({ book, vars = {}, seed } = {}) {
    const bookMeta = this.#book(book);
    if (!bookMeta.chapters.length) throw new EngineError(`"${bookMeta.title}" is not written yet.`);
    this.state = createState({ book, vars, seed });
    applyStatDefaults(this.state, this.statDefs);
    return this.startChapter(bookMeta.chapters[0].id);
  }

  async startChapter(id, scene) {
    const chapter = await this.getChapter(id);
    const st = this.state;
    st.chapter = id;
    st.chapterVersion = chapter.version;
    st.book = this.chapterMeta[id].bookId;
    this.#markReached(st.book, this.chapterMeta[id].index);
    this.runner = new Runner(chapter, st, this.#env());
    this.runner.start(scene);
    this.#checkpoint(true);
    return st.frame;
  }

  #markReached(bookId, index) {
    try {
      const p = this.saves.getProfile();
      if ((p.reached[bookId] ?? -1) >= index) return;
      p.reached[bookId] = index;
      this.saves.setProfile(p);
    } catch (e) { this.lastSaveError = e; }
  }

  /** Advance past a page break, or past the end of a chapter. */
  async continue() {
    const frame = this.frame;
    if (!frame) throw new EngineError('no game in progress');
    if (frame.wait === 'chapter_end') return this.#endChapter(frame.next);
    this.runner.continue();
    this.#checkpoint(false);
    return this.state.frame;
  }

  async choose(index) {
    this.runner.choose(index);
    this.#checkpoint(false);
    return this.state.frame;
  }

  async #endChapter(target) {
    const st = this.state;
    const chapter = this.chapters.get(st.chapter);
    const meta = this.chapterMeta[st.chapter];
    let nextId = null;
    if (target === 'next') {
      nextId = chapter.next ?? this.#book(meta.bookId).chapters[meta.index + 1]?.id ?? null;
    } else if (target !== 'endbook') {
      nextId = target;
    }
    if (nextId) return this.startChapter(nextId);

    const profile = this.saves.getProfile();
    profile.completedBooks[meta.bookId] = this.now();
    try { this.saves.setProfile(profile); } catch (e) { this.lastSaveError = e; }
    st.stack = [];
    st.booksDone ??= [];
    if (!st.booksDone.includes(meta.bookId)) st.booksDone.push(meta.bookId);
    const next = this.nextBook(meta.bookId);
    st.frame = { wait: 'book_end', paragraphs: [], book: meta.bookId, nextBook: next?.id ?? null };
    this.#checkpoint(false);
    try {
      this.saves.save(carrySlot(meta.bookId), st, this.#meta());
    } catch (e) { this.lastSaveError = e; }
    return st.frame;
  }

  // ---- Saving ---------------------------------------------------------------------------

  #meta() {
    const meta = this.chapterMeta[this.state.chapter] ?? {};
    const atEnd = this.state.frame?.wait === 'book_end';
    return {
      bookId: meta.bookId,
      bookTitle: meta.bookTitle,
      chapterId: this.state.chapter,
      chapterTitle: atEnd ? `End of ${meta.bookTitle}` : meta.title,
      hero: typeof this.state.vars['hero.name'] === 'string' ? this.state.vars['hero.name'] : undefined,
    };
  }

  #checkpoint(chapterStart) {
    try {
      this.saves.save(AUTO_SLOT, this.state, this.#meta());
      if (chapterStart) this.saves.save(CHAPTER_SLOT, this.state, this.#meta());
      this.lastSaveError = null;
    } catch (e) {
      this.lastSaveError = e; // never interrupt play because a save failed; the UI can show it
    }
  }

  saveToSlot(slot) {
    if (!this.state) throw new EngineError('no game in progress');
    if (!ALL_SLOTS.includes(String(slot))) throw new EngineError(`unknown slot "${slot}"`);
    return this.saves.save(slot, this.state, this.#meta());
  }

  /** Load a slot, upgrading old saves and repairing the position if chapters changed. */
  async loadSlot(slot) {
    const { state, notices } = this.saves.load(slot);
    applyStatDefaults(state, this.statDefs); // stats added since the save was made
    this.state = state;

    if (state.frame?.wait === 'book_end') {
      this.runner = null;
      state.frame.nextBook = this.manifest.books.some((b) => b.id === state.book) ? this.nextBook(state.book)?.id ?? null : null;
      return { frame: state.frame, notices };
    }
    let id = state.chapter;
    if (!this.chapterMeta[id]) {
      const book = this.manifest.books.find((b) => b.id === state.book);
      if (!book || !book.chapters.length) throw new EngineError(`This save refers to a book ("${state.book}") that no longer exists.`);
      id = book.chapters[0].id;
      notices.push('A chapter from your save no longer exists, so the book restarts from its first chapter.');
      await this.startChapter(id);
      return { frame: state.frame, notices };
    }

    const chapter = await this.getChapter(id);
    const fix = relocate(chapter, state);
    notices.push(...fix.notices);
    this.runner = new Runner(chapter, state, this.#env());
    if (fix.action === 'restart_chapter') this.runner.start();
    else if (fix.action === 'restart_scene') this.runner.start(fix.scene);
    else this.runner.resume();
    state.chapterVersion = chapter.version;
    this.#checkpoint(false);
    return { frame: state.frame, notices };
  }
}
