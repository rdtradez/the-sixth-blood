// Reader UI: library screen, book start options, Previously screen, story view, and the
// menu (story voice status and saves). All game logic lives in engine/.
// Settings and the full look and feel arrive in session 4.

import { Game } from '../engine/game.js';
import { createFetchLoader } from '../engine/fetch-loader.js';
import { MemoryStorage, MANUAL_SLOTS } from '../engine/saves.js';

const app = document.getElementById('app');
const dialog = document.getElementById('dialog');
const toastEl = document.getElementById('toast');

// ---- helpers -----------------------------------------------------------------------------

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Turn *italic* and **bold** into elements. Everything else stays plain text (never HTML). */
function inline(text) {
  const frag = document.createDocumentFragment();
  for (const part of text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)) {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) frag.append(h('strong', {}, part.slice(2, -2)));
    else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) frag.append(h('em', {}, part.slice(1, -1)));
    else frag.append(part);
  }
  return frag;
}

let toastTimer;
function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = `show${isError ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = ''; }, isError ? 6000 : 3200);
}

function pickStorage() {
  try {
    const ls = window.localStorage;
    ls.setItem('tsb:probe', '1');
    ls.removeItem('tsb:probe');
    return { storage: ls, persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}

const SLOT_NAMES = { auto: 'Autosave', chapter: 'Chapter start', quick: 'Quick save' };
const slotName = (s) => SLOT_NAMES[s] ?? `Slot ${s}`;

// ---- app state ------------------------------------------------------------------------------

let game;
let busy = false;

async function guard(fn) {
  if (busy) return;
  busy = true;
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    showError(e);
  } finally {
    busy = false;
  }
}

function showError(e) {
  app.replaceChildren(
    h('h1', {}, 'Something went wrong'),
    h('div', { class: 'error-box' }, e?.message ?? String(e)),
    h('button', { class: 'primary', onclick: () => showLibrary() }, 'Back to the library'),
  );
}

// ---- library -----------------------------------------------------------------------------------

const NUMBER_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
const bookLabel = (b) => (b.dev ? 'Developer' : `Book ${NUMBER_WORDS[b.number] ?? b.number ?? ''}`);

function progressText(b) {
  if (!b.written) return 'Being written';
  if (!b.unlocked) return `Finish ${b.previous?.title ?? 'the book before'} to unlock`;
  if (b.completed) return 'Finished';
  if (b.reached >= 0) return `Chapter ${b.reached + 1} of ${b.chapterCount}`;
  return b.chapterCount === 1 ? '1 chapter' : `${b.chapterCount} chapters`;
}

function showLibrary() {
  const latest = game.saves.latest();
  const kids = [h('h1', {}, 'The Sixth Blood'), h('p', { class: 'sub' }, 'Two thousand years. Seven cities. One bloodline.')];
  if (latest) {
    kids.push(h('button', { class: 'primary', onclick: () => guard(() => loadAndShow(latest.slot)) },
      `Continue${latest.meta?.chapterTitle ? `: ${latest.meta.chapterTitle}` : ''}`));
  }
  const shelf = h('div', { class: 'shelf' });
  for (const b of game.library()) {
    const locked = !b.unlocked || !b.written;
    const card = h('button', {
      class: `book${locked ? ' locked' : ''}${b.completed ? ' done' : ''}`,
      style: b.accent ? `--accent: ${b.accent}; --accent2: ${b.accent2 ?? b.accent}` : false,
      'aria-label': `${bookLabel(b)}: ${b.title}. ${b.city}, ${b.era}. ${progressText(b)}.`,
      onclick: () => openBook(b.id),
    },
    h('span', { class: 'num' }, bookLabel(b)),
    h('span', { class: 'btitle' }, b.title),
    h('span', { class: 'where' }, [b.city, b.era].filter(Boolean).join(', ')),
    h('span', { class: 'progress' }, progressText(b)));
    shelf.append(card);
  }
  kids.push(shelf);
  const row = h('div', { class: 'row center' }, h('button', { class: 'small', onclick: () => openMenu() }, 'Saves'));
  if (game.devMode) row.append(h('span', { class: 'tag' }, 'developer mode'));
  kids.push(row);
  app.replaceChildren(...kids);
  window.scrollTo(0, 0);
}

function openBook(id) {
  const b = game.library().find((x) => x.id === id);
  const kids = [
    h('p', { class: 'num' }, bookLabel(b)),
    h('h2', {}, b.title),
    h('p', { class: 'info' }, [b.city, b.era].filter(Boolean).join(', ')),
  ];
  if (!b.written) {
    kids.push(h('p', {}, 'This book is still being written.'));
  } else if (!b.unlocked && !game.devMode) {
    kids.push(h('p', {}, `Finish ${b.previous.title} to unlock this book.`));
  } else {
    const go = (fn) => () => { dialog.close(); guard(fn); };
    if (b.latest && !b.completed) {
      kids.push(h('button', { class: 'primary', onclick: go(() => loadAndShow(b.latest.slot)) }, `Continue: ${b.latest.meta?.chapterTitle ?? 'your save'}`));
    }
    if (!b.previous) {
      kids.push(h('button', { onclick: go(() => begin(b.id, { from: 'new' })) }, b.latest || b.completed ? 'Begin again' : 'Begin'));
    } else {
      if (b.carry) {
        kids.push(h('button', { class: b.latest ? '' : 'primary', onclick: go(() => begin(b.id, { from: 'carry' }, game.journalIn(b.carry.slot))) },
          'Begin with your story so far',
          h('span', { class: 'hint' }, `From the end of ${b.previous.title}${b.carry.meta?.hero ? `, as ${b.carry.meta.hero}` : ''}`)));
      }
      const others = game.startSaves(b.id).filter((s) => !s.carry);
      if (others.length) kids.push(h('button', { onclick: () => pickSave(b, others) }, 'Begin from a save'));
    }
    kids.push(h('button', { onclick: () => quickStartForm(b) }, 'Quick start',
      h('span', { class: 'hint' }, b.previous ? 'Skip ahead with a default history for the books before' : 'Skip character creation with a ready made hero')));
    if (b.carry) {
      const entries = game.journalIn(b.carry.slot);
      if (entries.length) kids.push(h('button', { onclick: () => showPreviously(entries, () => openBook(id)) }, 'Previously'));
    }
  }
  kids.push(h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => dialog.close() }, 'Close')));
  dialog.replaceChildren(...kids);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function pickSave(b, saves) {
  const rows = saves.map((s) => h('div', { class: 'slot' },
    h('div', { class: 'name' }, slotName(s.slot)),
    h('div', { class: 'info' }, `${s.meta?.hero ? `${s.meta.hero}, ` : ''}${s.meta?.chapterTitle ?? ''}, ${new Date(s.savedAt).toLocaleString()}`),
    h('button', { class: 'small', onclick: () => { dialog.close(); guard(() => begin(b.id, { from: 'slot', slot: s.slot }, game.journalIn(s.slot))); } }, 'Begin from this')));
  dialog.replaceChildren(
    h('h2', {}, `Begin ${b.title}`),
    h('p', { class: 'info' }, `Saves made at the end of ${b.previous.title}.`),
    ...rows,
    h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => openBook(b.id) }, 'Back')));
}

function quickStartForm(b) {
  const origins = game.content.origins.origin;
  const state = { gender: 'm', origin: origins[0]?.id ?? '' };
  const nameInput = h('input', { type: 'text', maxlength: '40', 'aria-label': 'Name', autocomplete: 'off' });
  let names = [];
  let nameIndex = 0;
  const refreshNames = () => { names = game.suggestNames(state.origin, state.gender); nameIndex = 0; nameInput.value = names[0] ?? ''; };
  const genderSel = h('select', { 'aria-label': 'Hero', onchange: (e) => { state.gender = e.target.value; refreshNames(); } },
    h('option', { value: 'm' }, 'A man'), h('option', { value: 'f' }, 'A woman'));
  const originSel = h('select', { 'aria-label': 'Homeland', onchange: (e) => { state.origin = e.target.value; refreshNames(); } },
    ...origins.map((o) => h('option', { value: o.id }, o.label)));
  refreshNames();
  dialog.replaceChildren(
    h('h2', {}, `Quick start: ${b.title}`),
    h('p', { class: 'info' }, b.previous
      ? 'You begin this book with a default history: the earlier books are counted as played with typical choices. Your own saves are untouched.'
      : 'You begin with a ready made hero instead of creating one.'),
    h('label', { class: 'field' }, 'Play as', genderSel),
    h('label', { class: 'field' }, 'Homeland', originSel),
    h('label', { class: 'field' }, 'Name', h('span', { class: 'inline' }, nameInput,
      h('button', { class: 'small', type: 'button', onclick: () => { if (names.length) { nameIndex = (nameIndex + 1) % names.length; nameInput.value = names[nameIndex]; } } }, 'Another'))),
    h('div', { class: 'row' },
      h('button', { class: 'small primary', onclick: () => {
        dialog.close();
        guard(() => begin(b.id, { from: 'quick', hero: { ...state, name: nameInput.value } }, null));
      } }, 'Start'),
      h('button', { class: 'small', onclick: () => openBook(b.id) }, 'Back')));
}

/** Start a book, showing the Previously screen first when there is a journal to read. */
async function begin(id, options, journal) {
  if (!confirmOverwrite()) return;
  const { notices } = await game.startBook(id, options);
  const entries = journal ?? game.state.journal ?? [];
  if (notices.length) toast(notices.join(' '));
  if (entries.length && options.from !== 'new') showPreviously(entries, () => showFrame(), 'Begin');
  else showFrame();
}

function confirmOverwrite() {
  // Starting a book replaces the autosave; manual saves are never touched.
  const auto = game.saves.list().find((s) => s.slot === 'auto');
  if (!auto || auto.empty || game.frame?.wait === 'book_end') return true;
  return confirm('Starting here replaces your autosave. Your manual saves are kept. Go on?');
}

function showPreviously(entries, onDone, doneLabel = 'Back') {
  if (dialog.open) dialog.close();
  const story = h('main', { id: 'story', class: 'journal' }, h('h2', { class: 'story-h' }, 'Previously'));
  let lastBook = null;
  for (const e of entries) {
    if (e.book !== lastBook) {
      const title = game.manifest.books.find((b) => b.id === e.book)?.title;
      if (title) story.append(h('h3', {}, title));
      lastBook = e.book;
    }
    if (e.title && e.title !== game.manifest.books.find((b) => b.id === e.book)?.title) story.append(h('h4', {}, e.title));
    for (const para of String(e.text).split(/\n+/)) story.append(h('p', {}, inline(para)));
  }
  const btn = h('button', { class: 'primary', onclick: () => onDone() }, doneLabel);
  app.replaceChildren(story, h('div', { class: 'actions' }, btn));
  window.scrollTo(0, 0);
  btn.focus({ preventScroll: true });
}

// ---- story ---------------------------------------------------------------------------------------

async function loadAndShow(slot) {
  const { notices } = await game.loadSlot(slot);
  showFrame();
  if (notices.length) toast(notices.join(' '));
}

function showFrame() {
  const frame = game.frame;
  const meta = game.chapterMeta[game.state.chapter];
  const story = h('main', { id: 'story' });
  for (const p of frame.paragraphs) {
    if (p.kind === 'h') story.append(h('h2', { class: 'story-h' }, inline(p.text)));
    else if (p.kind === 'quote') story.append(h('blockquote', {}, inline(p.text)));
    else story.append(h('p', {}, inline(p.text)));
  }

  const actions = h('div', { class: 'actions' });
  let first;
  if (frame.wait === 'choices') {
    frame.choices.forEach((c, index) => {
      const b = h('button', { class: 'choice', onclick: () => guard(async () => { await game.choose(index); showFrame(); }) }, inline(c.text));
      first ??= b;
      actions.append(b);
    });
  } else if (frame.wait === 'book_end') {
    const book = game.manifest.books.find((b) => b.id === frame.book);
    const next = frame.nextBook ? game.manifest.books.find((b) => b.id === frame.nextBook) : null;
    story.append(h('h2', { class: 'story-h' }, `The end of ${book?.title ?? 'this book'}`));
    story.append(h('p', { class: 'info' }, 'Your story is kept so the next book can carry it on. Save to a slot from the menu to keep this ending as well.'));
    if (next?.chapters?.length) {
      first = h('button', { class: 'primary', onclick: () => guard(async () => { await game.continueToNextBook(); const j = game.state.journal ?? []; if (j.length) showPreviously(j, () => showFrame(), 'Begin'); else showFrame(); }) }, `Continue to ${next.title}`);
      actions.append(first);
    }
    const lib = h('button', { class: next?.chapters?.length ? '' : 'primary', onclick: () => showLibrary() }, 'Back to the library');
    first ??= lib;
    actions.append(lib);
  } else {
    first = h('button', { class: 'primary', onclick: () => guard(async () => { await game.continue(); showFrame(); }) }, 'Continue');
    actions.append(first);
  }

  app.replaceChildren(
    h('div', { class: 'bar' },
      h('span', { class: 'title' }, frame.wait === 'book_end' ? '' : meta?.title ?? ''),
      h('button', { class: 'small', onclick: () => openMenu() }, 'Menu')),
    story,
    actions,
  );
  window.scrollTo(0, 0);
  first?.focus({ preventScroll: true });
  if (game.lastSaveError) toast(game.lastSaveError.message, true);
}

// ---- saves dialog --------------------------------------------------------------------------------

function openMenu() {
  renderSaves();
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function statusSection() {
  const lines = game.status();
  if (!lines.length) return [];
  return [h('h2', {}, 'How you are'), h('div', { class: 'status' }, ...lines.map((l) => h('p', {}, h('span', { class: 'label' }, l.label), l.text)))];
}

function renderSaves() {
  const inStory = Boolean(game.state && game.frame);
  const playing = inStory; // saving at the end of a book keeps that ending for starting the next one
  const rows = game.saves.list().map((s) => {
    const canSave = playing && (s.slot === 'quick' || MANUAL_SLOTS.includes(s.slot));
    let info = 'Empty';
    if (s.corrupt) info = 'Damaged and unreadable';
    else if (!s.empty) {
      info = `${s.meta?.chapterTitle ?? 'Saved game'}, ${new Date(s.savedAt).toLocaleString()}`;
      if (s.newer) info += ' (made by a newer version; update the app)';
      if (s.usedBackup) info += ' (restored from backup)';
    }
    return h('div', { class: `slot${s.corrupt || s.newer ? ' warn' : ''}` },
      h('div', { class: 'name' }, slotName(s.slot)),
      h('div', { class: 'info' }, info),
      canSave ? h('button', { class: 'small', onclick: () => doSave(s.slot) }, 'Save here') : null,
      !s.empty && !s.corrupt && !s.newer ? h('button', { class: 'small', onclick: () => { dialog.close(); guard(() => loadAndShow(s.slot)); } }, 'Load') : null,
      !s.empty ? h('button', { class: 'small danger', onclick: () => { if (confirm(`Delete ${slotName(s.slot)}?`)) { game.saves.delete(s.slot); renderSaves(); } } }, 'Delete') : null);
  });

  const area = h('textarea', { placeholder: 'Paste exported save text here to import', 'aria-label': 'Import save text' });
  const fileInput = h('input', { type: 'file', accept: '.json,.txt,application/json', hidden: true,
    onchange: async (e) => { const f = e.target.files[0]; if (f) doImport(await f.text()); } });

  dialog.replaceChildren(
    ...(inStory && app.querySelector('#story') ? statusSection() : []),
    h('h2', {}, 'Saves'),
    ...rows,
    h('h2', {}, 'Backup'),
    h('p', { class: 'info' }, 'Export all saves to a file you can keep or move to another device.'),
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => doExport() }, 'Export to file'),
      h('button', { class: 'small', onclick: () => doCopy() }, 'Copy to clipboard'),
      h('button', { class: 'small', onclick: () => fileInput.click() }, 'Import from file'),
      fileInput),
    area,
    h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => doImport(area.value) }, 'Import pasted text')),
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => { dialog.close(); showLibrary(); } }, 'Library'),
      h('button', { class: 'small', onclick: () => dialog.close() }, 'Close')),
  );
}

function doSave(slot) {
  try {
    game.saveToSlot(slot);
    toast(`Saved to ${slotName(slot)}.`);
    renderSaves();
  } catch (e) {
    toast(e.message, true);
  }
}

function doExport() {
  const blob = new Blob([game.saves.exportText()], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `sixth-blood-saves-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function doCopy() {
  try {
    await navigator.clipboard.writeText(game.saves.exportText());
    toast('Copied. Paste it somewhere safe.');
  } catch {
    toast('Copy was blocked; use Export to file instead.', true);
  }
}

function doImport(text) {
  try {
    const report = game.saves.importText(text);
    const skipped = report.skipped.length ? ` ${report.skipped.length} skipped (${report.skipped.map((s) => s.reason).join(', ')}).` : '';
    toast(`Imported ${report.imported.length} save(s).${skipped}`);
    renderSaves();
  } catch (e) {
    toast(e.message, true);
  }
}

// ---- boot -------------------------------------------------------------------------------------------

/** ?dev in the address turns developer mode on (shows test books); ?dev=0 turns it off. */
function applyDevParam() {
  const q = new URLSearchParams(location.search);
  if (!q.has('dev')) return;
  const on = q.get('dev') !== '0';
  try { game.setSetting('dev', on); } catch { /* storage blocked */ }
  toast(on ? 'Developer mode on.' : 'Developer mode off.');
}

async function boot() {
  const { storage, persistent } = pickStorage();
  game = new Game({ loader: createFetchLoader(), storage });
  try {
    await game.init();
  } catch (e) {
    showError(e);
    return;
  }
  applyDevParam();
  showLibrary();
  if (!persistent) toast('Saving is blocked in this browser, so progress will be lost when you close the page.', true);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__game = game; // handy in the browser console while developing
}

boot();
