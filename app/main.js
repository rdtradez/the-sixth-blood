// Reader UI: title screen and library, book start options, Previously screen, story view, content
// notes, and the menu (status, people, family, codex, achievements, settings, saves, developer).
// All game logic lives in engine/; this file only draws it.

import { Game } from '../engine/game.js';
import { createFetchLoader } from '../engine/fetch-loader.js';
import { MemoryStorage, MANUAL_SLOTS } from '../engine/saves.js';
import { h, inline, svg, toast } from './dom.js';
import { titleSvg, ornamentSvg } from './art.js';
import { applySettings, settingsPanel } from './settings-ui.js';
import { youPanel, peoplePanel, familyPanel, codexPanel, achievementsPanel } from './panels.js';
import { devPanel } from './devpanel.js';

const app = document.getElementById('app');
const dialog = document.getElementById('dialog');

// ---- helpers -----------------------------------------------------------------------------

/** Each book sets its accent colors while it is read (and the library resets them). */
function applyBookTheme(bookId) {
  const book = bookId ? game.manifest.books.find((b) => b.id === bookId) : null;
  const root = document.documentElement.style;
  if (book?.accent) { root.setProperty('--accent', book.accent); root.setProperty('--accent2', book.accent2 ?? book.accent); }
  else { root.removeProperty('--accent'); root.removeProperty('--accent2'); }
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
  applyBookTheme(null);
  const latest = game.saves.latest();
  const kids = [
    h('div', { class: 'title-art' }, svg(titleSvg())),
    h('div', { class: 'title-block' }, h('h1', {}, 'The Sixth Blood'), h('p', { class: 'sub' }, 'Two thousand years. Seven cities. One bloodline.')),
  ];
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
  const row = h('div', { class: 'row center' }, h('button', { class: 'small', onclick: () => openMenu() }, 'Menu'));
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
    const box = e.kind === 'velati' ? h('section', { class: 'velati' }) : story;
    if (box !== story) story.append(box);
    if (e.title && e.title !== game.manifest.books.find((b) => b.id === e.book)?.title) box.append(h('h4', {}, e.title));
    // Velati journal entries keep their paragraph kinds (quotes from the watchers' records).
    const paras = e.paragraphs ?? String(e.text).split(/\n+/).map((text) => ({ text, kind: 'p' }));
    for (const p of paras) box.append(p.kind === 'quote' ? h('blockquote', {}, inline(p.text)) : h('p', {}, inline(p.text)));
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
  applyBookTheme(game.state.book);
  const earned = game.takeNewAchievements();
  if (earned.length) toast(`Achievement: ${earned.map((x) => x.title).join(', ')}`);
  const notes = game.pendingNotes();
  if (notes.length) { showNotes(notes); return; }

  const meta = game.chapterMeta[game.state.chapter];
  const book = game.manifest.books.find((b) => b.id === game.state.book);
  const story = h('main', { id: 'story', class: `fade${frame.opening ? ' opening' : ''}` });
  if (frame.opening && meta && frame.wait !== 'book_end') {
    const orn = svg(ornamentSvg());
    orn.setAttribute('class', 'ornament');
    story.append(h('header', { class: 'chapter-head' },
      h('p', { class: 'kicker' }, meta.index >= 0 ? `Chapter ${meta.index + 1}` : (book?.title ?? '')),
      h('h1', {}, meta.title),
      orn));
  }
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
    const endBook = game.manifest.books.find((b) => b.id === frame.book);
    const next = frame.nextBook ? game.manifest.books.find((b) => b.id === frame.nextBook) : null;
    story.append(h('h2', { class: 'story-h' }, `The end of ${endBook?.title ?? 'this book'}`));
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
  actions.append(h('div', { id: 'rewind-slot' }));

  app.replaceChildren(
    h('div', { class: 'bar' },
      h('span', { class: 'title' }, frame.wait === 'book_end' ? '' : book?.title ?? ''),
      h('button', { class: 'small', onclick: () => openMenu() }, 'Menu')),
    story,
    actions,
  );
  updateRewind();
  window.scrollTo(0, 0);
  first?.focus({ preventScroll: true });
  if (game.lastSaveError) toast(game.lastSaveError.message, true);
}

/** The "take back" button, shown only when Rewind is on and there is a choice to take back. */
function updateRewind() {
  const slot = document.getElementById('rewind-slot');
  if (!slot) return;
  slot.replaceChildren();
  if (game.canRewind()) {
    slot.append(h('button', { class: 'ghost', onclick: () => guard(async () => { await game.rewind(); showFrame(); }) }, 'Take back your last choice'));
  }
}

/** Heads up about heavy themes, shown before a chapter that has content notes (Settings, Content notes). */
function showNotes(notes) {
  const go = h('button', { class: 'primary', onclick: () => { game.ackNotes(); showFrame(); } }, 'Continue');
  app.replaceChildren(
    h('div', { class: 'notes-screen' },
      h('h1', {}, 'Before you read'),
      h('p', { class: 'sub' }, 'This chapter deals with:'),
      h('ul', {}, ...notes.map((n) => h('li', {}, h('strong', {}, n.label), n.text ? h('div', {}, n.text) : null)))),
    h('div', { class: 'actions' },
      go,
      h('button', { onclick: () => showLibrary() }, 'Back to the library'),
      h('button', { class: 'ghost', onclick: () => { game.setSetting('contentNotes', false); game.ackNotes(); showFrame(); } }, 'Stop showing content notes')),
  );
  window.scrollTo(0, 0);
  go.focus({ preventScroll: true });
}

// ---- menu ------------------------------------------------------------------------------------------

const inStory = () => Boolean(game.state && game.frame && app.querySelector('#story'));

function menuTabs() {
  return [
    { id: 'you', label: 'You', show: inStory() },
    { id: 'people', label: 'People' },
    { id: 'family', label: 'Family' },
    { id: 'codex', label: 'Codex' },
    { id: 'deeds', label: 'Achievements' },
    { id: 'settings', label: 'Settings' },
    { id: 'saves', label: 'Saves' },
    { id: 'dev', label: 'Dev', show: game.devMode },
  ].filter((t) => t.show !== false);
}

let menuTab = 'saves';

function openMenu(tab) {
  const tabs = menuTabs();
  menuTab = tabs.some((t) => t.id === tab) ? tab : tabs.some((t) => t.id === menuTab) ? menuTab : tabs[0].id;
  if (!tab && inStory() && menuTab === 'saves') menuTab = 'you';
  renderMenu();
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function renderMenu(keepScroll = false) {
  const tabs = menuTabs();
  const top = dialog.scrollTop;
  const bar = h('div', { class: 'tabs', role: 'tablist' }, ...tabs.map((t) => h('button', {
    class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(t.id === menuTab),
    onclick: () => { menuTab = t.id; renderMenu(); dialog.scrollTop = 0; },
  }, t.label)));
  const panels = {
    you: () => youPanel(game),
    people: () => peoplePanel(game),
    family: () => familyPanel(game),
    codex: () => codexPanel(game),
    deeds: () => achievementsPanel(game),
    settings: () => settingsPanel(game, () => renderMenu(true)),
    saves: () => savesPanel(),
    dev: () => devPanel(game, { redraw: () => renderMenu(), showFrame, closeMenu: () => dialog.close(), toast }),
  };
  const body = h('div', { role: 'tabpanel' }, ...(panels[menuTab] ?? panels.saves)());
  dialog.replaceChildren(bar, body, h('div', { class: 'row' },
    h('button', { class: 'small', onclick: () => { dialog.close(); showLibrary(); } }, 'Library'),
    h('button', { class: 'small', onclick: () => dialog.close() }, 'Close')));
  if (keepScroll) dialog.scrollTop = top;
}

dialog.addEventListener('close', () => updateRewind());

function savesPanel() {
  const playing = inStory(); // saving at the end of a book keeps that ending for starting the next one
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
      !s.empty ? h('button', { class: 'small danger', onclick: () => { if (confirm(`Delete ${slotName(s.slot)}?`)) { game.saves.delete(s.slot); renderMenu(true); } } }, 'Delete') : null);
  });

  const area = h('textarea', { placeholder: 'Paste exported save text here to import', 'aria-label': 'Import save text' });
  const fileInput = h('input', { type: 'file', accept: '.json,.txt,application/json', hidden: true,
    onchange: async (e) => { const f = e.target.files[0]; if (f) doImport(await f.text()); } });

  return [
    h('h2', {}, 'Saves'),
    ...rows,
    h('h2', {}, 'Backup'),
    h('p', { class: 'hint' }, 'Export all saves, achievements and settings to a file you can keep or move to another device.'),
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => doExport() }, 'Export to file'),
      h('button', { class: 'small', onclick: () => doCopy() }, 'Copy to clipboard'),
      h('button', { class: 'small', onclick: () => fileInput.click() }, 'Import from file'),
      fileInput),
    area,
    h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => doImport(area.value) }, 'Import pasted text')),
  ];
}

function doSave(slot) {
  try {
    game.saveToSlot(slot);
    toast(`Saved to ${slotName(slot)}.`);
    renderMenu(true);
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
    applySettings(game);
    renderMenu(true);
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
  applySettings(game);
  showLibrary();
  if (!persistent) toast('Saving is blocked in this browser, so progress will be lost when you close the page.', true);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__game = game; // handy in the browser console while developing
}

boot();
