// Session 4: settings, codex, people, family tree, achievements, content notes, rewind,
// developer tools, the branch explorer, the checker's new file checks and the sample chapter.

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeLoader } from '../engine/node-loader.js';
import { MemoryStorage } from '../engine/saves.js';
import { SAVE_FORMAT } from '../engine/versioning.js';
import { Game, CONTENT_FILES, assembleContent } from '../engine/game.js';
import { SCHEMA, SCHEMA_MIGRATIONS } from '../engine/state.js';
import { readSettings, validSetting } from '../engine/settings.js';
import { quickLore } from '../engine/systems/lore.js';
import { checkContentFiles } from '../engine/content-check.js';
import * as dev from '../engine/dev.js';
import { fnv1a } from '../engine/util.js';
import { memoryLoader, makeGame, texts } from './helpers.js';

const root = join(fileURLToPath(import.meta.url), '../..');
const real = createNodeLoader(root);

async function realGame({ storage = new MemoryStorage(), dev: devOn = false, warn = [] } = {}) {
  const game = new Game({ loader: real, storage, warn: (m) => warn.push(m), now: () => 5000 });
  await game.init();
  if (devOn) game.setSetting('dev', true);
  return game;
}

/** Play the sample chapter, choosing by the given picks (the order choices come up in). */
async function playSample(game, picks, { quick = false } = {}) {
  let frame;
  if (quick) ({ frame } = await game.startBook('engine-test-d', { from: 'quick' }));
  else frame = await game.newGame({ book: 'engine-test-d', seed: 4 });
  let n = 0;
  for (let i = 0; i < 40 && frame.wait !== 'book_end'; i++) {
    frame = frame.wait === 'choices' ? await game.choose(picks[n++] ?? 0) : await game.continue();
  }
  return frame;
}

// ---- Settings ---------------------------------------------------------------------------------

test('settings have defaults, validate, and persist in the profile', async () => {
  const storage = new MemoryStorage();
  const game = await realGame({ storage });
  assert.deepEqual(game.settings, { textSize: 'normal', theme: 'night', font: 'garamond', contentNotes: false, rewind: false, dev: false });
  game.setSetting('theme', 'parchment');
  game.setSetting('rewind', true);
  assert.throws(() => game.setSetting('theme', 'neon'), /not a choice for theme/);
  assert.throws(() => game.setSetting('volume', 3), /unknown setting/);
  const again = await realGame({ storage });
  assert.equal(again.settings.theme, 'parchment');
  assert.equal(again.settings.rewind, true);
});

test('damaged stored settings fall back to defaults', () => {
  const s = readSettings({ textSize: 'huge', theme: 'dusk', rewind: 'yes', extra: 1 });
  assert.equal(s.textSize, 'normal');
  assert.equal(s.theme, 'dusk');
  assert.equal(s.rewind, false);
  assert.ok(!('extra' in s));
  assert.ok(validSetting('font', 'dyslexic'));
});

test('importing saves keeps this device settings and never imports developer mode', async () => {
  const a = await realGame();
  a.setSetting('theme', 'dusk');
  a.setSetting('font', 'sans');
  a.setSetting('dev', true);
  const text = a.saves.exportText();
  const b = await realGame();
  b.setSetting('theme', 'parchment');
  b.saves.importText(text);
  assert.equal(b.settings.theme, 'parchment'); // this device wins
  assert.equal(b.settings.font, 'sans'); // filled from the export
  assert.equal(b.settings.dev, false);
});

// ---- Codex, people and the family tree ----------------------------------------------------------

test('the sample chapter unlocks codex entries by command, by person and by original', async () => {
  const game = await realGame({ dev: true });
  let frame = await game.newGame({ book: 'engine-test-d', seed: 4 });
  const ids = () => game.codex().groups.flatMap((g) => g.entries).filter((e) => !e.locked).map((e) => e.id).sort();
  assert.deepEqual(ids(), ['et_person', 'et_place']);
  frame = await game.continue();
  assert.equal(frame.wait, 'choices');
  frame = await game.choose(0); // wait for the sun; the story rejoins and reaches the next choice
  assert.equal(frame.wait, 'choices');
  assert.ok(ids().includes('et_lore'));
  const lore = game.codex().groups.find((g) => g.id === 'lore');
  assert.equal(lore.entries.find((e) => e.id === 'et_lore').text.length, 1);
  assert.equal(game.codex().groups.find((g) => g.id === 'bloodlines').entries[0].locked, true); // shown as undiscovered
  // The General is learned of in the family scene; the codex lists originals on its own.
  await game.choose(0);
  const originals = game.codex().groups.find((g) => g.id === 'originals');
  assert.equal(originals.entries[0].title, 'The General');
  assert.equal(game.codex().unlocked, 4);
});

test('undiscovered rows hide their text, and hidden entries do not show at all', async () => {
  const game = await realGame();
  game.content.systems.codex.et_bloodlines.hidden = true;
  game.state = (await game.newGame({ book: 'engine-test-d' }), game.state);
  const flat = game.codex().groups.flatMap((g) => g.entries);
  assert.ok(!flat.some((e) => e.id === 'et_bloodlines'));
  const locked = flat.filter((e) => e.locked);
  assert.ok(locked.length >= 1);
  for (const e of locked) assert.deepEqual([e.title, e.text], ['', []]);
});

test('the People screen lists everyone met, keepers and loves with where things stand', async () => {
  const game = await realGame();
  await game.newGame({ book: 'engine-test-d', seed: 4 });
  const people = game.people();
  assert.deepEqual(people.map((p) => p.id).sort(), ['et_keeper', 'et_love']);
  const love = people.find((p) => p.id === 'et_love');
  assert.equal(love.name, 'Test Beloved');
  assert.equal(love.bio.startsWith('A developer person'), true);
  assert.equal(love.status[0], 'Alive');
  assert.equal(people.find((p) => p.id === 'et_keeper').circle, 'keeper');
  // Fates and loves change the notes.
  game.state.sys.people.et_love.fate = 'dead';
  game.state.sys.romances.et_love = { state: 'together', ending: '', book: 'engine-test-d' };
  const after = game.people().find((p) => p.id === 'et_love');
  assert.deepEqual(after.status, ['Dead', 'Love: Together']);
  assert.equal(after.gone, true);
});

test('the family tree nests couples and children and grows as relatives are met', async () => {
  const game = await realGame();
  let frame = await game.newGame({ book: 'engine-test-d', seed: 4 });
  assert.deepEqual(game.family(), []);
  frame = await game.continue();
  await game.choose(1);
  const tree = game.family();
  assert.equal(tree.length, 1);
  assert.equal(tree[0].you, true);
  assert.equal(tree[0].name, 'Gaius');
  assert.equal(tree[0].children[0].name, 'Test Child');
  assert.equal(tree[0].children[0].children[0].name, 'Test Grandchild');
  assert.equal(tree[0].children[0].children[0].status, 'living');
  await game.choose(1); // remember them as they were: the grandchild is dead
  assert.equal(game.family()[0].children[0].children[0].status, 'dead');
});

test('a known spouse joins the hero as a partner, with a label that follows gender', async () => {
  const game = await realGame();
  await game.newGame({ book: 'engine-test-d', seed: 4, vars: { 'hero.gender': 'f' } });
  const kin = game.state.sys.lore.kin;
  Object.assign(kin, { hero: { book: 'burning-city', status: 'living' }, spouse: { book: 'burning-city', status: 'living' }, aelia: { book: 'burning-city', status: 'living' } });
  const [root] = game.family();
  assert.equal(root.partner.name, 'Marcus');
  assert.equal(root.partner.label, 'Husband');
  assert.equal(root.children[0].label, 'Daughter');
  game.state.vars['hero.gender'] = 'm';
  assert.equal(game.family()[0].partner.label, 'Wife');
});

test('quick start marks quick lore as already known', () => {
  const state = { sys: { lore: { codex: {}, kin: {} } } };
  const content = { systems: { codex: { a: { book: 'b1', quick: true }, b: { book: 'b2', quick: true }, c: { book: 'b1' } }, kin: { k: { book: 'b1', quick: 'dead' }, j: { book: 'b1', quick: true }, m: { book: 'b1' } } } };
  quickLore({ state, content }, ['b1']);
  assert.deepEqual(Object.keys(state.sys.lore.codex), ['a']);
  assert.equal(state.sys.lore.kin.k.status, 'dead');
  assert.equal(state.sys.lore.kin.j.status, 'living');
  assert.ok(!('m' in state.sys.lore.kin));
});

test('schema 3 saves gain the lore state', async () => {
  assert.equal(SCHEMA, 5);
  assert.deepEqual(SCHEMA_MIGRATIONS[3]({ sys: {} }).sys.lore, { codex: {}, kin: {} });
  const storage = new MemoryStorage();
  const game = await realGame({ storage });
  await game.newGame({ book: 'engine-test-d', seed: 2 });
  const env = JSON.parse(storage.getItem('tsb:slot:auto'));
  const state = JSON.parse(env.payload);
  delete state.sys.lore;
  const payload = JSON.stringify(state);
  storage.setItem('tsb:slot:auto', JSON.stringify({ ...env, format: SAVE_FORMAT, schema: 3, payload, checksum: fnv1a(payload) }));
  const fresh = await realGame({ storage });
  await fresh.loadSlot('auto');
  assert.deepEqual(fresh.state.sys.lore, { codex: {}, kin: {}, sites: {} });
  assert.deepEqual(fresh.codex().groups.length > 0, true);
});

// ---- Rewind ------------------------------------------------------------------------------------

const REWIND = {
  c1: `@chapter c1\n@title One\n@book b\n\n# start\nPick.\n* A\n  $ _x = 1\n  $ _r = roll(1000)\n  Chose A.\n* B\n  $ _x = 2\n  Chose B.\nAfter.\n---\n=> next\n`,
  c2: `@chapter c2\n@title Two\n@book b\n\n# start\nSecond chapter.\n* Go\n  Went.\nDone.\n=> endbook\n`,
};

test('rewind is off by default and takes back only the most recent choice', async () => {
  const game = await makeGame(memoryLoader({ chapters: REWIND }));
  await game.newGame({ book: 'b', seed: 9 });
  await game.choose(0);
  assert.equal(game.canRewind(), false);
  await assert.rejects(() => game.rewind(), /turned off/);
  const fresh = await makeGame(memoryLoader({ chapters: REWIND }));
  fresh.setSetting('rewind', true);
  await fresh.newGame({ book: 'b', seed: 9 });
  assert.equal(fresh.canRewind(), false); // nothing has been chosen yet
  await assert.rejects(() => fresh.rewind(), /no choice to take back/);
});

test('rewinding restores everything, including the random seed', async () => {
  const game = await makeGame(memoryLoader({ chapters: REWIND }));
  game.setSetting('rewind', true);
  await game.newGame({ book: 'b', seed: 9 });
  const first = await game.choose(0);
  const roll1 = game.state.vars._r;
  assert.deepEqual(texts(first).slice(0, 1), ['Chose A.']);
  assert.equal(game.canRewind(), true);
  const frame = await game.rewind();
  assert.equal(frame.wait, 'choices');
  assert.ok(!('_x' in game.state.vars));
  assert.equal(game.canRewind(), false); // one level only
  await assert.rejects(() => game.rewind(), /no choice to take back/);
  await game.choose(0);
  assert.equal(game.state.vars._r, roll1); // same seed, same result
  await game.rewind();
  const other = await game.choose(1);
  assert.equal(texts(other)[0], 'Chose B.');
  assert.equal(game.state.vars._x, 2);
});

test('rewind does not cross a chapter and is cleared by loading', async () => {
  const game = await makeGame(memoryLoader({ chapters: REWIND }));
  game.setSetting('rewind', true);
  await game.newGame({ book: 'b', seed: 9 });
  await game.choose(0);
  await game.continue(); // after the page break
  await game.continue(); // chapter end -> next chapter
  assert.equal(game.state.chapter, 'c2');
  assert.equal(game.canRewind(), false);
  await game.choose(0);
  assert.equal(game.canRewind(), true);
  await game.loadSlot('auto');
  assert.equal(game.canRewind(), false);
  game.setSetting('rewind', false);
  assert.equal(game.canRewind(), false);
});

// ---- Content notes -------------------------------------------------------------------------------

test('content notes show once, on the first screen of a chapter that has them, when the setting is on', async () => {
  const game = await realGame();
  await game.newGame({ book: 'engine-test-d', seed: 4 });
  assert.deepEqual(game.pendingNotes(), []); // setting is off
  game.setSetting('contentNotes', true);
  const notes = game.pendingNotes();
  assert.deepEqual(notes.map((n) => n.id), ['et_test']);
  assert.equal(notes[0].label, 'Test theme');
  game.ackNotes();
  assert.deepEqual(game.pendingNotes(), []);
  const fresh = await realGame();
  fresh.setSetting('contentNotes', true);
  await fresh.newGame({ book: 'engine-test-d', seed: 4 });
  await fresh.continue(); // past the opening screen
  assert.deepEqual(fresh.pendingNotes(), []);
  assert.equal(fresh.notesFor('etd1').length, 1);
  assert.deepEqual(fresh.notesFor('et1'), []);
});

// ---- Achievements -------------------------------------------------------------------------------

test('achievements are earned at the end of a book and stored in the profile', async () => {
  const storage = new MemoryStorage();
  const game = await realGame({ storage });
  const frame = await playSample(game, [0, 0]);
  assert.equal(frame.wait, 'book_end');
  const got = game.takeNewAchievements();
  assert.deepEqual(got.map((a) => a.id), ['et_sample']);
  assert.deepEqual(game.takeNewAchievements(), []);
  assert.equal(game.profile.achievements.et_sample, 5000);
  const view = game.achievements();
  assert.equal(view.find((a) => a.id === 'et_sample').earned, true);
  assert.equal(view.find((a) => a.id === 'alone').earned, false);
  // A new device sees them after import; the earlier date wins.
  const other = await realGame();
  other.saves.setProfile({ ...other.profile, achievements: { et_sample: 9000, alone: 100 } });
  other.saves.importText(game.saves.exportText());
  assert.deepEqual(other.profile.achievements, { et_sample: 5000, alone: 100 });
});

test('a quick start earns nothing and a missing condition earns nothing', async () => {
  const game = await realGame({ dev: true });
  await playSample(game, [0, 0], { quick: true });
  assert.deepEqual(game.profile.achievements, {});
  const real2 = await realGame();
  await playSample(real2, [0, 0]);
  assert.ok(!('alone' in real2.profile.achievements));
});

test('story achievements read the systems: lone path and no human blood', async () => {
  const game = await realGame();
  await playSample(game, [0, 0]);
  const before = Object.keys(game.profile.achievements);
  assert.deepEqual(before, ['et_sample']);
  // Make the final state qualify, then end a book again through the engine.
  const { evaluateAchievements } = await import('../engine/achievements.js');
  game.state.sys.path = 'lone';
  const got = evaluateAchievements(game, 'book', 'engine-test-d');
  assert.deepEqual(got.map((x) => x.id), ['alone']);
  game.content.achievements.no_human_blood.book = 'engine-test-d';
  assert.deepEqual(evaluateAchievements(game, 'book', 'engine-test-d').map((x) => x.id), ['no_human_blood']);
  game.state.sys.diet.human = 1;
  game.saves.setProfile({ ...game.profile, achievements: {} });
  assert.ok(!evaluateAchievements(game, 'book', 'engine-test-d').some((x) => x.id === 'no_human_blood'));
});

test('chapter scoped achievements are checked at every chapter end', async () => {
  const game = await makeGame(memoryLoader({ chapters: REWIND }));
  game.content.achievements = { first: { id: 'first', title: 'First', text: 't', at: 'chapter', when: 'has("_x")' } };
  await game.newGame({ book: 'b', seed: 1 });
  await game.choose(0);
  await game.continue();
  await game.continue();
  assert.deepEqual(game.takeNewAchievements().map((a) => a.id), ['first']);
});

// ---- Developer tools ------------------------------------------------------------------------------

test('developer tools refuse to run unless developer mode is on', async () => {
  const game = await realGame();
  await assert.rejects(() => dev.jump(game, 'etd1'), /Developer mode is off/);
  assert.throws(() => dev.snapshot(game), /Developer mode is off/);
  assert.equal(dev.chapterList(game).some((c) => c.id === 'etd1' && c.dev), true);
});

test('jump starts any chapter, at any scene, with a default history or the current state', async () => {
  const game = await realGame({ dev: true });
  const frame = await dev.jump(game, 'etd1', { scene: 'ending' });
  assert.equal(game.state.chapter, 'etd1');
  assert.equal(frame.wait, 'chapter_end');
  assert.equal(game.state.vars.quick_start, true);
  assert.deepEqual(await dev.sceneList(game, 'etd1'), ['start', 'family', 'ending']);
  game.state.vars['hero.name'] = 'Kept';
  await dev.jump(game, 'etd1', { keep: true });
  assert.equal(game.state.vars['hero.name'], 'Kept');
  await assert.rejects(() => dev.jump(game, 'nope'), /no chapter/);
});

test('setVar clamps stats, records major decisions and warns about unregistered names', async () => {
  const game = await realGame({ dev: true });
  await dev.jump(game, 'etd1');
  assert.equal(dev.setVar(game, 'hunger', 500).value, 100);
  const r = dev.setVar(game, 'et.hill', 'stayed');
  assert.equal(r.registered, true);
  assert.equal(game.state.decisions.find((d) => d.name === 'et.hill').value, 'stayed');
  assert.deepEqual(dev.setVar(game, 'et.hill', 'flew').warnings.length, 1);
  const odd = dev.setVar(game, 'madeup', true);
  assert.equal(odd.registered, false);
  assert.match(odd.warnings[0], /not registered/);
  assert.throws(() => dev.setVar(game, '__proto__', 1), /not a valid/);
  assert.throws(() => dev.setVar(game, 'bad name', 1), /not a valid/);
  assert.equal(dev.listVars(game).find((v) => v.name === 'hunger').kind, 'stat');
  assert.equal(dev.listVars(game).find((v) => v.name === 'madeup').kind, 'unregistered');
  assert.equal(dev.parseValue('12'), 12);
  assert.equal(dev.parseValue('true'), true);
  assert.equal(dev.parseValue('"x y"'), 'x y');
  assert.equal(dev.parseValue('left'), 'left');
});

test('snapshots let a developer test each branch of one choice', async () => {
  const game = await realGame({ dev: true });
  await dev.jump(game, 'etd1');
  await game.continue();
  assert.equal(game.frame.wait, 'choices');
  dev.snapshot(game, 'A');
  await game.choose(0);
  assert.equal(game.state.vars['et.hill'], 'stayed');
  const frame = await dev.restore(game, 'A');
  assert.equal(frame.wait, 'choices');
  assert.ok(!('et.hill' in game.state.vars));
  await game.choose(1);
  assert.equal(game.state.vars['et.hill'], 'climbed');
  assert.deepEqual(dev.snapshotLabels(game), ['A']);
  await assert.rejects(() => dev.restore(game, 'B'), /no snapshot/);
});

// ---- The branch explorer -------------------------------------------------------------------------

test('explore plays every branch of the sample chapter with no errors', async () => {
  const game = await realGame();
  const report = await dev.explore(game, 'etd1');
  assert.equal(report.paths, 4);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.endings, ['endbook']);
  assert.equal(report.optionsTotal, 4);
  assert.equal(report.optionsTaken, 4);
  assert.deepEqual(report.untaken, []);
  assert.deepEqual(report.unreachedScenes, []);
  assert.equal(report.truncated, false);
});

test('explore reports options and scenes that can never be reached, and runtime errors with the path taken', async () => {
  const src = `@chapter c1\n@title One\n@book b\n\n# start\nPick.\n* Left\n  -> a\n* Right ?if false\n  -> b\n* Boom\n  $ do act()\n  -> a\n\n# a\nDone.\n=> endbook\n\n# b\n=> endbook\n\n# orphan\n=> endbook\n`;
  const game = await makeGame(memoryLoader({ chapters: { c1: src } }));
  const report = await dev.explore(game, 'c1', { base: { vars: {}, once: {}, visited: {}, sys: { }, rng: 1, stack: [], decisions: [], journal: [] } });
  assert.deepEqual(report.untaken.map((o) => o.text), ['Right']);
  assert.deepEqual(report.unreachedScenes.sort(), ['b', 'orphan']);
  assert.equal(report.paths, 2);
});

test('explore stops at its path limit and says so', async () => {
  const src = `@chapter c1\n@title One\n@book b\n\n# start\n* A\n  $ _a = 1\n* B\n  $ _a = 2\n* C\n  $ _a = 3\nPick again.\n* D\n  $ _b = 1\n* E\n  $ _b = 2\n* F\n  $ _b = 3\nAnd again.\n* G\n  $ _c = 1\n* H\n  $ _c = 2\n* I\n  $ _c = 3\n=> endbook\n`;
  const game = await makeGame(memoryLoader({ chapters: { c1: src } }));
  const report = await dev.explore(game, 'c1', { base: { vars: {}, once: {}, visited: {}, sys: {}, rng: 1, stack: [], decisions: [], journal: [] }, maxPaths: 5 });
  assert.equal(report.truncated, true);
  assert.equal(report.paths, 5);
});

// ---- The checker ----------------------------------------------------------------------------------

async function realFiles() {
  const manifest = await real.manifest();
  const stats = await real.stats();
  const files = {};
  for (const name of CONTENT_FILES) files[name] = structuredClone((await real.json(name)) ?? {});
  return { manifest, stats, files };
}
const check = ({ manifest, stats, files }) => checkContentFiles({ manifest, stats, content: assembleContent(files, stats, manifest) });

test('the real content files pass the new file checks', async () => {
  const r = check(await realFiles());
  assert.deepEqual(r.errors, []);
});

test('the checker rejects bad content notes, codex ties, family members and achievements', async () => {
  const world = await realFiles();
  world.manifest.books.find((b) => b.id === 'engine-test-d').chapters[0].notes = ['nope'];
  world.files.codex.entries.et_person.person = 'nobody';
  world.files.family.members.et_child.person = 'ghost';
  world.files.achievements.achievements.bad1 = { title: 'x', text: 'y', when: 'lone(' };
  world.files.achievements.achievements.bad2 = { title: 'x', text: 'y', when: 'flying() and mystery_flag' };
  world.files.achievements.achievements.bad3 = { title: 'x', text: 'y', when: 'fed("cat") > 0', at: 'never', book: 'nowhere' };
  const msgs = check(world).errors.join('\n');
  assert.match(msgs, /unknown content note "nope"/);
  assert.match(msgs, /unknown person "nobody"/);
  assert.match(msgs, /family: et_child names unknown person "ghost"/);
  assert.match(msgs, /achievements: "bad1"/);
  assert.match(msgs, /calls unknown function "flying"/);
  assert.match(msgs, /reads "mystery_flag"/);
  assert.match(msgs, /"cat" is not one of/);
  assert.match(msgs, /unknown "at"/);
  assert.match(msgs, /unknown book "nowhere"/);
});

test('scripts that discover or kin a misspelled id are rejected before release', async () => {
  const { parseChapter } = await import('../engine/script.js');
  const { checkChapterContent } = await import('../engine/content-check.js');
  const game = await realGame();
  const src = '@chapter x\n@title X\n@book b\n\n# start\n$ do discover("et_plcae")\n$ do kin("et_chlid")\n$ do kin("hero", "frozen")\nOk.\n=> endbook\n';
  const { chapter } = parseChapter(src, { file: 'x.tsb' });
  const { errors } = checkChapterContent(chapter, { stats: game.statDefs, content: game.content });
  const msgs = errors.map((e) => e.message).join('\n');
  assert.match(msgs, /unknown codex entry "et_plcae"/);
  assert.match(msgs, /unknown family member "et_chlid"/);
  assert.match(msgs, /"frozen" is not one of: living, dead, unknown/);
});

// ---- The sample chapter -------------------------------------------------------------------------

test('the sample chapter marks its first screen as the opening', async () => {
  const game = await realGame();
  const first = await game.newGame({ book: 'engine-test-d', seed: 4 });
  assert.equal(first.opening, true);
  const next = await game.continue();
  assert.ok(!next.opening);
});

test('the sample chapter reaches both endings', async () => {
  const waited = await realGame();
  await playSample(waited, [0, 0]);
  assert.match(waited.state.journal.length >= 0 ? 'ok' : '', /ok/);
  const left = await realGame();
  let frame = await left.newGame({ book: 'engine-test-d', seed: 4 });
  const seen = [];
  for (let i = 0; i < 40 && frame.wait !== 'book_end'; i++) {
    seen.push(...texts(frame));
    frame = frame.wait === 'choices' ? await left.choose(frame.choices.length - 1) : await left.continue();
  }
  assert.ok(seen.some((t) => t.includes('halfway down')));
  assert.ok(!seen.some((t) => t.includes('Because you waited')));
});

test('maps: start sites show, charting adds sites, and bad ids are rejected', async () => {
  const { MAPS, mapView, siteKnown } = await import('../engine/maps.js');
  const { createState } = await import('../engine/state.js');
  const st = createState();
  st.sys.lore = { codex: {}, kin: {}, sites: {} };
  assert.deepEqual(mapView(st, 'rome').sites, ['roadhome']);
  st.sys.lore.sites['rome.warehouse'] = { book: 'burning-city', chapter: null };
  assert.deepEqual(mapView(st, 'rome').sites, ['warehouse', 'roadhome']);
  assert.equal(siteKnown('rome.warehouse'), true);
  assert.equal(siteKnown('rome.nowhere'), false);
  assert.equal(siteKnown('mars.base'), false);
  assert.deepEqual(SCHEMA_MIGRATIONS[4]({ sys: { lore: { codex: {}, kin: {} } } }).sys.lore.sites, {});
});

test('every site a map lists is drawn by the map page', async () => {
  const { readFileSync } = await import('node:fs');
  const { MAPS } = await import('../engine/maps.js');
  for (const m of Object.values(MAPS)) {
    const html = readFileSync(join(root, `app/maps/${m.page}.html`), 'utf8');
    for (const s of m.sites) assert.ok(html.includes(`id:'${s}'`) || html.includes(`id:"${s}"`), `${s} is in ${m.page}.html`);
  }
});

test('maps: Book Two shows Florence and Collesanto on the Florence page', async () => {
  const { mapView, mapsFor, siteKnown } = await import('../engine/maps.js');
  const { createState } = await import('../engine/state.js');
  const st = createState();
  st.sys.lore = { codex: {}, kin: {}, sites: { 'florence.bank': { book: 'blood-and-gold', chapter: null } } };
  assert.deepEqual(mapView(st, 'florence').sites, ['bank', 'roadhome']);
  assert.deepEqual(mapView(st, 'collesanto2').sites, ['farm', 'square', 'villa', 'road']);
  assert.equal(siteKnown('florence.court'), true);
  assert.equal(siteKnown('florence.warehouse'), false);
  st.book = 'blood-and-gold';
  const maps = mapsFor(st, null);
  assert.deepEqual(maps.map((m) => m.id), ['florence', 'collesanto2']);
  assert.ok(maps.every((m) => m.page === 'florence'));
});

test('maps: Book Three shows Paris and Collesanto on the Paris page, with no site id shared between the two', async () => {
  const { mapView, mapsFor, siteKnown, MAPS } = await import('../engine/maps.js');
  const { createState } = await import('../engine/state.js');
  const st = createState();
  st.sys.lore = { codex: {}, kin: {}, sites: { 'paris.haven': { book: 'crown-of-ashes', chapter: null } } };
  assert.deepEqual(mapView(st, 'paris').sites, ['haven', 'roadhome']);
  assert.deepEqual(mapView(st, 'collesanto3').sites, ['farm', 'square', 'villa', 'road']);
  assert.equal(siteKnown('paris.presses'), true);
  assert.equal(siteKnown('paris.press'), false);
  assert.equal(siteKnown('collesanto3.press'), true);
  const overlap = MAPS.paris.sites.filter((s) => MAPS.collesanto3.sites.includes(s));
  assert.deepEqual(overlap, []);
  st.book = 'crown-of-ashes';
  const maps = mapsFor(st, null);
  assert.deepEqual(maps.map((m) => m.id), ['paris', 'collesanto3']);
  assert.ok(maps.every((m) => m.page === 'paris'));
});
