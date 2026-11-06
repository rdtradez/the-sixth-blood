import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager, MemoryStorage, MANUAL_SLOTS } from '../engine/saves.js';
import { SaveError } from '../engine/util.js';
import { checkContentMigrations } from '../engine/versioning.js';

const make = (over = {}) =>
  new SaveManager({ storage: new MemoryStorage(), schema: 1, contentVersion: 1, now: () => 500, ...over });

const state = (extra = {}) => ({ chapter: 'c1', vars: { gold: 3 }, ...extra });

test('save then load round trips exactly', () => {
  const m = make();
  m.save('1', state(), { chapterTitle: 'One' });
  const out = m.load('1');
  assert.deepEqual(out.state, state());
  assert.equal(out.meta.chapterTitle, 'One');
  assert.equal(out.savedAt, 500);
});

test('empty slot, unknown slot', () => {
  const m = make();
  assert.throws(() => m.load('2'), (e) => e instanceof SaveError && e.code === 'empty');
  assert.throws(() => m.save('99', state()), (e) => e.code === 'bad_slot');
});

test('a damaged slot falls back to the previous save', () => {
  const m = make();
  m.save('1', state({ vars: { gold: 1 } }));
  m.save('1', state({ vars: { gold: 2 } }));
  const key = 'tsb:slot:1';
  const env = JSON.parse(m.storage.getItem(key));
  env.payload = env.payload.replace('2', '9'); // tamper without fixing the checksum
  m.storage.setItem(key, JSON.stringify(env));
  const out = m.load('1');
  assert.equal(out.state.vars.gold, 1);
  assert.match(out.notices[0], /previous copy/);
});

test('damaged with no backup is reported as corrupt', () => {
  const m = make();
  m.storage.setItem('tsb:slot:1', '{not json');
  assert.throws(() => m.load('1'), (e) => e.code === 'corrupt');
  assert.deepEqual(m.list().find((s) => s.slot === '1'), { slot: '1', empty: false, corrupt: true });
});

test('list shows empty, filled, and latest picks the newest', () => {
  let t = 100;
  const m = make({ now: () => t++ });
  m.save('auto', state());
  m.save('3', state());
  const list = m.list();
  assert.equal(list.find((s) => s.slot === '2').empty, true);
  assert.equal(m.latest().slot, '3');
});

test('storage failure is reported as a SaveError', () => {
  const storage = new MemoryStorage();
  storage.setItem = () => { throw new Error('quota'); };
  const m = make({ storage });
  assert.throws(() => m.save('1', state()), (e) => e instanceof SaveError && e.code === 'storage_full');
});

// ---- versioning ------------------------------------------------------------------

test('schema migrations run in order from the save version', () => {
  const old = make({ schema: 1 });
  old.save('1', { vars: { hp: 5 } });
  const next = new SaveManager({
    storage: old.storage, schema: 3, contentVersion: 1,
    schemaMigrations: {
      1: (s) => { s.vars.health = s.vars.hp; delete s.vars.hp; return s; },
      2: (s) => { s.vars.health += 1; return s; },
    },
  });
  const out = next.load('1');
  assert.deepEqual(out.state.vars, { health: 6 });
  assert.equal(out.upgraded, true);
});

test('content migrations apply only the ones after the save, in version order', () => {
  const old = make({ contentVersion: 2 });
  old.save('1', { vars: { a: 1 } });
  const calls = [];
  const migrations = [
    { version: 4, note: 'four', up: (s) => { calls.push(4); s.vars.d = 1; return s; } },
    { version: 2, note: 'two (already applied)', up: () => { calls.push(2); } },
    { version: 3, note: 'three', up: (s) => { calls.push(3); s.vars.c = 1; return s; } },
  ];
  const next = new SaveManager({ storage: old.storage, schema: 1, contentVersion: 4, contentMigrations: migrations });
  const out = next.load('1');
  assert.deepEqual(calls, [3, 4]);
  assert.deepEqual(out.notices, ['three', 'four']);
  assert.deepEqual(out.state.vars, { a: 1, c: 1, d: 1 });
});

test('a save from a newer app is refused, never guessed at', () => {
  const newer = make({ schema: 2, contentVersion: 5 });
  newer.save('1', state());
  const older = new SaveManager({ storage: newer.storage, schema: 1, contentVersion: 5 });
  assert.throws(() => older.load('1'), (e) => e.code === 'newer_schema');
  const older2 = new SaveManager({ storage: newer.storage, schema: 2, contentVersion: 4 });
  assert.throws(() => older2.load('1'), (e) => e.code === 'newer_content');
  assert.equal(older2.list().find((s) => s.slot === '1').newer, true);
  assert.equal(older2.latest(), null);
});

test('a missing schema migration is an explicit error', () => {
  const old = make({ schema: 1 });
  old.save('1', state());
  const next = new SaveManager({ storage: old.storage, schema: 2, contentVersion: 1 });
  assert.throws(() => next.load('1'), (e) => e.code === 'missing_migration');
});

test('migration list sanity checks', () => {
  assert.deepEqual(checkContentMigrations([], 1), []);
  const problems = checkContentMigrations([{ version: 2, up() {} }, { version: 2, up() {} }, { version: 9, up() {} }, { version: 3 }], 3);
  assert.equal(problems.length, 3);
});

// ---- export and import -------------------------------------------------------------

test('export and import move saves and progress between devices', () => {
  const a = make();
  a.save('1', state({ vars: { gold: 1 } }), { chapterTitle: 'One' });
  a.save('quick', state({ vars: { gold: 2 } }));
  a.setProfile({ ...a.getProfile(), completedBooks: { b1: 123 } });
  const text = a.exportText();

  const b = make();
  const report = b.importText(text);
  assert.equal(report.imported.length, 2);
  assert.equal(b.load('1').state.vars.gold, 1);
  assert.equal(b.load('quick').state.vars.gold, 2);
  assert.deepEqual(b.getProfile().completedBooks, { b1: 123 });
});

test('import does not overwrite a used manual slot; it uses the next free one', () => {
  const a = make();
  a.save('1', state({ vars: { gold: 10 } }));
  const text = a.exportText();
  const b = make();
  b.save('1', state({ vars: { gold: 99 } }));
  const report = b.importText(text);
  assert.deepEqual(report.imported, [{ from: '1', to: '2' }]);
  assert.equal(b.load('1').state.vars.gold, 99);
  assert.equal(b.load('2').state.vars.gold, 10);
});

test('import with overwrite replaces; full slots skip with a reason', () => {
  const a = make();
  a.save('1', state({ vars: { gold: 10 } }));
  const text = a.exportText();
  const b = make();
  b.save('1', state({ vars: { gold: 99 } }));
  b.importText(text, { overwrite: true });
  assert.equal(b.load('1').state.vars.gold, 10);

  const c = make();
  for (const s of MANUAL_SLOTS) c.save(s, state());
  const report = c.importText(text);
  assert.equal(report.imported.length, 0);
  assert.equal(report.skipped[0].reason, 'no free slot');
});

test('import rejects damaged, foreign, and newer files', () => {
  const a = make();
  a.save('1', state());
  const text = a.exportText();
  const b = make();
  assert.throws(() => b.importText('hello'), (e) => e.code === 'corrupt');
  assert.throws(() => b.importText('{"format":"other"}'), (e) => e.code === 'corrupt');
  const wrapper = JSON.parse(text);
  wrapper.data = wrapper.data.replace('c1', 'c2');
  assert.throws(() => b.importText(JSON.stringify(wrapper)), (e) => e.code === 'corrupt');
  const newer = make({ schema: 3 });
  newer.save('1', state());
  assert.throws(() => b.importText(newer.exportText()), (e) => e.code === 'newer_schema');
});

test('imported old saves are upgraded when opened, not when imported', () => {
  const old = make({ schema: 1, contentVersion: 1 });
  old.save('1', { vars: { x: 1 } });
  const text = old.exportText();
  const current = make({
    schema: 1, contentVersion: 2,
    contentMigrations: [{ version: 2, up: (s) => { s.vars.y = 2; return s; } }],
  });
  current.importText(text);
  assert.deepEqual(current.load('1').state.vars, { x: 1, y: 2 });
});
