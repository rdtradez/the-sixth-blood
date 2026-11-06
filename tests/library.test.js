import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, texts, STATS } from './helpers.js';
import { MemoryStorage, SaveManager, carrySlot } from '../engine/saves.js';
import { SCHEMA, SCHEMA_MIGRATIONS } from '../engine/state.js';
import { SAVE_FORMAT } from '../engine/versioning.js';
import { fnv1a } from '../engine/util.js';

const HEAD = (id, book) => `@chapter ${id}\n@title ${id}\n@book ${book}\n`;

/** A three book series plus a developer book, with registry flags and origins. */
function seriesLoader() {
  const files = {
    'a1.tsb': `${HEAD('a1', 'one')}
# start
Book one begins, {name}.
* Spare the hunter
  $ flag spared
* Kill the hunter
  $ unflag spared
$ fate = "sold"
$ do journal("The hunter's fate was decided.")
---
=> endbook`,
    'b1.tsb': `${HEAD('b1', 'two')}
# start
Book two. Spared: {spared}. Fate: {fate}. Age {age}. Quick: {quick_start}.
---
=> endbook`,
    'c1.tsb': `${HEAD('c1', 'three')}
# start
Book three.
---
=> endbook`,
    'd1.tsb': `${HEAD('d1', 'dev')}
# start
Dev.
---
=> endbook`,
  };
  const manifest = {
    contentVersion: 1,
    books: [
      { id: 'one', number: 1, title: 'One', city: 'Rome', era: '64 AD', recap: 'Rome burned.', chapters: [{ id: 'a1', file: 'a1.tsb', title: 'A1' }] },
      { id: 'two', number: 2, title: 'Two', city: 'Florence', era: '1474', quickstart: { vars: { age: 2 } }, chapters: [{ id: 'b1', file: 'b1.tsb', title: 'B1' }] },
      { id: 'three', number: 3, title: 'Three', chapters: [{ id: 'c1', file: 'c1.tsb', title: 'C1' }] },
      { id: 'four', number: 4, title: 'Four', chapters: [] },
      { id: 'dev', dev: true, title: 'Dev', chapters: [{ id: 'd1', file: 'd1.tsb', title: 'D1' }] },
    ],
  };
  const json = {
    flags: { flags: {
      spared: { kind: 'flag', book: 'one', major: true, default: true },
      fate: { kind: 'enum', values: ['kept', 'sold'], book: 'one', major: true, default: 'kept' },
      quick_start: { kind: 'flag' },
    } },
    people: { people: { hero: { gender: 'm', name: 'Gaius' } } },
    origins: { origins: [{ id: 'roman', names: { m: ['Titus'], f: ['Julia'] }, roles: ['merchant'] }, { id: 'briton', names: { m: ['Segovax'], f: ['Brica'] } }], roles: [{ id: 'legionary' }, { id: 'merchant' }], paths: [{ id: 'born_in_rome' }] },
  };
  return {
    manifest: async () => structuredClone(manifest),
    stats: async () => ({ ...STATS, age: { min: 1, max: 10, start: 1, int: true } }),
    chapterSource: async (f) => files[f],
    migrations: async () => [],
    json: async (name) => json[name] ?? null,
  };
}

async function playToEnd(game, pick = 0) {
  let frame = game.frame;
  while (frame.wait !== 'book_end') frame = frame.wait === 'choices' ? await game.choose(pick) : await game.continue();
  return frame;
}

test('books unlock in order, dev books stay hidden outside developer mode', async () => {
  const game = await makeGame(seriesLoader());
  const lib = game.library();
  assert.deepEqual(lib.map((b) => [b.id, b.unlocked, b.written]), [['one', true, true], ['two', false, true], ['three', false, true], ['four', false, false]]);
  await assert.rejects(game.startBook('two', { from: 'quick' }), /unlocks when you finish "One"/);
  await assert.rejects(game.startBook('four', { from: 'quick' }), /not written yet/);
  game.setSetting('dev', true);
  assert.equal(game.library().at(-1).id, 'dev');
  assert.ok(game.library().find((b) => b.id === 'dev').unlocked);
});

test('finishing a book records progress, keeps a carry, and the next book continues the story', async () => {
  const game = await makeGame(seriesLoader());
  const { frame } = await game.startBook('one', { from: 'new', hero: { gender: 'f', origin: 'briton', name: 'Brica' } });
  assert.deepEqual(texts(frame), ['Book one begins, Brica.']);
  const end = await playToEnd(game, 0);
  assert.equal(end.nextBook, 'two');
  assert.deepEqual(game.state.booksDone, ['one']);
  const lib = game.library();
  assert.ok(lib[0].completed);
  assert.equal(lib[0].reached, 0);
  assert.ok(lib[1].unlocked);
  assert.equal(lib[1].carry.slot, carrySlot('one'));
  assert.equal(lib[1].carry.meta.hero, 'Brica');

  const next = await game.continueToNextBook();
  assert.deepEqual(texts(next.frame), ['Book two. Spared: yes. Fate: sold. Age 1. Quick: 0.']);
  assert.equal(game.state.vars['hero.name'], 'Brica');
  assert.deepEqual(game.state.journal.map((j) => j.text), ["The hunter's fate was decided."]);
  assert.deepEqual(game.state.decisions.map((d) => [d.name, d.value]), [['spared', true], ['fate', 'sold']]);
});

test('a later book can begin from the carry or from a save made at the previous ending', async () => {
  const storage = new MemoryStorage();
  const game = await makeGame(seriesLoader(), { storage });
  await game.startBook('one', { from: 'new' });
  await playToEnd(game, 1); // kill the hunter
  game.saveToSlot('2'); // keep this ending in a manual slot
  await game.startBook('one', { from: 'new' });
  await playToEnd(game, 0); // a second playthrough spares him; the carry now holds this one

  const starts = game.startSaves('two');
  assert.deepEqual(starts.map((s) => [s.slot, s.carry]), [[carrySlot('one'), true], ['auto', false], ['2', false]]);

  const fromCarry = await game.startBook('two', { from: 'carry' });
  assert.match(texts(fromCarry.frame)[0], /Spared: yes/);
  const fromSlot = await game.startBook('two', { from: 'slot', slot: '2' });
  assert.match(texts(fromSlot.frame)[0], /Spared: 0/);
  await assert.rejects(game.startBook('two', { from: 'slot', slot: 'chapter' }), /not at the end of "One"/);
  await assert.rejects(game.startBook('one', { from: 'carry' }), /first book/);
  await assert.rejects(game.startBook('two', { from: 'new' }), /from your story so far/);
});

test('quick start gives a default history: earlier books done, registry defaults, recaps, book vars', async () => {
  const game = await makeGame(seriesLoader());
  game.setSetting('dev', true); // developer mode may start locked books
  const { frame } = await game.startBook('two', { from: 'quick', hero: { gender: 'f', origin: 'roman' } });
  assert.deepEqual(texts(frame), ['Book two. Spared: yes. Fate: kept. Age 2. Quick: yes.']);
  const st = game.state;
  assert.deepEqual(st.booksDone, ['one']);
  assert.equal(st.vars['hero.name'], 'Julia');
  assert.equal(st.vars['hero.role'], 'merchant'); // the origin's suggestion
  assert.equal(st.vars['hero.path'], 'born_in_rome');
  assert.deepEqual(st.journal.map((j) => [j.book, j.text]), [['one', 'Rome burned.']]);
  assert.ok(st.decisions.every((d) => d.quick));
  assert.deepEqual(game.suggestNames('briton', 'f'), ['Brica']);
});

test('quick start never unlocks books for the profile', async () => {
  const game = await makeGame(seriesLoader());
  game.setSetting('dev', true);
  await game.startBook('two', { from: 'quick' });
  await playToEnd(game);
  game.setSetting('dev', false);
  // Two was finished, so Three opens; One stays as it was (it was never played).
  const lib = game.library();
  assert.equal(lib.find((b) => b.id === 'one').completed, false);
  assert.equal(lib.find((b) => b.id === 'three').unlocked, true);
});

test('status() describes stats in story voice and leaves hidden ones out', async () => {
  const loader = seriesLoader();
  const base = loader.json;
  loader.json = async (name) => (name === 'voice'
    ? { stats: {
      hunger: { label: 'Hunger', bands: [{ id: 'low', upTo: 50, say: 'quiet', status: 'You are fed.' }, { id: 'high', say: 'loud', status: 'You starve.' }] },
      age: { hidden: true, bands: [{ id: 'young', say: 'young', status: 'Young.' }] },
    } }
    : base(name));
  const game = await makeGame(loader);
  await game.startBook('one', { from: 'new' });
  assert.deepEqual(game.status(), [{ stat: 'hunger', label: 'Hunger', text: 'You are fed.' }]);
});

test('schema 1 saves upgrade to schema 2 with a decision log, journal and finished books', async () => {
  assert.equal(SCHEMA, 2);
  const storage = new MemoryStorage();
  const game = await makeGame(seriesLoader(), { storage });
  await game.startBook('one', { from: 'new' });
  await playToEnd(game);
  // Rewrite the autosave as a session 1 save: no decisions, journal or booksDone.
  const old = JSON.parse(storage.getItem('tsb:slot:auto'));
  const state = JSON.parse(old.payload);
  delete state.decisions; delete state.journal; delete state.booksDone;
  const payload = JSON.stringify(state);
  storage.setItem('tsb:slot:auto', JSON.stringify({ ...old, format: SAVE_FORMAT, schema: 1, payload, checksum: fnv1a(payload) }));

  const fresh = await makeGame(seriesLoader(), { storage });
  const { frame } = await fresh.loadSlot('auto');
  assert.equal(frame.wait, 'book_end');
  assert.equal(frame.nextBook, 'two');
  assert.deepEqual(fresh.state.decisions, []);
  assert.deepEqual(fresh.state.journal, []);
  assert.deepEqual(fresh.state.booksDone, ['one']);
  assert.ok(fresh.startSaves('two').some((s) => s.slot === 'auto'));
  assert.deepEqual(SCHEMA_MIGRATIONS[1]({ frame: null }), { frame: null, decisions: [], journal: [], booksDone: [] });
});

test('carry records travel in exports; the newer copy wins on import', async () => {
  const a = new MemoryStorage();
  const game = await makeGame(seriesLoader(), { storage: a });
  await game.startBook('one', { from: 'new', hero: { name: 'Titus' } });
  await playToEnd(game);
  const text = game.saves.exportText();

  const b = new MemoryStorage();
  const other = await makeGame(seriesLoader(), { storage: b, now: () => 1 });
  const report = other.saves.importText(text);
  assert.ok(report.imported.some((r) => r.to === carrySlot('one')));
  assert.equal(other.profile.reached.one, 0);
  assert.ok(other.library()[1].unlocked);
  const again = other.saves.importText(text);
  assert.ok(again.skipped.some((s) => s.slot === carrySlot('one') && /newer/.test(s.reason)));

  const mgr = new SaveManager({ storage: new MemoryStorage(), schema: SCHEMA, contentVersion: 1 });
  const bogus = mgr.importText(JSON.stringify({ format: 'tsb-export', schema: SCHEMA, checksum: fnv1a('{"slots":{"evil":{}}}'), data: '{"slots":{"evil":{}}}' }));
  assert.deepEqual(bogus.skipped, [{ slot: 'evil', reason: 'unknown slot' }]);
});

test('the real content plays the developer books with the session 2 systems and no warnings', async () => {
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { createNodeLoader } = await import('../engine/node-loader.js');
  const { Game } = await import('../engine/game.js');
  const root = join(fileURLToPath(import.meta.url), '../..');
  const warnings = [];
  const game = new Game({ loader: createNodeLoader(root), storage: new MemoryStorage(), warn: (m) => warnings.push(m), now: () => 7 });
  await game.init();
  assert.equal(game.library().length, 7, 'seven story books, dev books hidden');
  game.setSetting('dev', true);
  await game.startBook('engine-test', { from: 'new', seed: 2 });
  await playToEnd(game);
  const { frame } = await game.continueToNextBook();
  assert.match(texts(frame).join(' '), /took the left door/);
  let f = await game.continue();
  assert.match(texts(f).join(' '), /You are Gaius, Gaius to the city, of the Valerius family/);
  await playToEnd(game);
  assert.equal(game.state.journal.at(-1).text, 'The engine test reached its second book.');
  assert.deepEqual(warnings, []);
});
