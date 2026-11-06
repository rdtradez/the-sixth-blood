// The developer panel (menu tab "Dev", shown only in developer mode: open the app with ?dev).
// Jump to any chapter or scene, set flags and stats, remember a moment and come back to it to test
// each branch of a choice, and run the branch explorer. The logic is in engine/dev.js.

import { h } from './dom.js';
import * as dev from '../engine/dev.js';

/**
 * @param ctx { redraw(), showFrame(), closeMenu(), toast(msg, isError) }
 */
export function devPanel(game, ctx) {
  const run = (fn) => async () => {
    try { await fn(); } catch (e) { console.error(e); ctx.toast(e.message, true); }
  };
  const chapters = dev.chapterList(game);
  const current = game.state?.chapter && chapters.some((c) => c.id === game.state.chapter) ? game.state.chapter : chapters[0]?.id;

  const chapterSelect = (label, value) => {
    const sel = h('select', { 'aria-label': label });
    const byBook = new Map();
    for (const c of chapters) {
      if (!byBook.has(c.bookId)) byBook.set(c.bookId, h('optgroup', { label: c.bookTitle }));
      byBook.get(c.bookId).append(h('option', { value: c.id }, `${c.index + 1}. ${c.title}`));
    }
    sel.append(...byBook.values());
    sel.value = value;
    return sel;
  };

  // ---- Jump
  const jumpSel = chapterSelect('Chapter', current);
  const sceneSel = h('select', { 'aria-label': 'Scene' }, h('option', { value: '' }, '(start of chapter)'));
  const loadScenes = run(async () => {
    const names = await dev.sceneList(game, jumpSel.value);
    sceneSel.replaceChildren(h('option', { value: '' }, '(start of chapter)'), ...names.map((n) => h('option', { value: n }, n)));
  });
  jumpSel.addEventListener('change', loadScenes);
  loadScenes();
  const keep = h('input', { type: 'checkbox', id: 'dev-keep' });
  keep.checked = Boolean(game.state);
  const jumpBox = [
    h('h3', {}, 'Jump to a chapter'),
    h('label', { class: 'field' }, 'Chapter', jumpSel),
    h('label', { class: 'field' }, 'Scene', sceneSel),
    h('label', { class: 'field' }, keep, ' Keep my current flags and stats (otherwise the book starts from its default history)'),
    h('div', { class: 'row' }, h('button', { class: 'small primary', onclick: run(async () => {
      await dev.jump(game, jumpSel.value, { scene: sceneSel.value || null, keep: keep.checked });
      ctx.closeMenu();
      ctx.showFrame();
    }) }, 'Go')),
  ];

  // ---- Variables
  const filter = h('input', { type: 'text', placeholder: 'Filter variables', 'aria-label': 'Filter variables' });
  const tableBox = h('div', {});
  const drawVars = () => {
    const q = filter.value.trim().toLowerCase();
    const rows = dev.listVars(game).filter((v) => !q || v.name.toLowerCase().includes(q));
    const table = h('table', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Value')));
    for (const v of rows) {
      const input = h('input', { type: 'text', value: String(v.value), 'aria-label': `Value of ${v.name}` });
      const apply = run(async () => {
        const r = dev.setVar(game, v.name, dev.parseValue(input.value));
        ctx.toast(r.warnings.length ? r.warnings.join(' ') : `${v.name} = ${r.value}`, r.warnings.length > 0);
        drawVars();
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
      input.addEventListener('change', apply);
      table.append(h('tr', {}, h('td', {}, h('code', {}, v.name), h('div', { class: `kind${v.kind === 'unregistered' ? ' bad' : ''}` }, v.kind)), h('td', {}, input)));
    }
    tableBox.replaceChildren(rows.length ? table : h('p', { class: 'empty' }, game.state ? 'No variables match.' : 'No game is in progress.'));
  };
  filter.addEventListener('input', drawVars);
  drawVars();
  const newName = h('input', { type: 'text', placeholder: 'name, e.g. hunger or spared_igniferi', 'aria-label': 'Variable name' });
  const newValue = h('input', { type: 'text', placeholder: 'value: true, false, 40 or text', 'aria-label': 'Variable value' });
  const varsBox = [
    h('h3', {}, 'Flags and stats'),
    h('div', { class: 'row' }, newName, newValue, h('button', { class: 'small', onclick: run(async () => {
      const r = dev.setVar(game, newName.value.trim(), dev.parseValue(newValue.value));
      ctx.toast(r.warnings.length ? r.warnings.join(' ') : `${r.name} = ${r.value}`, r.warnings.length > 0);
      drawVars();
    }) }, 'Set')),
    filter,
    tableBox,
  ];

  // ---- Branch snapshots
  const label = h('input', { type: 'text', value: 'A', maxlength: '12', 'aria-label': 'Snapshot label' });
  const snapBox = h('div', {});
  const drawSnaps = () => {
    const labels = dev.snapshotLabels(game);
    snapBox.replaceChildren(...labels.map((l) => h('div', { class: 'row' },
      h('span', { class: 'mono' }, `Moment "${l}"`),
      h('button', { class: 'small', onclick: run(async () => { await dev.restore(game, l); ctx.closeMenu(); ctx.showFrame(); }) }, 'Go back to it'))));
  };
  drawSnaps();
  const snapshots = [
    h('h3', {}, 'Test the branches of a choice'),
    h('p', { class: 'hint' }, 'Remember this moment, take one option, then come back and take another.'),
    h('div', { class: 'row' }, label, h('button', { class: 'small', onclick: run(async () => { dev.snapshot(game, label.value.trim() || 'A'); drawSnaps(); ctx.toast('Moment remembered.'); }) }, 'Remember this moment')),
    snapBox,
  ];

  // ---- Explorer
  const exploreSel = chapterSelect('Chapter to explore', current);
  const report = h('div', {});
  const explorer = [
    h('h3', {}, 'Explore every branch of a chapter'),
    h('p', { class: 'hint' }, 'Plays every choice on copies of a default history and lists what could not be reached or went wrong.'),
    h('div', { class: 'row' }, exploreSel, h('button', { class: 'small', onclick: run(async () => {
      report.replaceChildren(h('p', { class: 'hint' }, 'Exploring...'));
      const r = await dev.explore(game, exploreSel.value);
      const lines = [
        `${r.chapter}: ${r.paths} path(s)${r.truncated ? ' (stopped at the limit)' : ''}, ${r.optionsTaken}/${r.optionsTotal} choices, ends: ${r.endings.join(', ') || 'none'}`,
        ...r.untaken.map((o) => `never taken: "${o.text}" (scene ${o.scene}, line ${o.line})`),
        ...r.unreachedScenes.map((s) => `never reached: scene ${s}`),
        ...r.errors.map((e) => `ERROR: ${e.message}${e.trail.length ? `\n   after: ${e.trail.join(' > ')}` : ''}`),
      ];
      report.replaceChildren(h('div', { class: `report${r.errors.length ? ' bad' : ''}` }, lines.join('\n')));
    }) }, 'Explore')),
    report,
  ];

  const off = [
    h('h3', {}, 'Developer mode'),
    h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => { game.setSetting('dev', false); ctx.redraw(); ctx.toast('Developer mode off.'); } }, 'Turn developer mode off')),
  ];
  return [h('div', { class: 'dev' }, ...jumpBox, ...varsBox, ...snapshots, ...explorer, ...off)];
}
