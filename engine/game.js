// The game controller: ties together content loading, the story runner, and saves.
// UI code talks only to this class. It has no DOM and no direct storage access, so the
// whole game can be played from a test in Node.

import { parseChapter } from './script.js';
import { validateChapter } from './validate.js';
import { Runner, relocate } from './runner.js';
import { SaveManager, AUTO_SLOT, CHAPTER_SLOT } from './saves.js';
import { createState, applyStatDefaults, SCHEMA, SCHEMA_MIGRATIONS } from './state.js';
import { checkContentMigrations } from './versioning.js';
import { EngineError } from './util.js';

export class Game {
  /**
   * @param loader   { manifest(), stats(), chapterSource(file), migrations() }
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
    this.lastSaveError = null;
  }

  async init() {
    this.manifest = await this.loader.manifest();
    this.statDefs = await this.loader.stats();
    const contentMigrations = await this.loader.migrations();
    for (const problem of checkContentMigrations(contentMigrations, this.manifest.contentVersion)) this.warn(`migrations: ${problem}`);

    this.chapterMeta = {};
    for (const book of this.manifest.books) {
      book.chapters.forEach((c, index) => { this.chapterMeta[c.id] = { ...c, bookId: book.id, bookTitle: book.title, index }; });
    }
    this.saves = new SaveManager({
      storage: this.storage,
      schema: SCHEMA,
      contentVersion: this.manifest.contentVersion,
      schemaMigrations: SCHEMA_MIGRATIONS,
      contentMigrations,
      now: this.now,
    });
    return this;
  }

  get frame() { return this.state?.frame ?? null; }
  get profile() { return this.saves.getProfile(); }

  /** Books from the manifest, each marked completed or not from the profile. */
  books() {
    const done = this.profile.completedBooks;
    return this.manifest.books.map((b) => ({ ...b, completed: Boolean(done[b.id]) }));
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
      commandNames: new Set(['log', ...Object.keys(this.commands)]),
    });
    if (report.errors.length) throw new EngineError(report.errors.map((e) => e.message).join('\n'));
    for (const w of report.warnings) this.warn(w.message);
    this.chapters.set(id, chapter);
    return chapter;
  }

  #env() {
    return { statDefs: this.statDefs, fns: this.fns, commands: this.commands, warn: (m) => this.warn(m) };
  }

  // ---- Playing --------------------------------------------------------------------------

  /** Start a book from its first chapter. `vars` seeds hero choices, flags, etc. */
  async newGame({ book, vars = {}, seed } = {}) {
    const bookMeta = this.manifest.books.find((b) => b.id === book);
    if (!bookMeta) throw new EngineError(`no book "${book}" in the manifest`);
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
    this.runner = new Runner(chapter, st, this.#env());
    this.runner.start(scene);
    this.#checkpoint(true);
    return st.frame;
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
      nextId = chapter.next ?? this.manifest.books.find((b) => b.id === meta.bookId).chapters[meta.index + 1]?.id ?? null;
    } else if (target !== 'endbook') {
      nextId = target;
    }
    if (nextId) return this.startChapter(nextId);

    const profile = this.saves.getProfile();
    profile.completedBooks[meta.bookId] = this.now();
    try { this.saves.setProfile(profile); } catch (e) { this.lastSaveError = e; }
    st.stack = [];
    st.frame = { wait: 'book_end', paragraphs: [], book: meta.bookId };
    this.#checkpoint(false);
    return st.frame;
  }

  // ---- Saving ---------------------------------------------------------------------------

  #meta() {
    const meta = this.chapterMeta[this.state.chapter] ?? {};
    return { bookId: meta.bookId, bookTitle: meta.bookTitle, chapterId: this.state.chapter, chapterTitle: meta.title };
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
    return this.saves.save(slot, this.state, this.#meta());
  }

  /** Load a slot, upgrading old saves and repairing the position if chapters changed. */
  async loadSlot(slot) {
    const { state, notices } = this.saves.load(slot);
    applyStatDefaults(state, this.statDefs); // stats added since the save was made
    this.state = state;

    if (state.frame?.wait === 'book_end') {
      this.runner = null;
      return { frame: state.frame, notices };
    }
    let id = state.chapter;
    if (!this.chapterMeta[id]) {
      const book = this.manifest.books.find((b) => b.id === state.book);
      if (!book) throw new EngineError(`This save refers to a book ("${state.book}") that no longer exists.`);
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
