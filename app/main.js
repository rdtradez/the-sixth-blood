// Minimal reader UI: start screen, story view, saves dialog. All game logic lives in engine/.
// The full library screen, settings, and look and feel arrive in later sessions.

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
    h('button', { class: 'primary', onclick: () => showStart() }, 'Back to start'),
  );
}

// ---- screens -----------------------------------------------------------------------------------

function showStart() {
  const latest = game.saves.latest();
  const kids = [h('h1', {}, 'The Sixth Blood'), h('p', { class: 'sub' }, 'A choice game')];
  if (latest) {
    kids.push(h('button', { class: 'primary', onclick: () => guard(() => loadAndShow(latest.slot)) },
      `Continue${latest.meta?.chapterTitle ? `: ${latest.meta.chapterTitle}` : ''}`));
  }
  for (const book of game.books()) {
    kids.push(h('button', { onclick: () => guard(() => startBook(book.id)) },
      book.title, book.dev ? h('span', { class: 'tag' }, 'dev') : null, book.completed ? h('span', { class: 'tag' }, 'finished') : null));
  }
  kids.push(h('button', { onclick: () => openSaves() }, 'Saves'));
  app.replaceChildren(...kids);
}

async function startBook(id) {
  await game.newGame({ book: id });
  showFrame();
}

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
    first = h('button', { class: 'primary', onclick: () => showStart() }, 'Back to start');
    actions.append(h('p', {}, 'The end of this book.'), first);
  } else {
    first = h('button', { class: 'primary', onclick: () => guard(async () => { await game.continue(); showFrame(); }) }, 'Continue');
    actions.append(first);
  }

  app.replaceChildren(
    h('div', { class: 'bar' },
      h('span', { class: 'title' }, meta?.title ?? ''),
      h('button', { class: 'small', onclick: () => openSaves() }, 'Menu')),
    story,
    actions,
  );
  window.scrollTo(0, 0);
  first?.focus({ preventScroll: true });
  if (game.lastSaveError) toast(game.lastSaveError.message, true);
}

// ---- saves dialog --------------------------------------------------------------------------------

function openSaves() {
  renderSaves();
  if (!dialog.open) dialog.showModal();
}

function renderSaves() {
  const playing = Boolean(game.state && game.frame && game.frame.wait !== 'book_end');
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
    h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => dialog.close() }, 'Close')),
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

async function boot() {
  const { storage, persistent } = pickStorage();
  game = new Game({ loader: createFetchLoader(), storage });
  try {
    await game.init();
  } catch (e) {
    showError(e);
    return;
  }
  showStart();
  if (!persistent) toast('Saving is blocked in this browser, so progress will be lost when you close the page.', true);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__game = game; // handy in the browser console while developing
}

boot();
