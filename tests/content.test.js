import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChapterOrThrow, parseChapter } from '../engine/script.js';
import { Runner } from '../engine/runner.js';
import { createState, applyStatDefaults } from '../engine/state.js';
import { makeContent } from '../engine/content.js';
import { validateChapter } from '../engine/validate.js';
import { checkChapterContent, checkContentFiles } from '../engine/content-check.js';
import { texts } from './helpers.js';

const STATS = {
  hunger: { min: 0, max: 100, start: 10, int: true },
  'loyalty.*': { min: 0, max: 100, int: true },
};

const CONTENT = makeContent({
  stats: STATS,
  voice: {
    stats: {
      hunger: { bands: [
        { id: 'sated', upTo: 20, say: 'your hunger is quiet', short: 'sated', status: 'Fed.' },
        { id: 'hungry', upTo: 70, say: 'your hunger gnaws', short: 'hungry', status: 'Hungry.' },
        { id: 'starving', say: 'your hunger roars', short: 'starving', status: 'Starving.' },
      ] },
      'loyalty.*': { bands: [{ id: 'low', upTo: 50, say: 'wavering' }, { id: 'high', say: 'devoted' }] },
    },
  },
  people: {
    people: {
      hero: { gender: 'm', name: 'Gaius', aliases: { b: 'Signor del Colle' }, surnames: { b: 'Valerio', default: 'Valerius' } },
      spouse: { gender: 'opposite:hero', names: { f: 'Livia', m: 'Marcus' } },
      cassian: { gender: 'm', name: 'Cassian' },
    },
  },
  origins: {
    origins: [{ id: 'roman' }, { id: 'briton' }, { id: 'gaul' }],
    roles: [{ id: 'gladiator' }, { id: 'merchant' }],
    paths: [{ id: 'captured' }],
  },
  flags: {
    flags: {
      'hero.origin': { kind: 'enum', values: '@origins' },
      'hero.role': { kind: 'enum', values: '@roles' },
      spared_hunter: { kind: 'flag', book: 'b', major: true, default: true },
      fate: { kind: 'enum', values: ['kept', 'sold'], book: 'b', major: true, default: 'kept' },
      'met.*': { kind: 'flag' },
    },
  },
});

function run(source, vars = {}, { warn = () => {}, book = 'b' } = {}) {
  const chapter = parseChapterOrThrow(`@chapter t\n${source}`, { file: 't.tsb' });
  const state = createState({ book, vars, seed: 1 });
  applyStatDefaults(state, STATS);
  const runner = new Runner(chapter, state, { statDefs: STATS, content: CONTENT, warn });
  runner.start();
  return { chapter, state, runner };
}

// ---- story voice -----------------------------------------------------------------------------

test('voice() describes a stat by band, with forms, and band() names the band', () => {
  const { state } = run(`# start
Now {voice("hunger")}, {voice("hunger", "short")}, band {band("hunger")}.
$ hunger = 85
Now {voice("hunger")}, band {band("hunger")}.
$ hunger = 20
Edge {band("hunger")}.
---
=> endbook`);
  assert.deepEqual(texts(state.frame), [
    'Now your hunger is quiet, sated, band sated.',
    'Now your hunger roars, band starving.',
    'Edge sated.',
  ]);
});

test('voice() covers per person stats through wildcards and errors for unknown stats', () => {
  const { state } = run(`# start
$ loyalty.prisca = 80
Prisca is {voice("loyalty.prisca")}; Tullus is {voice("loyalty.tullus")}.
---
=> endbook`);
  assert.deepEqual(texts(state.frame), ['Prisca is devoted; Tullus is wavering.']);
  assert.throws(() => run('# start\n{voice("gold")}\n---\n=> endbook'), /no story voice for "gold"/);
});

// ---- pronouns and names -----------------------------------------------------------------------------

test('pronoun shorthand follows the hero and other people, with capitals and verb agreement', () => {
  const src = `# start
{They} {are} here. {They} walk{s} in; {their} cloak is wet, the choice is {theirs}, {they} blame{s} {themself}.
{Name} meets {cassian.name}. {cassian.They} {cassian.are} pale. {spouse.Name} watches {them}.
---
=> endbook`;
  assert.deepEqual(texts(run(src, { 'hero.gender': 'm' }).state.frame), [
    'He is here. He walks in; his cloak is wet, the choice is his, he blames himself.',
    'Gaius meets Cassian. He is pale. Marcus watches him.'.replace('Marcus', 'Livia'),
  ]);
  assert.deepEqual(texts(run(src, { 'hero.gender': 'f', 'hero.name': 'Brica' }).state.frame), [
    'She is here. She walks in; her cloak is wet, the choice is hers, she blames herself.',
    'Brica meets Cassian. He is pale. Marcus watches her.',
  ]);
  assert.deepEqual(texts(run(src, { 'hero.gender': 'x' }).state.frame).slice(0, 1), [
    'They are here. They walk in; their cloak is wet, the choice is theirs, they blame themself.',
  ]);
});

test('a story variable can override a person\'s gender or name', () => {
  const { state } = run(`# start
$ spouse.gender = "m"
$ spouse.name = "Quintus"
{spouse.Name} lifts {spouse.their} cup. {pg("spouse", "husband", "wife")} and {g("man", "woman")}.
---
=> endbook`, { 'hero.gender': 'm' });
  assert.deepEqual(texts(state.frame), ['Quintus lifts his cup. husband and man.']);
});

test('alias and surname follow the book, with defaults and overrides', () => {
  assert.deepEqual(texts(run('# start\n{alias}, {surname}.\n---\n=> endbook').state.frame), ['Signor del Colle, Valerio.']);
  assert.deepEqual(texts(run('# start\n{alias}, {surname}.\n---\n=> endbook', {}, { book: 'other' }).state.frame), ['Gaius, Valerius.']);
  assert.deepEqual(texts(run('# start\n$ hero.alias = "Monsieur Colline"\n{Alias}.\n---\n=> endbook').state.frame), ['Monsieur Colline.']);
});

test('shorthand words are only pronouns when written exactly; other variables are untouched', () => {
  const { state } = run('# start\n$ _theyx = 3\n{_theyx} {THEY}\n---\n=> endbook', { THEY: 'caps', 'hero.gender': 'f' });
  assert.deepEqual(texts(state.frame), ['3 caps']);
});

// ---- origin variants ------------------------------------------------------------------------------------

const VARIANT_SRC = `# start
[roman] Citizen line.
[briton gaul] Conquered line.
[not roman] Foreign line.
[!briton] Not a Briton line.
[gladiator] Arena line.
\\[roman] Escaped line.
?if [briton] and hunger < 50
  Condition with tags.
?end
* Speak Brittonic ?if [briton]
  Spoke.
* Stay quiet
  Quiet.
~> home [origin]
---
=> endbook

# home
Generic home.
<~

# home_briton
Briton home.
<~
`;

test('[tags] lines, ?if [tags] and choice conditions follow origin and role', () => {
  const roman = run(VARIANT_SRC, { 'hero.origin': 'roman', 'hero.role': 'merchant' }).state.frame;
  assert.deepEqual(texts(roman), ['Citizen line.', 'Not a Briton line.', '[roman] Escaped line.']);
  assert.deepEqual(roman.choices.map((c) => c.text), ['Stay quiet']);
  const briton = run(VARIANT_SRC, { 'hero.origin': 'briton', 'hero.role': 'gladiator' }).state.frame;
  assert.deepEqual(texts(briton), ['Conquered line.', 'Foreign line.', 'Arena line.', '[roman] Escaped line.', 'Condition with tags.']);
  assert.deepEqual(briton.choices.map((c) => c.text), ['Speak Brittonic', 'Stay quiet']);
});

test('-> scene [origin] picks the origin version of a scene when it exists', () => {
  const b = run(VARIANT_SRC, { 'hero.origin': 'briton' });
  b.runner.choose(1);
  assert.deepEqual(texts(b.state.frame), ['Quiet.', 'Briton home.']);
  const g = run(VARIANT_SRC, { 'hero.origin': 'gaul' });
  g.runner.choose(0);
  assert.deepEqual(texts(g.state.frame), ['Quiet.', 'Generic home.']);
  const none = run(VARIANT_SRC, {});
  none.runner.choose(0);
  assert.deepEqual(texts(none.state.frame), ['Quiet.', 'Generic home.']);
});

test('variant scenes count as reachable, and the base scene is required', () => {
  const chapter = parseChapterOrThrow(`@chapter t\n${VARIANT_SRC}`, { file: 't.tsb' });
  const report = validateChapter(chapter, { variantIds: CONTENT.variantIds });
  assert.deepEqual(report.warnings.map((w) => w.message), []);
  const missing = parseChapterOrThrow('@chapter t\n# start\n-> gone [origin]\n# gone_briton\n=> endbook', { file: 't.tsb' });
  assert.match(validateChapter(missing).errors[0].message, /"gone": no such scene/);
  assert.match(parseChapter('@chapter t\n# start\n-> x [homeland]\n', { file: 't.tsb' }).errors[0].message, /bad variant jump/);
});

// ---- flag registry -----------------------------------------------------------------------------------------

test('major registry flags are logged as decisions, latest value last', () => {
  const { state } = run(`# start
$ flag spared_hunter
$ fate = "sold"
$ _scratch = 1
$ fate = "kept"
---
=> endbook`);
  assert.deepEqual(state.decisions.map((d) => [d.name, d.value, d.book, d.chapter]), [
    ['spared_hunter', true, 'b', null],
    ['fate', 'kept', 'b', null],
  ].map((r) => { r[3] = state.chapter; return r; }));
  const { state: s2 } = run('# start\n$ flag spared_hunter\n$ unflag spared_hunter\n---\n=> endbook');
  assert.deepEqual(s2.decisions, []);
});

test('setting an enum to an unregistered value warns at play time', () => {
  const warnings = [];
  run('# start\n$ fate = "burned"\n---\n=> endbook', {}, { warn: (m) => warnings.push(m) });
  assert.match(warnings[0], /"fate" was set to "burned"/);
});

test('the journal command adds Previously entries', () => {
  const { state } = run('# start\n$ do journal("Rome burned.", "Night of fire")\n---\n=> endbook');
  assert.deepEqual(state.journal, [{ book: 'b', chapter: state.chapter, title: 'Night of fire', text: 'Rome burned.' }]);
});

// ---- content checker -------------------------------------------------------------------------------------------

function check(source, opts = {}) {
  const chapter = parseChapterOrThrow(`@chapter t\n${source}`, { file: 't.tsb' });
  return checkChapterContent(chapter, { stats: STATS, content: CONTENT, ...opts });
}
const msgs = (r) => r.errors.map((e) => e.detail);

test('the checker catches misspelled and unregistered variables', () => {
  const r = check(`# start
?if spared_huntr
  Typo.
?end
$ flag met.prisca
$ flag spared_hunter
$ _local = 1
$ hunger += 1
$ loyalty.prisca += 1
$ spouse.name = "Livia"
$ ghost_var = 2
{has("other_typo")}
---
=> endbook`);
  assert.deepEqual(msgs(r).map((m) => m.split(' ')[0]), ['"spared_huntr"', '"ghost_var"', '"other_typo"']);
});

test('the checker enforces enum values, flag kinds and variant tags', () => {
  const r = check(`# start
$ fate = "burned"
?if fate == "lost"
  x
?end
$ flag fate
$ fate += 1
[bretonn] Typo tag.
?if [gaul]
  ok
?end
$ spouse.gender = "female"
---
=> endbook`);
  const m = msgs(r);
  assert.equal(m.length, 6);
  assert.match(m[0], /"fate" cannot be "burned"/);
  assert.match(m[1], /compared with "lost"/);
  assert.match(m[2], /registered as enum, not a flag/);
  assert.match(m[3], /only numbers can use \+=/);
  assert.match(m[4], /unknown variant tag "bretonn"/);
  assert.match(m[5], /must be "m", "f" or "x"/);
});

test('the checker catches unknown people and voices, and raw stat numbers in story text', () => {
  const r = check(`# start
{voice("gold")} {voice("hunger", "poem")} {name("nobody")} {pro("hero", "his")}
Hunger is {hunger}.
---
=> endbook`);
  const m = msgs(r);
  assert.match(m[0], /voice\("gold"\)/);
  assert.match(m[1], /"poem" text/);
  assert.match(m[2], /unknown person "nobody"/);
  assert.match(m[3], /unknown pronoun word "his"/);
  assert.match(r.warnings[0].detail, /raw stat number/);
  assert.equal(check('# start\n{hunger}\n---\n=> endbook', { dev: true }).warnings.length, 0);
});

test('the file checks catch bad bands, registry entries, people and origin ids', () => {
  const bad = makeContent({
    stats: STATS,
    voice: { stats: { hunger: { bands: [{ id: 'a', upTo: 50, say: 'x', status: 'x' }, { id: 'b', upTo: 40, say: 'y', status: 'y' }] } } },
    flags: { flags: { odd: { kind: 'maybe' }, e: { kind: 'enum', values: ['a'], default: 'z' }, hunger: { kind: 'number' } } },
    people: { people: { x: { gender: 'opposite:nobody' } } },
    origins: { origins: [{ id: 'roman', roles: ['king'] }], roles: [{ id: 'roman' }], paths: [] },
  });
  const r = checkContentFiles({ manifest: { books: [{ id: 'b', chapters: [] }] }, stats: STATS, content: bad });
  const text = r.errors.join('\n');
  for (const want of ['upTo must be higher', 'last band stops at 40', 'unknown kind "maybe"', 'default "z"', 'also a declared stat', 'opposite of unknown person', 'used by both origins and roles', 'unknown role "king"']) {
    assert.ok(text.includes(want), `missing: ${want}\n${text}`);
  }
});
