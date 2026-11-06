// Content checks across the whole game, used by `npm run check` and the tests.
//
// File checks: the flag registry, story voice bands, people, origins and the manifest are
// well formed and agree with each other.
// Chapter checks: every variable a chapter reads or writes is registered (a declared stat,
// a registry entry, a person field, or an _underscore scratch variable), enum values are
// allowed ones, variant tags and people exist, voice() has bands for its stat, and story
// text does not print raw stat numbers.

import { walkExpr } from './expr.js';
import { ScriptError } from './util.js';
import { statDef, voiceDef, GENDERS, PERSON_FIELDS, FLAG_KINDS, PRONOUN_KEYS } from './content.js';
import { checkCall } from './systems/index.js';

const PERSON_FIELD_RE = new RegExp(`^([A-Za-z_][A-Za-z0-9_]*)\\.(${PERSON_FIELDS.join('|')})$`);
const WHO_FNS = new Set(['pro', 'pg', 'name', 'alias', 'surname', 'gender']);

/** Problems in the content files themselves. Returns { errors: string[], warnings: string[] }. */
export function checkContentFiles({ manifest, stats, content }) {
  const errors = [];
  const warnings = [];

  const bookIds = new Set();
  for (const b of manifest.books) {
    if (bookIds.has(b.id)) errors.push(`manifest: book id "${b.id}" is listed twice`);
    bookIds.add(b.id);
    for (const name of Object.keys(b.quickstart?.vars ?? {})) {
      if (!knownVar(name, { stats, content })) errors.push(`manifest: ${b.id} quickstart sets "${name}", which is not registered`);
    }
  }

  // Origins, roles and paths share one tag namespace.
  const seen = new Map();
  for (const [group, list] of Object.entries(content.origins)) {
    for (const o of list) {
      if (!/^[a-z_][a-z0-9_]*$/.test(o.id ?? '')) errors.push(`origins: bad id "${o.id}" in ${group}s (lowercase letters, digits, underscore)`);
      if (seen.has(o.id)) errors.push(`origins: id "${o.id}" is used by both ${seen.get(o.id)}s and ${group}s`);
      seen.set(o.id, group);
    }
  }
  for (const o of content.origins.origin) {
    for (const r of o.roles ?? []) if (!content.variantIds.role.has(r)) errors.push(`origins: ${o.id} suggests unknown role "${r}"`);
    for (const p of o.paths ?? []) if (!content.variantIds.path.has(p)) errors.push(`origins: ${o.id} suggests unknown path "${p}"`);
    for (const g of ['m', 'f']) if (!o.names?.[g]?.length) warnings.push(`origins: ${o.id} has no suggested ${g === 'm' ? 'male' : 'female'} names`);
  }

  // Story voice.
  for (const [stat, def] of Object.entries(content.voice)) {
    if (stat === 'note') continue;
    const where = `voice: "${stat}"`;
    if (!statDef(stats, stat) && !stat.endsWith('.*')) warnings.push(`${where} is not a declared stat`);
    const bands = def.bands;
    if (!Array.isArray(bands) || !bands.length) { errors.push(`${where} has no bands`); continue; }
    const ids = new Set();
    let last = -Infinity;
    bands.forEach((b, i) => {
      if (!b.id) errors.push(`${where} band ${i + 1} has no id`);
      if (ids.has(b.id)) errors.push(`${where} has two bands with id "${b.id}"`);
      ids.add(b.id);
      if (typeof b.say !== 'string') errors.push(`${where} band "${b.id}" has no "say" text`);
      if (!def.hidden && typeof b.status !== 'string') warnings.push(`${where} band "${b.id}" has no "status" text for the menu`);
      const isLast = i === bands.length - 1;
      if (b.upTo === undefined || b.upTo === null) {
        if (!isLast) errors.push(`${where} band "${b.id}" has no upTo but is not the last band`);
      } else {
        if (b.upTo <= last) errors.push(`${where} band "${b.id}" upTo must be higher than the band before`);
        last = b.upTo;
      }
    });
    const max = statDef(stats, stat)?.max;
    const tail = bands[bands.length - 1];
    if (tail.upTo !== undefined && tail.upTo !== null && (max === undefined || tail.upTo < max)) {
      errors.push(`${where} last band stops at ${tail.upTo}; leave out its upTo so every value has a band`);
    }
  }
  for (const name of Object.keys(stats)) {
    if (!voiceDef(content.voice, name)) warnings.push(`stats: "${name}" has no story voice in content/voice.json`);
  }

  // Flag registry.
  const allFlags = [...Object.values(content.flags.entries), ...content.flags.wild.map((w) => w.def)];
  for (const def of allFlags) {
    const where = `flags: "${def.name}"`;
    if (!FLAG_KINDS.includes(def.kind)) errors.push(`${where} has unknown kind "${def.kind}" (${FLAG_KINDS.join(', ')})`);
    if (def.kind === 'enum' && (!Array.isArray(def.values) || !def.values.length)) errors.push(`${where} is an enum with no values`);
    if (def.book && !bookIds.has(def.book)) errors.push(`${where} names unknown book "${def.book}"`);
    if (statDef(stats, def.name)) errors.push(`${where} is also a declared stat`);
    if ('default' in def && !valueFits(def, def.default)) errors.push(`${where} default ${JSON.stringify(def.default)} does not fit its kind`);
  }

  // People.
  for (const [id, p] of Object.entries(content.people)) {
    const g = p.gender;
    if (g === undefined) continue;
    if (typeof g === 'string' && g.startsWith('opposite:')) {
      if (!content.people[g.slice(9)]) errors.push(`people: ${id} is opposite of unknown person "${g.slice(9)}"`);
    } else if (!GENDERS.includes(g)) errors.push(`people: ${id} has gender "${g}" (use m, f, x or opposite:<id>)`);
    for (const table of ['aliases', 'surnames']) {
      for (const book of Object.keys(p[table] ?? {})) {
        if (book !== 'default' && !bookIds.has(book)) errors.push(`people: ${id} ${table} names unknown book "${book}"`);
      }
    }
  }
  return { errors, warnings };
}

function valueFits(def, v) {
  switch (def.kind) {
    case 'flag': return typeof v === 'boolean';
    case 'enum': return Array.isArray(def.values) && def.values.includes(v);
    case 'number': return typeof v === 'number';
    case 'text': return typeof v === 'string';
  }
  return false;
}

/** True if a variable name is accounted for: stat, registry, person field, or _scratch. */
export function knownVar(name, { stats, content }) {
  if (name.startsWith('_')) return true;
  if (statDef(stats, name)) return true;
  if (content.flags.lookup(name)) return true;
  const m = PERSON_FIELD_RE.exec(name);
  return Boolean(m && Object.hasOwn(content.people, m[1]));
}

/**
 * Problems in one compiled chapter, as ScriptErrors with file and line.
 * `dev` relaxes the raw stat number warning (developer test chapters print numbers on purpose).
 */
export function checkChapterContent(chapter, { stats, content, dev = false }) {
  const errors = [];
  const warnings = [];
  const file = chapter.file;
  const err = (line, msg) => errors.push(new ScriptError(msg, { file, line }));
  const warn = (line, msg) => warnings.push(new ScriptError(msg, { file, line }));
  const ctx = { stats, content };
  const reported = new Set();
  const unknown = (name, line, how) => {
    const key = `${name}|${line}`;
    if (reported.has(key)) return;
    reported.add(key);
    err(line, `"${name}" is ${how} but is not registered (content/flags.json, stats.json or people.json; start scratch variables with _)`);
  };
  const lit = (a) => (a?.t === 'lit' ? a.v : undefined);

  function checkExpr(ast, line) {
    walkExpr(ast, (n) => {
      if (n.t === 'var' && !knownVar(n.name, ctx)) unknown(n.name, line, 'read');
      if (n.t === 'bin' && (n.op === '==' || n.op === '!=')) {
        const pair = n.a.t === 'var' && n.b.t === 'lit' ? [n.a.name, n.b.v] : n.b.t === 'var' && n.a.t === 'lit' ? [n.b.name, n.a.v] : null;
        if (pair) {
          const def = content.flags.lookup(pair[0]);
          if (def?.kind === 'enum' && typeof pair[1] === 'string' && !def.values.includes(pair[1])) {
            err(line, `"${pair[0]}" is compared with "${pair[1]}", which is not one of its values (${def.values.join(', ')})`);
          }
        }
      }
      if (n.t !== 'call') return;
      if (content.systems) for (const m of checkCall('fn', n.name, n.args, content)) err(line, m);
      const a0 = lit(n.args[0]);
      if (n.name === 'has' && typeof a0 === 'string' && !knownVar(a0, ctx)) unknown(a0, line, 'checked with has()');
      if (n.name === 'variant') {
        for (const a of n.args) {
          const v = lit(a);
          if (typeof v === 'string' && !content.allTags.has(v)) err(line, `unknown variant tag "${v}" (not an origin, role or path in content/origins.json)`);
        }
      }
      if ((n.name === 'voice' || n.name === 'band') && typeof a0 === 'string') {
        const def = voiceDef(content.voice, a0);
        if (!def) err(line, `${n.name}("${a0}"): no story voice for that stat in content/voice.json`);
        const form = lit(n.args[1]);
        if (def && n.name === 'voice' && typeof form === 'string' && !(def.bands ?? []).every((b) => typeof b[form] === 'string')) {
          err(line, `voice("${a0}", "${form}"): not every band of "${a0}" has "${form}" text`);
        }
      }
      if (WHO_FNS.has(n.name) && typeof a0 === 'string' && !Object.hasOwn(content.people, a0)) {
        err(line, `${n.name}(): unknown person "${a0}" (add them to content/people.json)`);
      }
      if (n.name === 'pro') {
        const key = lit(n.args[1]);
        if (typeof key === 'string' && !PRONOUN_KEYS.has(key)) err(line, `unknown pronoun word "${key}"`);
      }
    });
  }

  function checkText(parts, line) {
    for (const p of parts ?? []) {
      if (typeof p === 'string' || !p.expr) continue;
      checkExpr(p.expr, line);
      if (!dev && p.expr.t === 'var' && statDef(stats, p.expr.name)) {
        warn(line, `{${p.expr.name}} prints a raw stat number; describe it in the story's voice with voice("${p.expr.name}")`);
      }
    }
  }

  for (const scene of Object.values(chapter.scenes)) {
    for (const op of scene.ops) {
      const line = op.line;
      switch (op.op) {
        case 'text': checkText(op.parts, line); break;
        case 'jf': checkExpr(op.ast, line); break;
        case 'do':
          op.args.forEach((a) => checkExpr(a, line));
          if (content.systems) for (const m of checkCall('command', op.name, op.args, content)) err(line, m);
          break;
        case 'choices':
          for (const o of op.options) { checkText(o.parts, o.line ?? line); if (o.cond) checkExpr(o.cond, line); }
          break;
        case 'flag':
          for (const n of op.names) {
            if (!knownVar(n, ctx)) { unknown(n, line, 'flagged'); continue; }
            const def = content.flags.lookup(n);
            if (def && def.kind !== 'flag') err(line, `"${n}" is registered as ${def.kind}, not a flag; set it with $ ${n} = ...`);
            if (!def && !n.startsWith('_')) err(line, `"${n}" is not a flag`);
          }
          break;
        case 'set': {
          checkExpr(op.ast, line);
          if (!knownVar(op.name, ctx)) { unknown(op.name, line, 'set'); break; }
          const def = content.flags.lookup(op.name);
          const v = lit(op.ast);
          if (def && op.how === '=' && v !== undefined) {
            if (def.kind === 'enum' && !def.values.includes(v)) err(line, `"${op.name}" cannot be "${v}" (allowed: ${def.values.join(', ')})`);
            else if (def.kind !== 'enum' && !valueFits(def, v)) err(line, `"${op.name}" is registered as ${def.kind} but is set to ${JSON.stringify(v)}`);
          }
          if (def && op.how !== '=' && def.kind !== 'number') err(line, `"${op.name}" is registered as ${def.kind}; only numbers can use ${op.how}`);
          const pm = PERSON_FIELD_RE.exec(op.name);
          if (pm && pm[2] === 'gender' && typeof v === 'string' && !['m', 'f', 'x'].includes(v)) err(line, `"${op.name}" must be "m", "f" or "x"`);
          break;
        }
      }
    }
  }
  return { errors, warnings };
}
